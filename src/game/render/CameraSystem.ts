import * as THREE from 'three';
import { WEAPONS } from '../data/weapons';
import { MapData, PlayerState, SplitScreenMode } from '../types';

export interface CameraTargetState {
  x: number;
  y: number;
  z: number;
  zoomRatio: number; // 1.0 = standard, >1 = zoomed in, <1 = zoomed out
}

const SPLIT_ENTER_DIST = 16.5;
const SPLIT_EXIT_DIST = 13.0;

export class CameraSystem {
  public readonly camP1: THREE.PerspectiveCamera;
  public readonly camP2: THREE.PerspectiveCamera;

  private p1State: CameraTargetState = { x: 0, y: 6, z: 22, zoomRatio: 1 };
  private p2State: CameraTargetState = { x: 0, y: 6, z: 22, zoomRatio: 1 };
  private splitActive = false;

  constructor(aspect: number) {
    this.camP1 = new THREE.PerspectiveCamera(40, aspect, 0.5, 240);
    this.camP2 = new THREE.PerspectiveCamera(40, aspect, 0.5, 240);
    this.camP1.position.set(0, 6, 22);
    this.camP2.position.set(0, 6, 22);
  }

  public isSplitScreenActive(): boolean {
    return this.splitActive;
  }

  public getPlayerZoomInfo(slot: 0 | 1): { distance: number; label: string } {
    const z = slot === 0 ? this.p1State.z : this.p2State.z;
    const pct = Math.round((22 / Math.max(10, z)) * 100);
    const label = z > 27 ? 'WIDE' : z < 17 ? 'CLOSE' : 'STD';
    return { distance: pct, label };
  }

  private computeTargetForPlayer(
    player: PlayerState,
    allPlayers: PlayerState[],
    map: MapData
  ): { tx: number; ty: number; tz: number } {
    const activeWeapon = player.weapons[player.activeSlot];
    const spec = WEAPONS[activeWeapon ? activeWeapon.weaponId : 'pistol'];
    const profile = spec.zoomProfile;

    // 1. Base vs Aim zoom
    let targetZ = player.zoomHeld ? profile.aimZoom : profile.baseZoom;
    targetZ += player.manualZoomOffset;

    // 2. Aim lookahead
    const lookMult = player.zoomHeld ? 1.35 : 1.0;
    let tx = player.x + Math.cos(player.aimAngle) * profile.lookAhead * lookMult;
    let ty = player.y + 1.4 + Math.sin(player.aimAngle) * profile.lookAhead * 0.65 * lookMult;

    // 3. Nearby combat awareness (subtle framing toward closest visible threat)
    let nearestThreat: PlayerState | null = null;
    let nearestDist = 24;
    for (const other of allPlayers) {
      if (!other.alive || other.id === player.id) continue;
      if (player.team !== 0 && other.team === player.team) continue;
      const d = Math.hypot(other.x - player.x, other.y - player.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearestThreat = other;
      }
    }

    if (nearestThreat) {
      const w = profile.enemyWeight * (1 - nearestDist / 26);
      tx = THREE.MathUtils.lerp(tx, (player.x + nearestThreat.x) * 0.5, w);
      ty = THREE.MathUtils.lerp(ty, (player.y + nearestThreat.y) * 0.5 + 1.2, w * 0.7);
      // Slightly zoom out in chaotic multi-height duels if holding close weapon, or zoom in slightly if isolated
      if (nearestDist > 14 && spec.category !== 'shotgun' && spec.category !== 'melee') {
        targetZ += 1.5;
      }
    }

    // Clamp Z so characters remain readable & player retains awareness
    targetZ = THREE.MathUtils.clamp(targetZ, 13.0, 38.0);

    // Clamp X/Y within reasonable arena bounds
    const maxX = map.width * 0.5 - 4;
    const minY = map.floorY + 3.2;
    const maxY = map.ceilingY - 3.5;
    tx = THREE.MathUtils.clamp(tx, -maxX, maxX);
    ty = THREE.MathUtils.clamp(ty, minY, maxY);

    return { tx, ty, tz: targetZ };
  }

