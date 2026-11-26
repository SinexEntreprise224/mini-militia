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
import { hasLineOfSight, PLAYER_CENTER_Y } from './Physics';

interface BotBrain {
  wanderDir: 1 | -1;
  wanderTimer: number;
  dodgeTimer: number;
  dodgeDir: number;
  jetPulseTimer: number;
  targetAngle: number;
  reactionCooldown: number;
}

const DIFFICULTY_PARAMS: Record<
  BotDifficulty,
  { aimError: number; reactionSpeed: number; leadFactor: number; dodgeChance: number; jetSkill: number }
> = {
  easy: { aimError: 0.24, reactionSpeed: 0.08, leadFactor: 0.25, dodgeChance: 0.15, jetSkill: 0.45 },
  normal: { aimError: 0.11, reactionSpeed: 0.16, leadFactor: 0.65, dodgeChance: 0.48, jetSkill: 0.75 },
  hard: { aimError: 0.035, reactionSpeed: 0.28, leadFactor: 0.95, dodgeChance: 0.85, jetSkill: 0.98 },
};

export class BotAIController {
  private brains = new Map<string, BotBrain>();

  private getBrain(id: string): BotBrain {
    let b = this.brains.get(id);
    if (!b) {
      b = {
        wanderDir: Math.random() > 0.5 ? 1 : -1,
        wanderTimer: 1.5,
        dodgeTimer: 0,
        dodgeDir: 0,
        jetPulseTimer: 0,
        targetAngle: 0,
        reactionCooldown: 0,
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
    brain.reactionCooldown = Math.max(0, brain.reactionCooldown - dt);

    const input: PlayerInputFrame = {
      playerId: bot.id,
      moveX: 0,
      moveY: 0,
      aimAngle: bot.aimAngle,
      aimActive: true,
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

    const botCx = bot.x;
    const botCy = bot.y + PLAYER_CENTER_Y;

    // 1. Check incoming projectile threat for dodging
    if (brain.dodgeTimer <= 0 && Math.random() < diff.dodgeChance * dt * 12) {
      for (let i = 0; i < projectiles.length; i++) {
        const pr = projectiles[i];
        if (pr.ownerId === bot.id) continue;
        if (mode === 'team_deathmatch' || mode === 'ctf') {
          if (pr.team !== 0 && pr.team === bot.team) continue;
        }
        const dx = botCx - pr.x;
        const dy = botCy - pr.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 49) {
          const dot = dx * pr.vx + dy * pr.vy;
          if (dot > 0) {
            brain.dodgeTimer = 0.42;
            brain.dodgeDir = dx >= 0 ? 1 : -1;
            brain.jetPulseTimer = 0.25;
            break;
          }
        }
      }
    }

    // 2. Find nearest valid enemy (with line-of-sight preference)
    let bestEnemy: PlayerState | null = null;
    let bestEnemyScore = Infinity;
    let bestHasLOS = false;

    for (let i = 0; i < allPlayers.length; i++) {
      const p = allPlayers[i];
      if (!p.alive || p.id === bot.id) continue;
      if ((mode === 'team_deathmatch' || mode === 'ctf' || mode === 'survival') && p.team === bot.team) {
        continue;
      }
      const dx = p.x - botCx;
      const dy = p.y + PLAYER_CENTER_Y - botCy;
      const dist = Math.hypot(dx, dy);
      const los = hasLineOfSight(botCx, botCy, p.x, p.y + PLAYER_CENTER_Y, map.platforms);
      const score = dist * (los ? 0.55 : 1.35);
      if (score < bestEnemyScore) {
        bestEnemyScore = score;
        bestEnemy = p;
        bestHasLOS = los;
      }
    }

    // 3. Weapon selection & pickup awareness
    const activeWeaponSlot = bot.weapons[bot.activeSlot]!;
    const activeSpec = WEAPONS[activeWeaponSlot.weaponId];
    if (activeWeaponSlot.magAmmo === 0 && !bot.reloading) {
      if (activeWeaponSlot.reserveAmmo > 0) {
        input.reloadJustPressed = true;
      } else if (bot.weapons[1]) {
        input.switchWeaponJustPressed = true;
      }
    }

    // Opportunistic weapon/health pickup check
    let desiredGoalX = botCx;
    let desiredGoalY = botCy;
    let hasGoal = false;

    // Low HP -> seek health
    if (bot.health < 55) {
      let bestDist = Infinity;
      for (const pk of pickups) {
        if (!pk.available || pk.kind !== 'health') continue;
        const d = Math.hypot(pk.x - botCx, pk.y - botCy);
        if (d < bestDist) {
          bestDist = d;
          desiredGoalX = pk.x;
          desiredGoalY = pk.y;
          hasGoal = true;
        }
      }
    }

    // CTF Objective priority
    if (!hasGoal && mode === 'ctf') {
      const myFlag = bot.team === 1 ? flags.team1 : flags.team2;
      const enemyFlag = bot.team === 1 ? flags.team2 : flags.team1;
      if (enemyFlag.carrierId === bot.id) {
        desiredGoalX = myFlag.homeX;
        desiredGoalY = myFlag.homeY;
        hasGoal = true;
      } else if (!enemyFlag.carrierId) {
        desiredGoalX = enemyFlag.x;
        desiredGoalY = enemyFlag.y;
        hasGoal = true;
      }
    }

    // Weapon upgrade seek if holding starter pistol or low ammo
    if (!hasGoal && (activeWeaponSlot.weaponId === 'pistol' || activeWeaponSlot.reserveAmmo <= 6)) {
      let bestDist = 22;
      for (const pk of pickups) {
        if (!pk.available || pk.kind !== 'weapon') continue;
        if (bot.botDifficulty === 'easy' && (pk.weaponId === 'sniper' || pk.weaponId === 'rocket_launcher')) {
          continue;
        }
        const d = Math.hypot(pk.x - botCx, pk.y - botCy);
        if (d < bestDist) {
          bestDist = d;
          desiredGoalX = pk.x;
          desiredGoalY = pk.y;
          hasGoal = true;
        }
      }
    }

    // Immediate pickup interact if standing on a better weapon
    if (bot.nearbyPickupId) {
      const pk = pickups.find((p) => p.id === bot.nearbyPickupId);
      if (pk && pk.kind === 'weapon' && pk.weaponId && pk.weaponId !== activeWeaponSlot.weaponId) {
        if (activeWeaponSlot.weaponId === 'pistol' || !bot.weapons[1]) {
          input.pickupJustPressed = true;
        }
      }
    }

    // 4. Combat positioning & navigation
    if (!hasGoal && bestEnemy) {
      const distToEnemy = Math.hypot(bestEnemy.x - botCx, bestEnemy.y - bot.y);
      const preferredRange = activeSpec.isMelee ? 1.8 : Math.min(activeSpec.effectiveRange * 0.55, 16);
      if (distToEnemy > preferredRange + 2) {
        desiredGoalX = bestEnemy.x;
        desiredGoalY = bestEnemy.y + 1.0;
        hasGoal = true;
      } else if (distToEnemy < preferredRange - 5 && !activeSpec.isMelee) {
        // Backpedal / strafe away
        desiredGoalX = botCx + (botCx > bestEnemy.x ? 6 : -6);
        desiredGoalY = bestEnemy.y + 2.5;
        hasGoal = true;
      } else {
        // Strafe around target
        if (brain.wanderTimer <= 0) {
          brain.wanderDir = Math.random() > 0.5 ? 1 : -1;
          brain.wanderTimer = 0.9 + Math.random() * 1.1;
        }
        desiredGoalX = botCx + brain.wanderDir * 5;
        desiredGoalY = bestEnemy.y + 1.5;
        hasGoal = true;
      }
    }

    if (!hasGoal) {
      if (brain.wanderTimer <= 0) {
        brain.wanderDir = Math.random() > 0.5 ? 1 : -1;
        brain.wanderTimer = 1.5 + Math.random() * 2.0;
      }
      desiredGoalX = botCx + brain.wanderDir * 8;
      desiredGoalY = bot.y + 1.5;
    }

    // Apply horizontal movement + wall / void avoidance
    if (brain.dodgeTimer > 0) {
      input.moveX = brain.dodgeDir;
    } else {
      const dxGoal = desiredGoalX - botCx;
      if (Math.abs(dxGoal) > 0.8) {
        input.moveX = Math.sign(dxGoal);
      }
    }

    // Keep inside map bounds safely
    if (bot.x < -map.width * 0.5 + 3) input.moveX = 1;
    if (bot.x > map.width * 0.5 - 3) input.moveX = -1;

    // 5. Jetpack & Void/Pit Avoidance
    const dangerPit = bot.y < map.floorY + 1.5 && map.id === 'skybridge';
    const wallAhead =
      input.moveX !== 0 &&
      !hasLineOfSight(botCx, botCy, botCx + input.moveX * 2.2, botCy, map.platforms);

    if (dangerPit || (bot.y < 1.2 && bot.vy < -5)) {
      input.jumpHeld = true;
      input.jumpJustPressed = bot.grounded;
    } else if (wallAhead) {
      if (bot.grounded) {
        input.jumpJustPressed = true;
        input.jumpHeld = true;
      } else if (bot.fuel > 20) {
        input.jumpHeld = true;
      }
    } else if (desiredGoalY > bot.y + 2.2 && bot.fuel > 25 * (1.2 - diff.jetSkill * 0.5)) {
      if (bot.grounded) {
        input.jumpJustPressed = true;
        input.jumpHeld = true;
      } else if (brain.jetPulseTimer > 0 || bot.vy < 4.5) {
        input.jumpHeld = true;
      }
    } else if (brain.jetPulseTimer > 0 && bot.fuel > 15) {
      input.jumpHeld = true;
    } else if (desiredGoalY < bot.y - 3.5 && bot.grounded) {
      // Drop through one-way platforms
      input.moveY = -1;
    }

    // 6. Aiming & Firing
    if (bestEnemy) {
      const ex = bestEnemy.x;
      const ey = bestEnemy.y + PLAYER_CENTER_Y;
      const dist = Math.hypot(ex - botCx, ey - botCy);
      const travelTime = activeSpec.projectileSpeed > 0 ? dist / activeSpec.projectileSpeed : 0;
      const leadX = ex + bestEnemy.vx * travelTime * diff.leadFactor;
      const leadY = ey + bestEnemy.vy * travelTime * diff.leadFactor * 0.5;

      const rawAngle = Math.atan2(leadY - botCy, leadX - botCx);
      const jitter = (Math.sin(bot.x * 3.1 + bot.y * 2.7 + bestEnemy.x) * 0.5) * diff.aimError;
      const desiredAim = rawAngle + jitter;

      // Smooth angular tracking
      let delta = desiredAim - bot.aimAngle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      brain.targetAngle = bot.aimAngle + delta * Math.min(1, diff.reactionSpeed * 60 * dt);
      input.aimAngle = brain.targetAngle;

      if (bestHasLOS && dist < activeSpec.effectiveRange + 3) {
        if (Math.abs(delta) < 0.38) {
          input.fireHeld = true;
          input.fireJustPressed = true;
        }
        if (dist < 2.2 && bot.meleeCooldown <= 0) {
          input.meleeJustPressed = true;
        }
        // Smart grenade throw when enemy is behind cover or clustered
        if (
          !bestHasLOS &&
          dist < 16 &&
          dist > 5 &&
          bot.grenadeCooldown <= 0 &&
          bot.botDifficulty !== 'easy' &&
          Math.random() < dt * 0.6
        ) {
          input.grenadeJustPressed = true;
        }
      } else if (
        !bestHasLOS &&
        dist < 14 &&
        dist > 5 &&
        bot.grenadeCooldown <= 0 &&
        bot.botDifficulty === 'hard' &&
        Math.random() < dt * 0.7
      ) {
        input.grenadeJustPressed = true;
      }
    } else {
      input.aimAngle = input.moveX < 0 ? Math.PI : 0;
    }

    return input;
  }
}
