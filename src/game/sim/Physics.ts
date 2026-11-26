import { MapData, PlatformRect } from '../types';

export const PLAYER_HALF_W = 0.42;
export const PLAYER_HEIGHT = 1.75;
export const PLAYER_CENTER_Y = PLAYER_HEIGHT * 0.5;
export const MUZZLE_CENTER_Y = 1.08;
export const MUZZLE_REACH = 0.88;

export const PHYSICS = {
  gravity: 28,
  maxRunSpeed: 11.8,
  groundAccel: 88,
  groundDecel: 72,
  airAccel: 54,
  airDecel: 14,
  jumpVelocity: 13.2,
  coyoteTime: 0.11,
  jetpackThrust: 47,
  maxRiseVel: 13.8,
  maxFallVel: -21,
  maxFuel: 100,
  fuelBurnPerSec: 38,
  fuelRecoverPerSec: 36,
  fuelRecoverDelay: 0.55,
};

export interface RayHit {
  t: number;
  x: number;
  y: number;
  nx: number;
  ny: number;
}

/**
 * Continuous line-segment vs AABB intersection (returns t in [0, 1] or null)
 */
export function segmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): RayHit | null {
  const minX = rx - rw * 0.5;
  const maxX = rx + rw * 0.5;
  const minY = ry - rh * 0.5;
  const maxY = ry + rh * 0.5;

  const dx = x2 - x1;
  const dy = y2 - y1;

  let tmin = 0;
  let tmax = 1;
  let nx = 0;
  let ny = 0;

  if (Math.abs(dx) < 1e-8) {
    if (x1 < minX || x1 > maxX) return null;
  } else {
    const invD = 1 / dx;
    let t1 = (minX - x1) * invD;
    let t2 = (maxX - x1) * invD;
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
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }

  if (Math.abs(dy) < 1e-8) {
    if (y1 < minY || y1 > maxY) return null;
  } else {
    const invD = 1 / dy;
    let t1 = (minY - y1) * invD;
    let t2 = (maxY - y1) * invD;
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
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }

  return {
    t: tmin,
    x: x1 + dx * tmin,
    y: y1 + dy * tmin,
    nx,
    ny,
  };
}

export function raycastSolidPlatforms(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  platforms: PlatformRect[]
): RayHit | null {
  let best: RayHit | null = null;
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (p.oneWay) continue; // Bullets pass through thin catwalk grates
    const hit = segmentIntersectsRect(x1, y1, x2, y2, p.x, p.y, p.w, p.h);
    if (hit && (!best || hit.t < best.t)) {
      best = hit;
    }
  }
  return best;
}

export function hasLineOfSight(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  platforms: PlatformRect[]
): boolean {
  return raycastSolidPlatforms(x1, y1, x2, y2, platforms) === null;
}

export function resolveCharacterMapCollision(
  state: { x: number; y: number; vx: number; vy: number; grounded: boolean },
  prevY: number,
  dropThrough: boolean,
  map: MapData,
  dt: number
): { landed: boolean } {
  let landed = false;
  const wasGrounded = state.grounded;
  state.grounded = false;

  // Horizontal integration + solid wall resolution
  state.x += state.vx * dt;
  const halfMapW = map.width * 0.5 - PLAYER_HALF_W;
  if (state.x < -halfMapW) {
    state.x = -halfMapW;
    state.vx = 0;
  } else if (state.x > halfMapW) {
    state.x = halfMapW;
    state.vx = 0;
  }

  for (let i = 0; i < map.platforms.length; i++) {
    const p = map.platforms[i];
    if (p.oneWay) continue;
    const pLeft = p.x - p.w * 0.5;
    const pRight = p.x + p.w * 0.5;
    const pBottom = p.y - p.h * 0.5;
    const pTop = p.y + p.h * 0.5;

    const cBottom = state.y + 0.05;
    const cTop = state.y + PLAYER_HEIGHT - 0.05;
    if (cTop > pBottom && cBottom < pTop) {
      if (state.x + PLAYER_HALF_W > pLeft && state.x - PLAYER_HALF_W < pRight) {
        const overlapLeft = state.x + PLAYER_HALF_W - pLeft;
        const overlapRight = pRight - (state.x - PLAYER_HALF_W);
        if (overlapLeft < overlapRight) {
          state.x = pLeft - PLAYER_HALF_W;
          if (state.vx > 0) state.vx = 0;
        } else {
          state.x = pRight + PLAYER_HALF_W;
          if (state.vx < 0) state.vx = 0;
        }
      }
    }
  }

  // Vertical integration + platform resolution
  state.y += state.vy * dt;

  // Ceiling cap
  if (state.y + PLAYER_HEIGHT > map.ceilingY) {
    state.y = map.ceilingY - PLAYER_HEIGHT;
    if (state.vy > 0) state.vy = 0;
  }

  for (let i = 0; i < map.platforms.length; i++) {
    const p = map.platforms[i];
    const pLeft = p.x - p.w * 0.5;
    const pRight = p.x + p.w * 0.5;
    const pBottom = p.y - p.h * 0.5;
    const pTop = p.y + p.h * 0.5;

    if (state.x + PLAYER_HALF_W <= pLeft + 0.02 || state.x - PLAYER_HALF_W >= pRight - 0.02) {
      continue;
    }

    if (p.oneWay) {
      if (!dropThrough && state.vy <= 0 && prevY >= pTop - 0.14 && state.y <= pTop) {
        state.y = pTop;
        state.vy = 0;
        state.grounded = true;
        if (!wasGrounded) landed = true;
      }
      continue;
    }

    // Solid platform top/bottom
    if (state.y < pTop && state.y + PLAYER_HEIGHT > pBottom) {
      if (state.vy <= 0 && prevY >= pTop - 0.25) {
        state.y = pTop;
        state.vy = 0;
        state.grounded = true;
        if (!wasGrounded) landed = true;
      } else if (state.vy > 0 && prevY + PLAYER_HEIGHT <= pBottom + 0.25) {
        state.y = pBottom - PLAYER_HEIGHT;
        state.vy = 0;
      }
    }
  }

  return { landed };
}