  public update(
    players: PlayerState[],
    map: MapData,
    twoPlayerLocal: boolean,
    splitMode: SplitScreenMode,
    splitOrientation: 'vertical' | 'horizontal',
    width: number,
    height: number,
    screenShake: number,
    dt: number
  ): void {
    const p1 = players.find((p) => p.localSlot === 0);
    const p2 = players.find((p) => p.localSlot === 1);

    if (!twoPlayerLocal || !p1 || !p2) {
      this.splitActive = false;
      if (p1) {
        const tgt = this.computeTargetForPlayer(p1, players, map);
        this.p1State.x = THREE.MathUtils.damp(this.p1State.x, tgt.tx, 8.5, dt);
        this.p1State.y = THREE.MathUtils.damp(this.p1State.y, tgt.ty, 8.5, dt);
        this.p1State.z = THREE.MathUtils.damp(this.p1State.z, tgt.tz, 5.5, dt);
      }
      this.applyToCamera(this.camP1, this.p1State, width / Math.max(1, height), screenShake);
      return;
    }

    // Determine split-screen state for 2-Player Local
    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    if (splitMode === 'always_split') {
      this.splitActive = true;
    } else if (splitMode === 'shared') {
      this.splitActive = false;
    } else {
      // Dynamic split-screen with hysteresis
      if (!this.splitActive && dist > SPLIT_ENTER_DIST) {
        this.splitActive = true;
      } else if (this.splitActive && dist < SPLIT_EXIT_DIST) {
        this.splitActive = false;
      }
    }

    if (!this.splitActive) {
      // Shared dynamic framing camera covering both players
      const midX = (p1.x + p2.x) * 0.5;
      const midY = (p1.y + p2.y) * 0.5 + 1.5;
      const t1 = this.computeTargetForPlayer(p1, players, map);
      const t2 = this.computeTargetForPlayer(p2, players, map);
      const baseZ = Math.max(t1.tz, t2.tz);
      const neededZ = Math.max(baseZ, 16 + dist * 1.12);
      const clampedZ = THREE.MathUtils.clamp(neededZ, 15.0, 38.0);

      this.p1State.x = THREE.MathUtils.damp(this.p1State.x, midX, 8, dt);
      this.p1State.y = THREE.MathUtils.damp(this.p1State.y, midY, 8, dt);
      this.p1State.z = THREE.MathUtils.damp(this.p1State.z, clampedZ, 5, dt);
      this.p2State.x = this.p1State.x;
      this.p2State.y = this.p1State.y;
      this.p2State.z = this.p1State.z;

      this.applyToCamera(this.camP1, this.p1State, width / Math.max(1, height), screenShake);
    } else {
      // Independent split-screen cameras
      const t1 = this.computeTargetForPlayer(p1, players, map);
      const t2 = this.computeTargetForPlayer(p2, players, map);

      this.p1State.x = THREE.MathUtils.damp(this.p1State.x, t1.tx, 9, dt);
      this.p1State.y = THREE.MathUtils.damp(this.p1State.y, t1.ty, 9, dt);
      this.p1State.z = THREE.MathUtils.damp(this.p1State.z, t1.tz, 6, dt);

      this.p2State.x = THREE.MathUtils.damp(this.p2State.x, t2.tx, 9, dt);
      this.p2State.y = THREE.MathUtils.damp(this.p2State.y, t2.ty, 9, dt);
      this.p2State.z = THREE.MathUtils.damp(this.p2State.z, t2.tz, 6, dt);

      const subAspect =
        splitOrientation === 'vertical'
          ? (width * 0.5) / Math.max(1, height)
          : width / Math.max(1, height * 0.5);

      this.applyToCamera(this.camP1, this.p1State, subAspect, screenShake);
      this.applyToCamera(this.camP2, this.p2State, subAspect, screenShake);
    }
  }

  private applyToCamera(
    cam: THREE.PerspectiveCamera,
    state: CameraTargetState,
    aspect: number,
    shake: number
  ): void {
    if (Math.abs(cam.aspect - aspect) > 0.002) {
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
    }
    const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    cam.position.set(state.x + sx, state.y + sy, state.z);
    cam.lookAt(state.x + sx, state.y + sy - 0.25, 0);
  }
}
