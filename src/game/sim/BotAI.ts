import { WEAPONS } from '../data/weapons';
import {
  BotDifficulty,
  FlagState,
  GameMode,
  MapData,
  PickupState,
  PlayerInputFrame,
  PlayerState,
  ProjectileState,
} from '../types';
import { hasLineOfSight3D, PLAYER_CENTER_Y } from './Physics';

interface BotBrain {
  strafeDir: 1 | -1;
  wanderTimer: number;
  dodgeTimer: number;
  dodgeDir: number;
  jetPulseTimer: number;
}

const DIFFICULTY_PARAMS: Record<
  BotDifficulty,
  { aimError: number; turnSpeed: number; leadFactor: number; dodgeChance: number; jetSkill: number }
> = {
  easy: { aimError: 0.22, turnSpeed: 4.5, leadFactor: 0.25, dodgeChance: 0.15, jetSkill: 0.45 },
  normal: { aimError: 0.09, turnSpeed: 7.5, leadFactor: 0.65, dodgeChance: 0.48, jetSkill: 0.75 },
  hard: { aimError: 0.03, turnSpeed: 12.0, leadFactor: 0.95, dodgeChance: 0.85, jetSkill: 0.98 },
};

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class BotAIController {
  private brains = new Map<string, BotBrain>();

  private getBrain(id: string): BotBrain {
    let b = this.brains.get(id);
    if (!b) {
      b = {
        strafeDir: Math.random() > 0.5 ? 1 : -1,
        wanderTimer: 1.5,
        dodgeTimer: 0,
        dodgeDir: 0,
        jetPulseTimer: 0,
      };
      this.brains.set(id, b);
    }
    return b;
  }

  public computeInput(
    bot: PlayerState,
    allPlayers: PlayerState[],
    projectiles: ProjectileState[],
    pickups: PickupState[],
    flags: { team1: FlagState; team2: FlagState },
    map: MapData,
    mode: GameMode,
    dt: number
  ): PlayerInputFrame {
    const brain = this.getBrain(bot.id);
    const diff = DIFFICULTY_PARAMS[bot.botDifficulty || 'normal'];

    brain.wanderTimer -= dt;
    brain.dodgeTimer = Math.max(0, brain.dodgeTimer - dt);
    brain.jetPulseTimer = Math.max(0, brain.jetPulseTimer - dt);

    const input: PlayerInputFrame = {
      playerId: bot.id,
      moveX: 0,
      moveZ: 0,
      aimYaw: bot.aimYaw,
      aimPitch: bot.aimPitch,
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

    if (!bot.alive) return input;

    const bx = bot.x;
    const by = bot.y + PLAYER_CENTER_Y;
    const bz = bot.z;

    // 1. Incoming projectile dodge check in 3D
    if (brain.dodgeTimer <= 0 && Math.random() < diff.dodgeChance * dt * 12) {
      for (const pr of projectiles) {
        if (pr.ownerId === bot.id) continue;
        if ((mode === 'team_deathmatch' || mode === 'ctf') && pr.team !== 0 && pr.team === bot.team) {
          continue;
        }
        const dx = bx - pr.x;
        const dy = by - pr.y;
        const dz = bz - pr.z;
        if (dx * dx + dy * dy + dz * dz < 64) {
          if (dx * pr.vx + dy * pr.vy + dz * pr.vz > 0) {
            brain.dodgeTimer = 0.45;
            brain.dodgeDir = Math.random() > 0.5 ? 1 : -1;
            brain.jetPulseTimer = 0.28;
            break;
          }
        }
      }
    }

    // 2. Find best target in 3D
    let bestEnemy: PlayerState | null = null;
    let bestScore = Infinity;
    let bestLOS = false;

    for (const p of allPlayers) {
      if (!p.alive || p.id === bot.id) continue;
      if ((mode === 'team_deathmatch' || mode === 'ctf' || mode === 'survival') && p.team === bot.team) {
        continue;
      }
      const dist = Math.hypot(p.x - bx, p.y + PLAYER_CENTER_Y - by, p.z - bz);
      const los = hasLineOfSight3D(bx, by, bz, p.x, p.y + PLAYER_CENTER_Y, p.z, map.platforms);
      const score = dist * (los ? 0.55 : 1.4);
      if (score < bestScore) {
        bestScore = score;
        bestEnemy = p;
        bestLOS = los;
      }
    }

    // 3. Reload / swap / pickup awareness
    const activeSlot = bot.weapons[bot.activeSlot]!;
    const activeSpec = WEAPONS[activeSlot.weaponId];
    if (activeSlot.magAmmo === 0 && !bot.reloading) {
      if (activeSlot.reserveAmmo > 0) input.reloadJustPressed = true;
      else if (bot.weapons[1]) input.switchWeaponJustPressed = true;
    }

    let goalX = bx;
    let goalY = bot.y;
    let goalZ = bz;
    let hasGoal = false;

    if (bot.health < 55) {
      let bestDist = Infinity;
      for (const pk of pickups) {
        if (!pk.available || pk.kind !== 'health') continue;
        const d = Math.hypot(pk.x - bx, pk.y - by, pk.z - bz);
        if (d < bestDist) {
          bestDist = d;
          goalX = pk.x;
          goalY = pk.y;
          goalZ = pk.z;
          hasGoal = true;
        }
      }
    }

    if (!hasGoal && mode === 'ctf') {
      const myFlag = bot.team === 1 ? flags.team1 : flags.team2;
      const enemyFlag = bot.team === 1 ? flags.team2 : flags.team1;
      if (enemyFlag.carrierId === bot.id) {
        goalX = myFlag.homeX;
        goalY = myFlag.homeY;
        goalZ = myFlag.homeZ;
        hasGoal = true;
      } else if (!enemyFlag.carrierId) {
        goalX = enemyFlag.x;
        goalY = enemyFlag.y;
        goalZ = enemyFlag.z;
        hasGoal = true;
      }
    }

    if (!hasGoal && (activeSlot.weaponId === 'pistol' || activeSlot.reserveAmmo <= 6)) {
      let bestDist = 24;
      for (const pk of pickups) {
        if (!pk.available || pk.kind !== 'weapon') continue;
        const d = Math.hypot(pk.x - bx, pk.y - by, pk.z - bz);
        if (d < bestDist) {
          bestDist = d;
          goalX = pk.x;
          goalY = pk.y;
          goalZ = pk.z;
          hasGoal = true;
        }
      }
    }

    if (bot.nearbyPickupId) {
      const pk = pickups.find((p) => p.id === bot.nearbyPickupId);
      if (pk && pk.kind === 'weapon' && pk.weaponId && pk.weaponId !== activeSlot.weaponId) {
        if (activeSlot.weaponId === 'pistol' || !bot.weapons[1]) {
          input.pickupJustPressed = true;
        }
      }
    }

    if (!hasGoal && bestEnemy) {
      goalX = bestEnemy.x;
      goalY = bestEnemy.y;
      goalZ = bestEnemy.z;
      hasGoal = true;
    }

    // 4. Aiming (Yaw & Pitch) toward enemy or movement goal
    if (bestEnemy) {
      const dist = Math.hypot(bestEnemy.x - bx, bestEnemy.y + PLAYER_CENTER_Y - by, bestEnemy.z - bz);
      const travel = activeSpec.projectileSpeed > 0 ? dist / activeSpec.projectileSpeed : 0;
      const lx = bestEnemy.x + bestEnemy.vx * travel * diff.leadFactor;
      const ly = bestEnemy.y + PLAYER_CENTER_Y + bestEnemy.vy * travel * diff.leadFactor * 0.45;
      const lz = bestEnemy.z + bestEnemy.vz * travel * diff.leadFactor;

      const dx = lx - bx;
      const dy = ly - by;
      const dz = lz - bz;
      const horiz = Math.hypot(dx, dz) || 0.001;

      const jitter = Math.sin(bot.x * 2.1 + bot.z * 3.3 + bestEnemy.x) * 0.5 * diff.aimError;
      const desiredYaw = Math.atan2(-dx, -dz) + jitter;
      const desiredPitch = Math.max(-1.2, Math.min(1.2, Math.atan2(dy, horiz)));

      const dYaw = wrapAngle(desiredYaw - bot.aimYaw);
      const dPitch = desiredPitch - bot.aimPitch;
      input.aimYaw = wrapAngle(bot.aimYaw + dYaw * Math.min(1, diff.turnSpeed * dt));
      input.aimPitch = bot.aimPitch + dPitch * Math.min(1, diff.turnSpeed * dt);

      if (bestLOS && dist < activeSpec.effectiveRange + 3 && Math.abs(dYaw) < 0.35) {
        input.fireHeld = true;
        input.fireJustPressed = true;
        if (dist < 2.5 && bot.meleeCooldown <= 0) {
          input.meleeJustPressed = true;
        }
      } else if (!bestLOS && dist < 16 && dist > 5 && bot.grenadeCooldown <= 0 && bot.botDifficulty !== 'easy' && Math.random() < dt * 0.5) {
        input.grenadeJustPressed = true;
      }
    } else if (hasGoal) {
      const dx = goalX - bx;
      const dz = goalZ - bz;
      if (Math.hypot(dx, dz) > 0.5) {
        const desiredYaw = Math.atan2(-dx, -dz);
        const dYaw = wrapAngle(desiredYaw - bot.aimYaw);
        input.aimYaw = wrapAngle(bot.aimYaw + dYaw * Math.min(1, 5 * dt));
      }
      input.aimPitch = bot.aimPitch * (1 - Math.min(1, 5 * dt));
    }

    // 5. Movement relative to input.aimYaw
    if (brain.wanderTimer <= 0) {
      brain.strafeDir = Math.random() > 0.5 ? 1 : -1;
      brain.wanderTimer = 1.1 + Math.random() * 1.4;
    }

    if (brain.dodgeTimer > 0) {
      input.moveX = brain.dodgeDir;
      input.moveZ = 0.4;
    } else if (bestEnemy && bestLOS) {
      const dist = Math.hypot(bestEnemy.x - bx, bestEnemy.z - bz);
      const pref = activeSpec.isMelee ? 1.5 : Math.min(activeSpec.effectiveRange * 0.45, 14);
      input.moveZ = dist > pref + 2 ? 1 : dist < pref - 3 ? -0.7 : 0.15;
      input.moveX = brain.strafeDir * 0.85;
    } else if (hasGoal) {
      const dx = goalX - bx;
      const dz = goalZ - bz;
      const fwdX = -Math.sin(input.aimYaw);
      const fwdZ = -Math.cos(input.aimYaw);
      const rgtX = Math.cos(input.aimYaw);
      const rgtZ = -Math.sin(input.aimYaw);
      const d = Math.hypot(dx, dz) || 1;
      input.moveZ = (dx * fwdX + dz * fwdZ) / d;
      input.moveX = (dx * rgtX + dz * rgtZ) / d;
    } else {
      input.moveZ = 0.8;
      input.moveX = brain.strafeDir * 0.3;
    }

    // 6. Wall climb & Jetpack vertical flight
    const fwdX = -Math.sin(input.aimYaw);
    const fwdZ = -Math.cos(input.aimYaw);
    const obstacleAhead = !hasLineOfSight3D(
      bx,
      by,
      bz,
      bx + fwdX * 2.2,
      by,
      bz + fwdZ * 2.2,
      map.platforms
    );

    if (obstacleAhead) {
      if (bot.grounded) {
        input.jumpJustPressed = true;
        input.jumpHeld = true;
      } else if (bot.fuel > 18) {
        input.jumpHeld = true;
      }
    } else if (goalY > bot.y + 2.0 && bot.fuel > 25 * (1.2 - diff.jetSkill * 0.5)) {
      if (bot.grounded) {
        input.jumpJustPressed = true;
        input.jumpHeld = true;
      } else if (brain.jetPulseTimer > 0 || bot.vy < 4.5) {
        input.jumpHeld = true;
      }
    } else if (brain.jetPulseTimer > 0 && bot.fuel > 15) {
      input.jumpHeld = true;
    }

    return input;
  }
}
