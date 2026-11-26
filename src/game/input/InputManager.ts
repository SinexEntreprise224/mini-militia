import {
  ControllerSettings,
  GameSettings,
  InputDeviceAssignment,
  KeyBindings,
  PlayerInputFrame,
  PlayerState,
} from '../types';
import { PLAYER_CENTER_Y } from '../sim/Physics';

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  left: 'KeyA',
  right: 'KeyD',
  down: 'KeyS',
  jump: 'Space',
  reload: 'KeyR',
  switchWeapon: 'KeyQ',
  grenade: 'KeyG',
  melee: 'KeyF',
  pickup: 'KeyE',
  secondary: 'KeyV',
  scoreboard: 'Tab',
  pause: 'Escape',
};

export const DEFAULT_CONTROLLER_SETTINGS: ControllerSettings = {
  horizontalSensitivity: 1.0,
  verticalSensitivity: 1.0,
  aimDeadZone: 0.16,
  moveDeadZone: 0.18,
  aimAcceleration: 1.15,
  aimAssistStrength: 0.45,
  zoomSensitivity: 0.65,
  vibrationEnabled: true,
  invertY: false,
};

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  keyBindings: DEFAULT_KEY_BINDINGS,
  controller: DEFAULT_CONTROLLER_SETTINGS,
  audio: {
    masterVolume: 0.75,
    sfxVolume: 0.85,
    uiVolume: 0.65,
    muted: false,
  },
  splitScreenMode: 'dynamic',
  splitOrientation: 'vertical',
  showControlsHints: true,
};

export interface ConnectedGamepadInfo {
  index: number;
  id: string;
  label: string;
}

export interface MenuNavState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  back: boolean;
  tabLeft: boolean;
  tabRight: boolean;
  rightStickX: number;
  rightStickY: number;
}

export class InputManager {
  private keysHeld = new Set<string>();
  private keysJustPressed = new Set<string>();

  private mouseScreenX = 0;
  private mouseScreenY = 0;
  private mouseLeftHeld = false;
  private mouseLeftJustPressed = false;
  private mouseRightHeld = false;
  private mouseWheelDelta = 0;

  private prevGamepadButtons = new Map<number, boolean[]>();
  private lastAimAngle = new Map<string, number>();
  private settings: GameSettings;

  private onGamepadChange?: (pads: ConnectedGamepadInfo[], eventMsg?: string) => void;
  private pauseRequestedCallback?: () => void;

  constructor(settings: GameSettings) {
    this.settings = settings;
    this.bindWindowEvents();
  }

  public updateSettings(settings: GameSettings): void {
    this.settings = settings;
  }

  public setCallbacks(
    onGamepadChange?: (pads: ConnectedGamepadInfo[], eventMsg?: string) => void,
    onPauseRequested?: () => void
  ): void {
    this.onGamepadChange = onGamepadChange;
    this.pauseRequestedCallback = onPauseRequested;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    if (!this.keysHeld.has(e.code)) {
      this.keysJustPressed.add(e.code);
    }
    this.keysHeld.add(e.code);

    if (e.code === this.settings.keyBindings.pause) {
      this.pauseRequestedCallback?.();
    }
    if (e.code === 'Space' || e.code === 'Tab') {
      e.preventDefault();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);
  };

  private handleMouseMove = (e: MouseEvent): void => {
    this.mouseScreenX = e.clientX;
    this.mouseScreenY = e.clientY;
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) {
      if (!this.mouseLeftHeld) this.mouseLeftJustPressed = true;
      this.mouseLeftHeld = true;
    } else if (e.button === 2) {
      this.mouseRightHeld = true;
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseLeftHeld = false;
    else if (e.button === 2) this.mouseRightHeld = false;
  };

  private handleWheel = (e: WheelEvent): void => {
    if (Math.abs(e.deltaY) > 4) {
      this.mouseWheelDelta += Math.sign(e.deltaY);
    }
  };

  private handleBlur = (): void => {
    this.keysHeld.clear();
    this.keysJustPressed.clear();
    this.mouseLeftHeld = false;
    this.mouseRightHeld = false;
  };

