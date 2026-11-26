import { MatchConfig, MatchSnapshot, PlayerInputFrame } from '../types';
import { GameSimulation } from '../sim/GameSimulation';

/**
 * Clean transport abstraction separating client UI/Rendering from the simulation authority.
 * - Currently implemented by `LocalMatchTransport` for zero-latency local 1P & 2P split-screen play.
 * - Designed so a future `WebSocketMatchTransport` can run `GameSimulation` on a Node.js server
 *   and stream `PlayerInputFrame` up / `MatchSnapshot` down with interpolation & prediction.
 */
export interface IMatchTransport {
  readonly mode: 'local' | 'online';
  step(rawDt: number, inputs: PlayerInputFrame[]): MatchSnapshot;
  getLatestSnapshot(): MatchSnapshot;
  dispose(): void;
}

export class LocalMatchTransport implements IMatchTransport {
  public readonly mode = 'local' as const;
  private sim: GameSimulation;
  private accumulator = 0;
  private readonly fixedDt = 1 / 60;
  private latestSnapshot: MatchSnapshot;

  constructor(config: MatchConfig) {
    this.sim = new GameSimulation(config);
    this.latestSnapshot = this.sim.getSnapshot();
  }

  public step(rawDt: number, inputs: PlayerInputFrame[]): MatchSnapshot {
    const clamped = Math.min(rawDt, 0.05);
    this.accumulator += clamped;

    let stepped = false;
    // Consume edge-triggered actions only on the first fixed sub-step of this frame
    let frameInputs = inputs;

    while (this.accumulator >= this.fixedDt) {
      this.latestSnapshot = this.sim.step(this.fixedDt, frameInputs);
      this.accumulator -= this.fixedDt;
      stepped = true;
      frameInputs = frameInputs.map((inp) => ({
        ...inp,
        jumpJustPressed: false,
        fireJustPressed: false,
        manualZoomDelta: 0,
        reloadJustPressed: false,
        pickupJustPressed: false,
        switchWeaponJustPressed: false,
        grenadeJustPressed: false,
        cycleGrenadeJustPressed: false,
        meleeJustPressed: false,
        secondaryJustPressed: false,
      }));
    }

    if (!stepped) {
      // Clear transient one-frame events if no tick ran
      this.latestSnapshot = {
        ...this.latestSnapshot,
        particleEvents: [],
        soundEvents: [],
      };
    }

    return this.latestSnapshot;
  }

  public getLatestSnapshot(): MatchSnapshot {
    return this.latestSnapshot;
  }

  public dispose(): void {
    // Nothing to close for local transport
  }
}

/**
 * Stub blueprint for future WebSocket server-authoritative online multiplayer.
 * Simply implement `step()` to send `inputs` over WebSocket and return the latest
 * interpolated server `MatchSnapshot`.
 */
export interface OnlineTransportConfig {
  serverUrl: string;
  roomCode: string;
  playerName: string;
}
