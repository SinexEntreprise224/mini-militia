import * as THREE from 'three';
import { WEAPONS } from '../data/weapons';
import { aimAnglesToVector, raycastSolidPlatforms3D } from '../sim/Physics';
import { MapData, PlayerState, SplitScreenMode } from '../types';

interface CamRuntimeState {
  posX: number;
  posY: number;
  posZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
  fov: number;
  armDist: number;
  initialized: boolean;
}

const SPLIT_ENTER_DIST = 12.0;
const SPLIT_EXIT_DIST = 9.0;

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

export class CameraSystem {
  public readonly camP1: THREE.PerspectiveCamera;
  public readonly camP2: THREE.PerspectiveCamera;

  private p1State: CamRuntimeState = {
    posX: 0,
    posY: 6,
    posZ: 12,
    lookX: 0,
    lookY: 5,
    lookZ: 0,
    fov: 60,
    armDist: 5.2,
    initialized: false,
  };
  private p2State: CamRuntimeState = {
    posX: 0,
    posY: 6,
    posZ: 12,
    lookX: 0,
    lookY: 5,
    lookZ: 0,
    fov: 60,
    armDist: 5.2,
    initialized: false,
  };
  private splitActive = false;

  constructor(aspect: number) {
    this.camP1 = new THREE.PerspectiveCamera(60, aspect, 0.2, 260);
    this.camP2 = new THREE.PerspectiveCamera(60, aspect, 0.2, 260);
    this.camP1.position.set(0, 6, 12);
    this.camP2.position.set(0, 6, 12);
  }

  public isSplitScreenActive(): boolean {
    return this.splitActive;
  }

  public getPlayerZoomInfo(slot: 0 | 1): { distance: number; label: string } {
    const st = slot === 0 ? this.p1State : this.p2State;
    const pct = Math.round((60 / Math.max(20, st.fov)) * 100);
    const label = st.fov < 44 ? 'OPTIC' : st.armDist > 6.5 ? 'WIDE' : st.armDist < 4.4 ? 'CLOSE' : 'STD';
    return { distance: pct, label };
  }

  private computeChaseTargetForPlayer(
    player: PlayerState,
    allPlayers: PlayerState[],
    map: MapData
  ): {
    posX: number;
    posY: number;
    posZ: number;
    lookX: number;
    lookY: number;
    lookZ: number;
    fov: number;
    armDist: number;
  } {
    const activeWeapon = player.weapons[player.activeSlot];
    const spec = WEAPONS[activeWeapon ? activeWeapon.weaponId : 'pistol'];
    const profile = spec.zoomProfile;

    let targetArm = player.zoomHeld ? profile.aimZoom : profile.baseZoom;
    targetArm = THREE.MathUtils.clamp(targetArm + player.manualZoomOffset * 0.45, 2.3, 10.5);

    const targetFov = player.zoomHeld ? profile.aimFov ?? 46 : profile.baseFov ?? 60;

    // Subtle zoom out in hectic close brawls
    let nearEnemies = 0;
    for (let i = 0; i < allPlayers.length; i++) {
      const other = allPlayers[i];
      if (!other.alive || other.id === player.id) continue;
      if (player.team !== 0 && other.team === player.team) continue;
      const d = Math.hypot(other.x - player.x, other.y - player.y, other.z - player.z);
      if (d < 12) nearEnemies++;
    }
    if (!player.zoomHeld && nearEnemies > 1) {
      targetArm = Math.min(10.5, targetArm + 0.6);
    }

    const dir = aimAnglesToVector(player.aimYaw, player.aimPitch);
    // Horizontal right vector relative to aimYaw (0 = -Z, right = +X)
    const rightX = Math.cos(player.aimYaw);
    const rightZ = -Math.sin(player.aimYaw);
    const shoulder = player.zoomHeld ? 0.56 : 0.68;

    // Pivot near head/shoulder so raycast stays inside walkable corridor
    const pivotX = player.x + rightX * shoulder * 0.65;
    const pivotY = player.y + 1.54;
    const pivotZ = player.z + rightZ * shoulder * 0.65;

    // Ideal camera position behind player gaze + slight vertical lift
    let idealX = player.x + rightX * shoulder - dir.dx * targetArm;
    let idealY = pivotY + 0.36 - dir.dy * targetArm;
    let idealZ = player.z + rightZ * shoulder - dir.dz * targetArm;

    // Keep within outer arena shell bounds (just inside perimeter wall faces)
    const maxBoundX = map.width * 0.5 - 0.55;
    const maxBoundZ = map.depth * 0.5 - 0.55;
    idealX = THREE.MathUtils.clamp(idealX, -maxBoundX, maxBoundX);
    idealZ = THREE.MathUtils.clamp(idealZ, -maxBoundZ, maxBoundZ);
    idealY = THREE.MathUtils.clamp(idealY, map.floorY + 0.55, map.ceilingY - 0.45);

    // Raycast against solid platforms & walls so camera NEVER clips into geometry
    const hit = raycastSolidPlatforms3D(
      pivotX,
      pivotY,
      pivotZ,
      idealX,
      idealY,
      idealZ,
      map.platforms
    );

    let posX = idealX;
    let posY = idealY;
    let posZ = idealZ;
    if (hit) {
      const safeT = Math.max(0.18, hit.t * 0.86);
      posX = pivotX + (idealX - pivotX) * safeT + hit.nx * 0.12;
      posY = pivotY + (idealY - pivotY) * safeT + hit.ny * 0.12;
      posZ = pivotZ + (idealZ - pivotZ) * safeT + hit.nz * 0.12;
    }

    // Look point far along exact crosshair ray from the shoulder/eye pivot
    const lookDist = 36;
    const lookX = pivotX + dir.dx * lookDist;
    const lookY = pivotY + dir.dy * lookDist;
    const lookZ = pivotZ + dir.dz * lookDist;

    return {
      posX,
      posY,
      posZ,
      lookX,
      lookY,
      lookZ,
      fov: targetFov,
      armDist: targetArm,
    };
  }