  private handleGamepadConnected = (e: GamepadEvent): void => {
    const pads = this.getConnectedGamepads();
    this.onGamepadChange?.(pads, `Xbox / Gamepad Connected: ${this.formatPadLabel(e.gamepad)}`);
  };

  private handleGamepadDisconnected = (e: GamepadEvent): void => {
    this.prevGamepadButtons.delete(e.gamepad.index);
    const pads = this.getConnectedGamepads();
    this.onGamepadChange?.(pads, `Controller Disconnected: ${this.formatPadLabel(e.gamepad)}`);
  };

  private bindWindowEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('wheel', this.handleWheel, { passive: true });
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('gamepadconnected', this.handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('gamepadconnected', this.handleGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
  }

  private formatPadLabel(gp: Gamepad): string {
    const clean = gp.id.replace(/\s*\(.*?\)\s*/g, '').trim();
    return clean.slice(0, 26) || `Controller ${gp.index + 1}`;
  }

  public getConnectedGamepads(): ConnectedGamepadInfo[] {
    if (!navigator.getGamepads) return [];
    const list = navigator.getGamepads();
    const out: ConnectedGamepadInfo[] = [];
    for (let i = 0; i < list.length; i++) {
      const gp = list[i];
      if (gp && gp.connected) {
        out.push({
          index: gp.index,
          id: gp.id,
          label: this.formatPadLabel(gp),
        });
      }
    }
    return out;
  }

  private getGamepadAtSlot(slotIndex: number): Gamepad | null {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const connected: Gamepad[] = [];
    for (let i = 0; i < pads.length; i++) {
      const gp = pads[i];
      if (gp && gp.connected) connected.push(gp);
    }
    return connected[slotIndex] || null;
  }

  private pollPadButtons(gp: Gamepad): { held: boolean[]; just: boolean[] } {
    const prev = this.prevGamepadButtons.get(gp.index) || [];
    const held: boolean[] = [];
    const just: boolean[] = [];
    for (let i = 0; i < gp.buttons.length; i++) {
      const b = gp.buttons[i];
      const isPressed = b.pressed || b.value > 0.35;
      held[i] = isPressed;
      just[i] = isPressed && !prev[i];
    }
    this.prevGamepadButtons.set(gp.index, held);
    return { held, just };
  }

  public isScoreboardHeld(assignment: InputDeviceAssignment): boolean {
    if (assignment === 'kb_mouse') {
      if (this.keysHeld.has(this.settings.keyBindings.scoreboard)) return true;
    }
    if (assignment === 'gamepad_0' || assignment === 'gamepad_1') {
      const slot = assignment === 'gamepad_0' ? 0 : 1;
      const gp = this.getGamepadAtSlot(slot);
      if (gp && (gp.buttons[8]?.pressed || gp.buttons[8]?.value > 0.5)) return true;
    }
    return false;
  }

  public pollMenuNavigation(): MenuNavState {
    const nav: MenuNavState = {
      up: false,
      down: false,
      left: false,
      right: false,
      confirm: false,
      back: false,
      tabLeft: false,
      tabRight: false,
      rightStickX: 0,
      rightStickY: 0,
    };

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < pads.length; i++) {
      const gp = pads[i];
      if (!gp || !gp.connected) continue;
      const { just } = this.pollPadButtons(gp);

      if (just[12] || (gp.axes[1] < -0.65 && !this.keysHeld.has('_gp_up_' + i))) {
        nav.up = true;
      }
      if (just[13] || (gp.axes[1] > 0.65 && !this.keysHeld.has('_gp_dn_' + i))) {
        nav.down = true;
      }
      if (just[14] || (gp.axes[0] < -0.65 && !this.keysHeld.has('_gp_lt_' + i))) {
        nav.left = true;
      }
      if (just[15] || (gp.axes[0] > 0.65 && !this.keysHeld.has('_gp_rt_' + i))) {
        nav.right = true;
      }

      if (gp.axes[1] < -0.65) this.keysHeld.add('_gp_up_' + i);
      else this.keysHeld.delete('_gp_up_' + i);
      if (gp.axes[1] > 0.65) this.keysHeld.add('_gp_dn_' + i);
      else this.keysHeld.delete('_gp_dn_' + i);
      if (gp.axes[0] < -0.65) this.keysHeld.add('_gp_lt_' + i);
      else this.keysHeld.delete('_gp_lt_' + i);
      if (gp.axes[0] > 0.65) this.keysHeld.add('_gp_rt_' + i);
      else this.keysHeld.delete('_gp_rt_' + i);

      if (just[0]) nav.confirm = true;
      if (just[1]) nav.back = true;
      if (just[4]) nav.tabLeft = true;
      if (just[5]) nav.tabRight = true;
      if (just[9]) nav.confirm = true;

      const rx = Math.abs(gp.axes[2] || 0) > 0.2 ? gp.axes[2] : 0;
      const ry = Math.abs(gp.axes[3] || 0) > 0.2 ? gp.axes[3] : 0;
      nav.rightStickX += rx;
      nav.rightStickY += ry;
    }

    this.keysJustPressed.clear();
    this.mouseLeftJustPressed = false;
    this.mouseWheelDelta = 0;
    return nav;
  }

