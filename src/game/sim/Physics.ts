import { MapData, PlatformBox } from '../types';

export const PLAYER_RADIUS = 0.44;
export const PLAYER_HEIGHT = 1.78;
export const PLAYER_CENTER_Y = PLAYER_HEIGHT * 0.5;
export const MUZZLE_CENTER_Y = 1.15;
export const MUZZLE_REACH = 0.92;

export const PHYSICS = {
  gravity: 27,
  maxRunSpeed: 12.0,
  groundAccel: 88,
  groundDecel: 72,
  airAccel: 54,
  airDecel: 14,
  jumpVelocity: 13.4,
  coyoteTime: 0.11,
  jetpackThrust: 46,
  maxRiseVel: 14.0,
  maxFallVel: -22,
  maxFuel: 100,
  fuelBurnPerSec: 36,
  fuelRecoverPerSec: 36,
  fuelRecoverDelay: 0.5,
};

export interface RayHit3D {
  t: number;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

export function aimAnglesToVector(
  yaw: number,
  pitch: number
): { dx: number; dy: number; dz: number } {
  const cp = Math.cos(pitch);
  return {
    dx: -Math.sin(yaw) * cp,
    dy: Math.sin(pitch),
    dz: -Math.cos(yaw) * cp,
  };
}

/**
 * Continuous 3D line-segment vs AABB intersection (returns t in [0, 1] or null).
 */
export function segmentIntersectsBox3D(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  bx: number,
  by: number,
  bz: number,
  bw: number,
  bh: number,
  bd: number
): RayHit3D | null {
  const minX = bx - bw * 0.5;
  const maxX = bx + bw * 0.5;
  const minY = by - bh * 0.5;
  const maxY = by + bh * 0.5;
  const minZ = bz - bd * 0.5;
  const maxZ = bz + bd * 0.5;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;

  let tmin = 0;
  let tmax = 1;
  let nx = 0;
  let ny = 0;
  let nz = 0;

  // X slab
  if (Math.abs(dx) < 1e-8) {
    if (x1 < minX || x1 > maxX) return null;
  } else {
    const inv = 1 / dx;
    let t1 = (minX - x1) * inv;
    let t2 = (maxX - x1) * inv;
    let sign = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      sign = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      nx = sign;
      ny = 0;
      nz = 0;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }

  // Y slab
  if (Math.abs(dy) < 1e-8) {
    if (y1 < minY || y1 > maxY) return null;
  } else {
    const inv = 1 / dy;
    let t1 = (minY - y1) * inv;
    let t2 = (maxY - y1) * inv;
    let sign = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      sign = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      nx = 0;
      ny = sign;
      nz = 0;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }

  // Z slab
  if (Math.abs(dz) < 1e-8) {
    if (z1 < minZ || z1 > maxZ) return null;
  } else {
    const inv = 1 / dz;
    let t1 = (minZ - z1) * inv;
    let t2 = (maxZ - z1) * inv;
    let sign = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      sign = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      nx = 0;
      ny = 0;
      nz = sign;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }

  return {
    t: tmin,
    x: x1 + dx * tmin,
    y: y1 + dy * tmin,
    z: z1 + dz * tmin,
    nx,
    ny,
    nz,
  };
}

export function raycastSolidPlatforms3D(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  platforms: PlatformBox[]
): RayHit3D | null {
  let best: RayHit3D | null = null;
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    const hit = segmentIntersectsBox3D(x1, y1, z1, x2, y2, z2, p.x, p.y, p.z, p.w, p.h, p.d);
    if (hit && (!best || hit.t < best.t)) {
      best = hit;
    }
  }
  return best;
}

export function hasLineOfSight3D(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  platforms: PlatformBox[]
): boolean {
  return raycastSolidPlatforms3D(x1, y1, z1, x2, y2, z2, platforms) === null;
}

/**
 * Sub-stepped 3D AABB collision resolution so players never tunnel through or get stuck inside map geometry.
 */