  private dampState(
    state: CamRuntimeState,
    target: ReturnType<CameraSystem['computeChaseTargetForPlayer']>,
    dt: number
  ): void {
    if (!state.initialized || dt <= 0) {
      state.posX = target.posX;
      state.posY = target.posY;
      state.posZ = target.posZ;
      state.lookX = target.lookX;
      state.lookY = target.lookY;
      state.lookZ = target.lookZ;
      state.fov = target.fov;
      state.armDist = target.armDist;
      state.initialized = true;
      return;
    }

    state.posX = THREE.MathUtils.damp(state.posX, target.posX, 16, dt);
    state.posY = THREE.MathUtils.damp(state.posY, target.posY, 16, dt);
    state.posZ = THREE.MathUtils.damp(state.posZ, target.posZ, 16, dt);
    state.lookX = THREE.MathUtils.damp(state.lookX, target.lookX, 24, dt);
    state.lookY = THREE.MathUtils.damp(state.lookY, target.lookY, 24, dt);
    state.lookZ = THREE.MathUtils.damp(state.lookZ, target.lookZ, 24, dt);
    state.fov = THREE.MathUtils.damp(state.fov, target.fov, 11, dt);
    state.armDist = THREE.MathUtils.damp(state.armDist, target.armDist, 10, dt);
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
        const tgt = this.computeChaseTargetForPlayer(p1, players, map);
        this.dampState(this.p1State, tgt, dt);
      }
      this.applyToCamera(this.camP1, this.p1State, width / Math.max(1, height), screenShake);
      return;
    }

    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
    const yawDiff = angleDiff(p1.aimYaw, p2.aimYaw);

    if (splitMode === 'always_split') {
      this.splitActive = true;
    } else if (splitMode === 'shared') {
      this.splitActive = false;
    } else {
      // Dynamic split-screen: merge when standing side-by-side looking similarly, split when separated or rotating independently
      if (!this.splitActive && (dist > SPLIT_ENTER_DIST || yawDiff > 0.78 || p1.zoomHeld || p2.zoomHeld)) {
        this.splitActive = true;
      } else if (this.splitActive && dist < SPLIT_EXIT_DIST && yawDiff < 0.45 && !p1.zoomHeld && !p2.zoomHeld) {
        this.splitActive = false;
      }
    }

    if (!this.splitActive) {
      // Shared framing camera oriented along average yaw
      const avgX = (p1.x + p2.x) * 0.5;
      const avgY = (p1.y + p2.y) * 0.5 + 1.5;
      const avgZ = (p1.z + p2.z) * 0.5;
      const avgDir = aimAnglesToVector(p1.aimYaw, p1.aimPitch * 0.6);
      const arm = Math.max(7.2, 6.2 + dist * 0.65);

      let idealX = avgX - avgDir.dx * arm;
      let idealY = avgY + 1.2 - avgDir.dy * arm;
      let idealZ = avgZ - avgDir.dz * arm;

      const hit = raycastSolidPlatforms3D(avgX, avgY, avgZ, idealX, idealY, idealZ, map.platforms);
      if (hit) {
        const safeT = Math.max(0.25, hit.t * 0.85);
        idealX = avgX + (idealX - avgX) * safeT;
        idealY = avgY + (idealY - avgY) * safeT;
        idealZ = avgZ + (idealZ - avgZ) * safeT;
      }

      const sharedTarget = {
        posX: idealX,
        posY: Math.max(map.floorY + 0.8, idealY),
        posZ: idealZ,
        lookX: avgX + avgDir.dx * 16,
        lookY: avgY + avgDir.dy * 16,
        lookZ: avgZ + avgDir.dz * 16,
        fov: 64,
        armDist: arm,
      };
      this.dampState(this.p1State, sharedTarget, dt);
      this.p2State = { ...this.p1State };
      this.applyToCamera(this.camP1, this.p1State, width / Math.max(1, height), screenShake);
    } else {
      // Independent 360-degree split-screen cameras for P1 and P2
      const t1 = this.computeChaseTargetForPlayer(p1, players, map);
      const t2 = this.computeChaseTargetForPlayer(p2, players, map);
      this.dampState(this.p1State, t1, dt);
      this.dampState(this.p2State, t2, dt);

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
    state: CamRuntimeState,
    aspect: number,
    shake: number
  ): void {
    let needsProj = false;
    if (Math.abs(cam.aspect - aspect) > 0.002) {
      cam.aspect = aspect;
      needsProj = true;
    }
    if (Math.abs(cam.fov - state.fov) > 0.08) {
      cam.fov = state.fov;
      needsProj = true;
    }
    if (needsProj) {
      cam.updateProjectionMatrix();
    }

    const sx = shake > 0 ? (Math.random() - 0.5) * shake * 0.65 : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * shake * 0.65 : 0;
    const sz = shake > 0 ? (Math.random() - 0.5) * shake * 0.65 : 0;

    cam.position.set(state.posX + sx, state.posY + sy, state.posZ + sz);
    cam.lookAt(state.lookX + sx * 0.3, state.lookY + sy * 0.3, state.lookZ + sz * 0.3);
  }
}