  public samplePlayerInput(
    player: PlayerState,
    assignment: InputDeviceAssignment,
    allPlayers: PlayerState[],
    screenToWorldAim: (screenX: number, screenY: number, px: number, py: number) => number
  ): { frame: PlayerInputFrame; pauseJustPressed: boolean; scoreboardHeld: boolean } {
    const kb = this.settings.keyBindings;
    const cs = this.settings.controller;
    let pauseJustPressed = false;
    let scoreboardHeld = false;

    const frame: PlayerInputFrame = {
      playerId: player.id,
      moveX: 0,
      moveY: 0,
      aimAngle: this.lastAimAngle.get(player.id) ?? player.aimAngle,
      aimActive: false,
      jumpHeld: false,
      jumpJustPressed: false,
      fireHeld: false,
      fireJustPressed: false,
      zoomHeld: false,
      manualZoomDelta: 0,
      reloadJustPressed: false,
      pickupJustPressed: false,
      switchWeaponJustPressed: false,
      grenadeJustPressed: false,
      cycleGrenadeJustPressed: false,
      meleeJustPressed: false,
      secondaryJustPressed: false,
    };

    if (assignment === 'kb_mouse') {
      const left = this.keysHeld.has(kb.left) ? 1 : 0;
      const right = this.keysHeld.has(kb.right) ? 1 : 0;
      frame.moveX = right - left;
      frame.moveY = this.keysHeld.has(kb.down) ? -1 : 0;

      frame.jumpHeld = this.keysHeld.has(kb.jump);
      frame.jumpJustPressed = this.keysJustPressed.has(kb.jump);
      frame.fireHeld = this.mouseLeftHeld;
      frame.fireJustPressed = this.mouseLeftJustPressed;
      frame.zoomHeld = this.mouseRightHeld;
      frame.manualZoomDelta = this.mouseWheelDelta;

      frame.reloadJustPressed = this.keysJustPressed.has(kb.reload);
      frame.pickupJustPressed = this.keysJustPressed.has(kb.pickup);
      frame.switchWeaponJustPressed = this.keysJustPressed.has(kb.switchWeapon);
      frame.grenadeJustPressed = this.keysJustPressed.has(kb.grenade);
      frame.cycleGrenadeJustPressed = this.keysJustPressed.has('KeyC');
      frame.meleeJustPressed = this.keysJustPressed.has(kb.melee);
      frame.secondaryJustPressed = this.keysJustPressed.has(kb.secondary);
      scoreboardHeld = this.keysHeld.has(kb.scoreboard);

      frame.aimAngle = screenToWorldAim(
        this.mouseScreenX,
        this.mouseScreenY,
        player.x,
        player.y + PLAYER_CENTER_Y
      );
      frame.aimActive = true;
    } else if (assignment === 'kb_arrows') {
      const left = this.keysHeld.has('ArrowLeft') ? 1 : 0;
      const right = this.keysHeld.has('ArrowRight') ? 1 : 0;
      frame.moveX = right - left;
      frame.moveY = this.keysHeld.has('ArrowDown') ? -1 : 0;
      frame.jumpHeld = this.keysHeld.has('ArrowUp') || this.keysHeld.has('Numpad0');
      frame.jumpJustPressed =
        this.keysJustPressed.has('ArrowUp') || this.keysJustPressed.has('Numpad0');
      frame.fireHeld = this.keysHeld.has('Enter') || this.keysHeld.has('Numpad1');
      frame.fireJustPressed =
        this.keysJustPressed.has('Enter') || this.keysJustPressed.has('Numpad1');
      frame.zoomHeld = this.keysHeld.has('ShiftRight');
      frame.reloadJustPressed = this.keysJustPressed.has('Numpad2') || this.keysJustPressed.has('KeyP');
      frame.pickupJustPressed = this.keysJustPressed.has('Numpad2') || this.keysJustPressed.has('KeyP');
      frame.switchWeaponJustPressed =
        this.keysJustPressed.has('Numpad3') || this.keysJustPressed.has('BracketLeft');
      frame.grenadeJustPressed =
        this.keysJustPressed.has('Numpad4') || this.keysJustPressed.has('BracketRight');
      frame.meleeJustPressed =
        this.keysJustPressed.has('Numpad5') || this.keysJustPressed.has('Backslash');

      // Auto-orient aim in movement direction or toward nearest enemy for arrow fallback
      if (frame.moveX !== 0) {
        frame.aimAngle = frame.moveX > 0 ? 0 : Math.PI;
      }
      const assisted = this.applyAimAssist(player, frame.aimAngle, allPlayers, 0.85);
      frame.aimAngle = assisted;
    }

    // Check assigned Gamepad OR allow controller #0 to work simultaneously with kb_mouse in 1P
    const padSlot =
      assignment === 'gamepad_0'
        ? 0
        : assignment === 'gamepad_1'
        ? 1
        : assignment === 'kb_mouse'
        ? 0
        : -1;

    if (padSlot >= 0) {
      const gp = this.getGamepadAtSlot(padSlot);
      if (gp) {
        const { held, just } = this.pollPadButtons(gp);
        const lx = gp.axes[0] || 0;
        const ly = gp.axes[1] || 0;
        if (Math.abs(lx) > cs.moveDeadZone) {
          const norm = (Math.abs(lx) - cs.moveDeadZone) / (1 - cs.moveDeadZone);
          frame.moveX = Math.sign(lx) * Math.min(1, norm);
        }
        if (Math.abs(ly) > cs.moveDeadZone) {
          frame.moveY = -Math.sign(ly) * Math.min(1, Math.abs(ly));
        }

        // Right Stick Dual-Stick Aiming
        const rawRx = gp.axes[2] || 0;
        const rawRy = (gp.axes[3] || 0) * (cs.invertY ? -1 : 1);
        const mag = Math.hypot(rawRx, rawRy);
        if (mag > cs.aimDeadZone) {
          const scaledMag = Math.pow(
            (mag - cs.aimDeadZone) / (1 - cs.aimDeadZone),
            cs.aimAcceleration
          );
          const zoomMult = held[6] ? cs.zoomSensitivity : 1.0;
          const ax = (rawRx / mag) * scaledMag * cs.horizontalSensitivity * zoomMult;
          const ay = (-rawRy / mag) * scaledMag * cs.verticalSensitivity * zoomMult;
          let targetAngle = Math.atan2(ay, ax);
          targetAngle = this.applyAimAssist(
            player,
            targetAngle,
            allPlayers,
            cs.aimAssistStrength
          );
          frame.aimAngle = targetAngle;
          frame.aimActive = true;
        } else if (assignment !== 'kb_mouse') {
          frame.aimAngle = this.lastAimAngle.get(player.id) ?? (frame.moveX < 0 ? Math.PI : 0);
        }

        // Xbox Mapping:
        // A (0): Jump / Hold Jetpack
        if (held[0]) frame.jumpHeld = true;
        if (just[0]) frame.jumpJustPressed = true;
        // B (1): Melee
        if (just[1]) frame.meleeJustPressed = true;
        // X (2): Context-sensitive Reload / Pickup
        if (just[2]) {
          if (player.nearbyPickupId) frame.pickupJustPressed = true;
          else frame.reloadJustPressed = true;
        }
        // Y (3): Switch Weapon
        if (just[3]) frame.switchWeaponJustPressed = true;
        // LB (4): Secondary weapon function
        if (just[4]) frame.secondaryJustPressed = true;
        // RB (5): Throw Grenade
        if (just[5]) frame.grenadeJustPressed = true;
        // LT (6): Zoom / Aim precision
        if (held[6] || (gp.buttons[6]?.value ?? 0) > 0.25) frame.zoomHeld = true;
        // RT (7): Fire weapon
        if (held[7] || (gp.buttons[7]?.value ?? 0) > 0.25) frame.fireHeld = true;
        if (just[7]) frame.fireJustPressed = true;
        // View/Back (8): Scoreboard
        if (held[8]) scoreboardHeld = true;
        // Start/Menu (9): Pause
        if (just[9]) {
          pauseJustPressed = true;
          this.pauseRequestedCallback?.();
        }
        // D-Pad Up/Down (12, 13): Manual Zoom
        if (just[12]) frame.manualZoomDelta -= 1;
        if (just[13]) frame.manualZoomDelta += 1;
        // D-Pad Left/Right (14, 15): Cycle grenade
        if (just[14] || just[15]) frame.cycleGrenadeJustPressed = true;
      }
    }

    this.lastAimAngle.set(player.id, frame.aimAngle);
    return { frame, pauseJustPressed, scoreboardHeld };
  }