export function resolveCharacterMapCollision3D(
  state: { x: number; y: number; z: number; vx: number; vy: number; vz: number; grounded: boolean },
  map: MapData,
  dt: number
): { landed: boolean } {
  let landed = false;
  const wasGrounded = state.grounded;
  state.grounded = false;

  const totalDisp = Math.max(
    Math.abs(state.vx * dt),
    Math.abs(state.vy * dt),
    Math.abs(state.vz * dt)
  );
  const subSteps = Math.max(1, Math.min(8, Math.ceil(totalDisp / 0.18)));
  const subDt = dt / subSteps;

  const halfW = map.width * 0.5 - PLAYER_RADIUS;
  const halfD = map.depth * 0.5 - PLAYER_RADIUS;

  for (let step = 0; step < subSteps; step++) {
    // 1. X axis
    state.x += state.vx * subDt;
    if (state.x < -halfW) {
      state.x = -halfW;
      if (state.vx < 0) state.vx = 0;
    } else if (state.x > halfW) {
      state.x = halfW;
      if (state.vx > 0) state.vx = 0;
    }
    for (let i = 0; i < map.platforms.length; i++) {
      const p = map.platforms[i];
      const pMinY = p.y - p.h * 0.5;
      const pMaxY = p.y + p.h * 0.5;
      const pMinZ = p.z - p.d * 0.5;
      const pMaxZ = p.z + p.d * 0.5;
      if (
        state.y + PLAYER_HEIGHT - 0.04 > pMinY &&
        state.y + 0.04 < pMaxY &&
        state.z + PLAYER_RADIUS - 0.03 > pMinZ &&
        state.z - PLAYER_RADIUS + 0.03 < pMaxZ
      ) {
        const pMinX = p.x - p.w * 0.5;
        const pMaxX = p.x + p.w * 0.5;
        if (state.x + PLAYER_RADIUS > pMinX && state.x - PLAYER_RADIUS < pMaxX) {
          const penLeft = state.x + PLAYER_RADIUS - pMinX;
          const penRight = pMaxX - (state.x - PLAYER_RADIUS);
          if (penLeft < penRight) {
            state.x = pMinX - PLAYER_RADIUS;
            if (state.vx > 0) state.vx = 0;
          } else {
            state.x = pMaxX + PLAYER_RADIUS;
            if (state.vx < 0) state.vx = 0;
          }
        }
      }
    }

    // 2. Z axis
    state.z += state.vz * subDt;
    if (state.z < -halfD) {
      state.z = -halfD;
      if (state.vz < 0) state.vz = 0;
    } else if (state.z > halfD) {
      state.z = halfD;
      if (state.vz > 0) state.vz = 0;
    }
    for (let i = 0; i < map.platforms.length; i++) {
      const p = map.platforms[i];
      const pMinY = p.y - p.h * 0.5;
      const pMaxY = p.y + p.h * 0.5;
      const pMinX = p.x - p.w * 0.5;
      const pMaxX = p.x + p.w * 0.5;
      if (
        state.y + PLAYER_HEIGHT - 0.04 > pMinY &&
        state.y + 0.04 < pMaxY &&
        state.x + PLAYER_RADIUS - 0.03 > pMinX &&
        state.x - PLAYER_RADIUS + 0.03 < pMaxX
      ) {
        const pMinZ = p.z - p.d * 0.5;
        const pMaxZ = p.z + p.d * 0.5;
        if (state.z + PLAYER_RADIUS > pMinZ && state.z - PLAYER_RADIUS < pMaxZ) {
          const penFront = state.z + PLAYER_RADIUS - pMinZ;
          const penBack = pMaxZ - (state.z - PLAYER_RADIUS);
          if (penFront < penBack) {
            state.z = pMinZ - PLAYER_RADIUS;
            if (state.vz > 0) state.vz = 0;
          } else {
            state.z = pMaxZ + PLAYER_RADIUS;
            if (state.vz < 0) state.vz = 0;
          }
        }
      }
    }

    // 3. Y axis
    const prevY = state.y;
    state.y += state.vy * subDt;
    if (state.y + PLAYER_HEIGHT > map.ceilingY) {
      state.y = map.ceilingY - PLAYER_HEIGHT;
      if (state.vy > 0) state.vy = 0;
    }

    for (let i = 0; i < map.platforms.length; i++) {
      const p = map.platforms[i];
      const pMinX = p.x - p.w * 0.5;
      const pMaxX = p.x + p.w * 0.5;
      const pMinZ = p.z - p.d * 0.5;
      const pMaxZ = p.z + p.d * 0.5;
      if (
        state.x + PLAYER_RADIUS - 0.03 <= pMinX ||
        state.x - PLAYER_RADIUS + 0.03 >= pMaxX ||
        state.z + PLAYER_RADIUS - 0.03 <= pMinZ ||
        state.z - PLAYER_RADIUS + 0.03 >= pMaxZ
      ) {
        continue;
      }

      const pMinY = p.y - p.h * 0.5;
      const pMaxY = p.y + p.h * 0.5;
      if (state.y < pMaxY && state.y + PLAYER_HEIGHT > pMinY) {
        if (state.vy <= 0 && prevY >= pMaxY - 0.25) {
          state.y = pMaxY;
          state.vy = 0;
          state.grounded = true;
          if (!wasGrounded) landed = true;
        } else if (state.vy > 0 && prevY + PLAYER_HEIGHT <= pMinY + 0.25) {
          state.y = pMinY - PLAYER_HEIGHT;
          state.vy = 0;
        } else {
          const penTop = pMaxY - state.y;
          const penBot = state.y + PLAYER_HEIGHT - pMinY;
          if (penTop <= penBot) {
            state.y = pMaxY;
            if (state.vy < 0) state.vy = 0;
            state.grounded = true;
          } else {
            state.y = pMinY - PLAYER_HEIGHT;
            if (state.vy > 0) state.vy = 0;
          }
        }
      }
    }
  }

  return { landed };
}