  public endFrame(): void {
    this.keysJustPressed.clear();
    this.mouseLeftJustPressed = false;
    this.mouseWheelDelta = 0;
  }

  private applyAimAssist(
    player: PlayerState,
    aimAngle: number,
    allPlayers: PlayerState[],
    strength: number
  ): number {
    if (strength <= 0.02) return aimAngle;
    const px = player.x;
    const py = player.y + PLAYER_CENTER_Y;
    let bestAngle = aimAngle;
    let bestDiff = 0.34; // ~20 degree cone

    for (const target of allPlayers) {
      if (!target.alive || target.id === player.id) continue;
      if (player.team !== 0 && target.team === player.team) continue;
      const dist = Math.hypot(target.x - px, target.y + PLAYER_CENTER_Y - py);
      if (dist > 28) continue;

      const toEnemy = Math.atan2(target.y + PLAYER_CENTER_Y - py, target.x - px);
      let diff = toEnemy - aimAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      if (Math.abs(diff) < bestDiff) {
        bestDiff = Math.abs(diff);
        bestAngle = aimAngle + diff * strength * 0.45;
      }
    }
    return bestAngle;
  }

  public triggerVibration(
    assignment: InputDeviceAssignment,
    durationMs: number,
    weak: number,
    strong: number
  ): void {
    if (!this.settings.controller.vibrationEnabled) return;
    const slot =
      assignment === 'gamepad_1'
        ? 1
        : assignment === 'gamepad_0' || assignment === 'kb_mouse'
        ? 0
        : -1;
    if (slot < 0) return;
    const gp = this.getGamepadAtSlot(slot) as (Gamepad & {
      vibrationActuator?: {
        playEffect: (type: string, params: Record<string, number>) => Promise<void>;
      };
    }) | null;
    if (gp?.vibrationActuator?.playEffect) {
      gp.vibrationActuator
        .playEffect('dual-rumble', {
          startDelay: 0,
          duration: durationMs,
          weakMagnitude: Math.min(1, weak),
          strongMagnitude: Math.min(1, strong),
        })
        .catch(() => {});
    }
  }
}
