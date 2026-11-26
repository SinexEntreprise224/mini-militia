import { PRESET_LIST } from '../data/cosmetics';
import { MAPS } from '../data/maps';
import { GRENADES, WEAPONS } from '../data/weapons';
import {
  FlagState,
  GrenadeState,
  GrenadeType,
  HazardZoneState,
  KillFeedEntry,
  MapData,
  MatchConfig,
  MatchSnapshot,
  ParticleEvent,
  PickupState,
  PlayerInputFrame,
  PlayerState,
  ProjectileState,
  SoundEvent,
  TeamId,
  WeaponId,
} from '../types';
import { BotAIController } from './BotAI';
import {
  aimAnglesToVector,
  MUZZLE_CENTER_Y,
  MUZZLE_REACH,
  PHYSICS,
  PLAYER_CENTER_Y,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  raycastSolidPlatforms3D,
  resolveCharacterMapCollision3D,
  segmentIntersectsBox3D,
} from './Physics';

const BOT_CALLSIGNS = [
  'Valkyrie-7',
  'Kestrel',
  'Specter',
  'Banshee',
  'Rook',
  'Cobalt',
  'Apex-9',
  'Mantis',
];

const GRENADE_ORDER: GrenadeType[] = ['frag', 'incendiary', 'proximity'];

export class GameSimulation {
  private config: MatchConfig;
  private map: MapData;
  private botAI = new BotAIController();

  private tickCount = 0;
  private elapsed = 0;
  private timeRemaining: number;
  private phase: 'playing' | 'ended' = 'playing';
  private winnerText = '';
  private teamScores = { team1: 0, team2: 0 };
  private survivalWave = 1;
  private survivalNextWaveTimer = 0;

  private players: PlayerState[] = [];
  private projectiles: ProjectileState[] = [];
  private grenades: GrenadeState[] = [];
  private hazardZones: HazardZoneState[] = [];
  private pickups: PickupState[] = [];
  private flags: { team1: FlagState; team2: FlagState };
  private killFeed: KillFeedEntry[] = [];

  private particleEvents: ParticleEvent[] = [];
  private soundEvents: SoundEvent[] = [];
  private hitstopTimer = 0;
  private screenShake = 0;

  private nextProjectileId = 1;
  private nextGrenadeId = 1;
  private nextHazardId = 1;
  private nextKillId = 1;

  constructor(config: MatchConfig) {
    this.config = config;
    this.map = MAPS[config.mapId];
    this.timeRemaining = config.mode === 'training' ? 9999 : config.timeLimitSec;

    this.flags = {
      team1: {
        team: 1,
        x: this.map.flagBases.team1.x,
        y: this.map.flagBases.team1.y,
        z: this.map.flagBases.team1.z,
        homeX: this.map.flagBases.team1.x,
        homeY: this.map.flagBases.team1.y,
        homeZ: this.map.flagBases.team1.z,
        carrierId: null,
        atBase: true,
        dropTimer: 0,
      },
      team2: {
        team: 2,
        x: this.map.flagBases.team2.x,
        y: this.map.flagBases.team2.y,
        z: this.map.flagBases.team2.z,
        homeX: this.map.flagBases.team2.x,
        homeY: this.map.flagBases.team2.y,
        homeZ: this.map.flagBases.team2.z,
        carrierId: null,
        atBase: true,
        dropTimer: 0,
      },
    };

    this.initPickups();
    this.initPlayers();
  }

  private initPickups(): void {
    this.pickups = this.map.pickupSpawns.map((sp) => ({
      id: sp.id,
      x: sp.x,
      y: sp.y,
      z: sp.z,
      kind: sp.kind,
      weaponId: sp.weaponId,
      available: true,
      respawnTimer: 0,
    }));
  }

  private createPlayer(
    id: string,
    name: string,
    isBot: boolean,
    localSlot: 0 | 1 | -1,
    team: TeamId,
    appearance: MatchConfig['p1Appearance']
  ): PlayerState {
    const startWeapon: WeaponId =
      this.config.mode === 'training' ? 'assault_rifle' : 'pistol';
    const wSpec = WEAPONS[startWeapon];
    const spawn = this.chooseSafeSpawn(team);
    // Face inward toward arena center (0, 0)
    const initialYaw = Math.atan2(spawn.x, spawn.z);

    return {
      id,
      name,
      isBot,
      botDifficulty: isBot ? this.config.botDifficulty : undefined,
      localSlot,
      team,
      appearance,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      vx: 0,
      vy: 0,
      vz: 0,
      aimYaw: initialYaw,
      aimPitch: 0,
      grounded: false,
      coyoteTimer: 0,
      jetpackActive: false,
      fuel: PHYSICS.maxFuel,
      maxFuel: PHYSICS.maxFuel,
      fuelRecoveryDelay: 0,
      health: 100,
      maxHealth: 100,
      alive: true,
      respawnTimer: 0,
      spawnProtectionTimer: 1.5,
      hitFlashTimer: 0,
      weapons: [
        { weaponId: startWeapon, magAmmo: wSpec.magSize, reserveAmmo: wSpec.reserveMax },
        this.config.mode === 'training'
          ? { weaponId: 'shotgun', magAmmo: WEAPONS.shotgun.magSize, reserveAmmo: WEAPONS.shotgun.reserveMax }
          : null,
      ],
      activeSlot: 0,
      fireCooldown: 0,
      reloading: false,
      reloadTimer: 0,
      reloadDuration: 1,
      secondaryActive: false,
      zoomHeld: false,
      manualZoomOffset: 0,
      grenadeType: 'frag',
      grenades: { frag: 2, incendiary: 1, proximity: 1 },
      grenadeCooldown: 0,
      meleeCooldown: 0,
      meleeAnimTimer: 0,
      recoilOffset: 0,
      kills: 0,
      deaths: 0,
      score: 0,
      flagCaptures: 0,
      streak: 0,
      pingMs: isBot ? 0 : 1,
    };
  }

  private initPlayers(): void {
    const isTeamMode =
      this.config.mode === 'team_deathmatch' || this.config.mode === 'ctf';
    const isSurvival = this.config.mode === 'survival';

    this.players.push(
      this.createPlayer(
        'p1',
        this.config.p1Name || 'Pilot 1',
        false,
        0,
        isTeamMode || isSurvival ? 1 : 0,
        this.config.p1Appearance
      )
    );

    if (this.config.twoPlayerLocal) {
      const p2Team: TeamId = isSurvival ? 1 : isTeamMode ? 2 : 0;
      this.players.push(
        this.createPlayer(
          'p2',
          this.config.p2Name || 'Pilot 2',
          false,
          1,
          p2Team,
          this.config.p2Appearance
        )
      );
    }

    const maxBots = this.config.mode === 'training'
      ? Math.min(2, this.config.botCount)
      : isSurvival
      ? 3
      : Math.min(7, this.config.botCount);

    for (let i = 0; i < maxBots; i++) {
      let team: TeamId = 0;
      if (isTeamMode) {
        const t1Count = this.players.filter((p) => p.team === 1).length;
        const t2Count = this.players.filter((p) => p.team === 2).length;
        team = t1Count <= t2Count ? 1 : 2;
      } else if (isSurvival) {
        team = 2;
      }
      const preset = PRESET_LIST[(i + 2) % PRESET_LIST.length];
      this.players.push(
        this.createPlayer(
          `bot_${i + 1}`,
          BOT_CALLSIGNS[i % BOT_CALLSIGNS.length],
          true,
          -1,
          team,
          preset
        )
      );
    }
  }

  private chooseSafeSpawn(team: TeamId): { x: number; y: number; z: number } {
    const candidates = this.map.spawnPoints.filter(
      (sp) => team === 0 || sp.team === 0 || sp.team === team
    );
    const pool = candidates.length > 0 ? candidates : this.map.spawnPoints;

    let best = pool[0];
    let bestMinDist = -1;

    for (const sp of pool) {
      let minDist = Infinity;
      for (const other of this.players) {
        if (!other.alive) continue;
        if (team !== 0 && other.team === team) continue;
        const d = Math.hypot(other.x - sp.x, other.y - sp.y, other.z - sp.z);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        best = sp;
      }
    }
    return { x: best.x, y: best.y, z: best.z };
  }

  public step(dt: number, humanInputs: PlayerInputFrame[]): MatchSnapshot {
    this.particleEvents = [];
    this.soundEvents = [];
    this.screenShake = Math.max(0, this.screenShake - dt * 18);

    if (this.phase === 'ended') {
      return this.buildSnapshot();
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return this.buildSnapshot();
    }

    this.tickCount++;
    this.elapsed += dt;
    if (this.config.mode !== 'training' && this.config.mode !== 'survival') {
      this.timeRemaining = Math.max(0, this.timeRemaining - dt);
      if (this.timeRemaining <= 0) {
        this.endMatchByTime();
        return this.buildSnapshot();
      }
    }

    const inputMap = new Map<string, PlayerInputFrame>();
    for (const inp of humanInputs) {
      inputMap.set(inp.playerId, inp);
    }
    for (const p of this.players) {
      if (p.isBot) {
        inputMap.set(
          p.id,
          this.botAI.computeInput(
            p,
            this.players,
            this.projectiles,
            this.pickups,
            this.flags,
            this.map,
            this.config.mode,
            dt
          )
        );
      }
    }

    for (const p of this.players) {
      this.updatePlayer(p, inputMap.get(p.id), dt);
    }

    this.updateProjectiles(dt);
    this.updateGrenades(dt);
    this.updateHazardZones(dt);
    this.updatePickups(dt);

    if (this.config.mode === 'ctf') this.updateFlags(dt);
    if (this.config.mode === 'survival') this.updateSurvival(dt);

    this.killFeed = this.killFeed.filter((k) => this.elapsed - k.timestamp < 8.5);
    return this.buildSnapshot();
  }

  private updatePlayer(p: PlayerState, inp: PlayerInputFrame | undefined, dt: number): void {
    if (!p.alive) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) this.respawnPlayer(p);
      return;
    }

    p.spawnProtectionTimer = Math.max(0, p.spawnProtectionTimer - dt);
    p.hitFlashTimer = Math.max(0, p.hitFlashTimer - dt);
    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    p.grenadeCooldown = Math.max(0, p.grenadeCooldown - dt);
    p.meleeCooldown = Math.max(0, p.meleeCooldown - dt);
    p.meleeAnimTimer = Math.max(0, p.meleeAnimTimer - dt);
    p.recoilOffset = Math.max(0, p.recoilOffset - dt * 2.8);

    if (!inp) return;

    p.aimYaw = inp.aimYaw;
    p.aimPitch = Math.max(-1.32, Math.min(1.32, inp.aimPitch));
    p.zoomHeld = inp.zoomHeld;

    if (inp.manualZoomDelta !== 0) {
      p.manualZoomOffset = Math.max(-2.2, Math.min(3.5, p.manualZoomOffset + inp.manualZoomDelta * 0.6));
    }

    // 3D movement relative to look yaw (W/S forward/back, A/D strafe left/right)
    const fwdX = -Math.sin(p.aimYaw);
    const fwdZ = -Math.cos(p.aimYaw);
    const rgtX = Math.cos(p.aimYaw);
    const rgtZ = -Math.sin(p.aimYaw);

    let wishX = fwdX * inp.moveZ + rgtX * inp.moveX;
    let wishZ = fwdZ * inp.moveZ + rgtZ * inp.moveX;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 1) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }

    const targetVx = wishX * PHYSICS.maxRunSpeed;
    const targetVz = wishZ * PHYSICS.maxRunSpeed;
    const accel = p.grounded
      ? wishLen > 0.05
        ? PHYSICS.groundAccel
        : PHYSICS.groundDecel
      : wishLen > 0.05
      ? PHYSICS.airAccel
      : PHYSICS.airDecel;

    const dvx = targetVx - p.vx;
    const dvz = targetVz - p.vz;
    const dvLen = Math.hypot(dvx, dvz);
    if (dvLen > 1e-4) {
      const step = Math.min(dvLen, accel * dt);
      p.vx += (dvx / dvLen) * step;
      p.vz += (dvz / dvLen) * step;
    }

    // Coyote time & jump
    if (p.grounded) p.coyoteTimer = PHYSICS.coyoteTime;
    else p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);

    if (inp.jumpJustPressed && p.coyoteTimer > 0) {
      p.vy = PHYSICS.jumpVelocity;
      p.grounded = false;
      p.coyoteTimer = 0;
      this.soundEvents.push({ type: 'jump', x: p.x, y: p.y, z: p.z });
    }

    // Jetpack thrust & fuel
    const wantsJetpack = inp.jumpHeld && !p.grounded && p.fuel > 0;
    if (wantsJetpack) {
      p.jetpackActive = true;
      p.vy += PHYSICS.jetpackThrust * dt;
      p.fuel = Math.max(0, p.fuel - PHYSICS.fuelBurnPerSec * dt);
      p.fuelRecoveryDelay = PHYSICS.fuelRecoverDelay;
    } else {
      p.jetpackActive = false;
      if (p.fuelRecoveryDelay > 0) {
        p.fuelRecoveryDelay = Math.max(0, p.fuelRecoveryDelay - dt);
      } else {
        const recoverRate = p.grounded
          ? PHYSICS.fuelRecoverPerSec * 1.45
          : PHYSICS.fuelRecoverPerSec;
        p.fuel = Math.min(p.maxFuel, p.fuel + recoverRate * dt);
      }
    }

    p.vy -= PHYSICS.gravity * dt;
    p.vy = Math.max(PHYSICS.maxFallVel, Math.min(PHYSICS.maxRiseVel, p.vy));

    const { landed } = resolveCharacterMapCollision3D(p, this.map, dt);
    if (landed && p.vy <= 0) {
      this.soundEvents.push({ type: 'land', x: p.x, y: p.y, z: p.z });
    }

    if (p.y < this.map.floorY - 8) {
      this.damagePlayer(p, 999, p.lastDamagedBy || p.id, 'Void Drop', 0, 0, 0);
      return;
    }

    // Weapon switching
    if (inp.switchWeaponJustPressed && p.weapons[1]) {
      p.activeSlot = p.activeSlot === 0 ? 1 : 0;
      p.reloading = false;
      p.reloadTimer = 0;
      p.secondaryActive = false;
    }

    const activeSlot = p.weapons[p.activeSlot]!;
    const weaponSpec = WEAPONS[activeSlot.weaponId];

    if (p.reloading) {
      p.reloadTimer -= dt;
      if (p.reloadTimer <= 0) {
        const needed = weaponSpec.magSize - activeSlot.magAmmo;
        const transfer = Math.min(needed, activeSlot.reserveAmmo);
        activeSlot.magAmmo += transfer;
        activeSlot.reserveAmmo -= transfer;
        p.reloading = false;
        p.reloadTimer = 0;
      }
    } else if (
      inp.reloadJustPressed &&
      activeSlot.magAmmo < weaponSpec.magSize &&
      activeSlot.reserveAmmo > 0
    ) {
      this.startReload(p);
    }

    if (inp.secondaryJustPressed) {
      if (weaponSpec.secondaryMode === 'lunge' && p.meleeCooldown <= 0) {
        const dir = aimAnglesToVector(p.aimYaw, p.aimPitch);
        p.vx += dir.dx * 15;
        p.vy += dir.dy * 12 + 2;
        p.vz += dir.dz * 15;
        this.performMelee(p, weaponSpec.damage, weaponSpec.effectiveRange + 0.6);
      } else {
        p.secondaryActive = !p.secondaryActive;
      }
    }

    const wantsFire = weaponSpec.automatic ? inp.fireHeld : inp.fireJustPressed;
    if (wantsFire && !p.reloading && p.fireCooldown <= 0) {
      if (weaponSpec.isMelee) {
        this.performMelee(p, weaponSpec.damage, weaponSpec.effectiveRange);
        p.fireCooldown = 1 / weaponSpec.fireRate;
      } else if (activeSlot.magAmmo > 0) {
        this.fireWeapon(p);
      } else if (activeSlot.reserveAmmo > 0) {
        this.startReload(p);
      } else if (inp.fireJustPressed) {
        this.soundEvents.push({ type: 'empty', x: p.x, y: p.y, z: p.z });
        p.fireCooldown = 0.25;
      }
    }

    if (inp.meleeJustPressed && p.meleeCooldown <= 0) {
      this.performMelee(p, 42, 2.5);
      p.meleeCooldown = 0.55;
    }

    if (inp.cycleGrenadeJustPressed) {
      const idx = GRENADE_ORDER.indexOf(p.grenadeType);
      p.grenadeType = GRENADE_ORDER[(idx + 1) % GRENADE_ORDER.length];
    }
    if (inp.grenadeJustPressed && p.grenadeCooldown <= 0) {
      if (p.grenades[p.grenadeType] > 0) {
        this.throwGrenade(p);
      } else {
        const alt = GRENADE_ORDER.find((g) => p.grenades[g] > 0);
        if (alt) {
          p.grenadeType = alt;
          this.throwGrenade(p);
        }
      }
    }

    // 3D Pickup checks
    p.nearbyPickupId = undefined;
    for (const pk of this.pickups) {
      if (!pk.available) continue;
      const dist = Math.hypot(pk.x - p.x, pk.y - (p.y + PLAYER_CENTER_Y), pk.z - p.z);
      if (dist < 2.2) {
        if (pk.kind === 'health' && p.health < p.maxHealth) {
          p.health = Math.min(p.maxHealth, p.health + 45);
          pk.available = false;
          pk.respawnTimer = this.map.pickupSpawns.find((s) => s.id === pk.id)?.respawnTime ?? 14;
          this.soundEvents.push({ type: 'pickup', x: pk.x, y: pk.y, z: pk.z });
          this.particleEvents.push({ type: 'pickup', x: pk.x, y: pk.y, z: pk.z, color: '#22c55e' });
        } else if (pk.kind === 'ammo') {
          for (const slot of p.weapons) {
            if (slot) {
              const spec = WEAPONS[slot.weaponId];
              slot.reserveAmmo = Math.min(spec.reserveMax, slot.reserveAmmo + spec.magSize * 2);
            }
          }
          p.grenades.frag = Math.min(3, p.grenades.frag + 1);
          pk.available = false;
          pk.respawnTimer = this.map.pickupSpawns.find((s) => s.id === pk.id)?.respawnTime ?? 12;
          this.soundEvents.push({ type: 'pickup', x: pk.x, y: pk.y, z: pk.z });
          this.particleEvents.push({ type: 'pickup', x: pk.x, y: pk.y, z: pk.z, color: '#facc15' });
        } else if (pk.kind === 'weapon' && pk.weaponId) {
          p.nearbyPickupId = pk.id;
          const matchingIdx = p.weapons.findIndex((s) => s?.weaponId === pk.weaponId);
          if (matchingIdx !== -1) {
            const slot = p.weapons[matchingIdx]!;
            const spec = WEAPONS[pk.weaponId];
            if (slot.reserveAmmo < spec.reserveMax) {
              slot.reserveAmmo = Math.min(spec.reserveMax, slot.reserveAmmo + spec.magSize * 2);
              pk.available = false;
              pk.respawnTimer = this.map.pickupSpawns.find((s) => s.id === pk.id)?.respawnTime ?? 14;
              this.soundEvents.push({ type: 'pickup', x: pk.x, y: pk.y, z: pk.z });
              this.particleEvents.push({ type: 'pickup', x: pk.x, y: pk.y, z: pk.z, color: spec.trailColor });
            }
          } else if (inp.pickupJustPressed || !p.weapons[1]) {
            const spec = WEAPONS[pk.weaponId];
            const newSlot = {
              weaponId: pk.weaponId,
              magAmmo: spec.magSize,
              reserveAmmo: spec.reserveMax,
            };
            if (!p.weapons[1]) {
              p.weapons[1] = newSlot;
              p.activeSlot = 1;
            } else {
              p.weapons[p.activeSlot] = newSlot;
            }
            p.reloading = false;
            p.reloadTimer = 0;
            pk.available = false;
            pk.respawnTimer = this.map.pickupSpawns.find((s) => s.id === pk.id)?.respawnTime ?? 14;
            this.soundEvents.push({ type: 'pickup', x: pk.x, y: pk.y, z: pk.z });
            this.particleEvents.push({ type: 'pickup', x: pk.x, y: pk.y, z: pk.z, color: spec.trailColor });
          }
        }
      }
    }
  }

  private startReload(p: PlayerState): void {
    const slot = p.weapons[p.activeSlot];
    if (!slot) return;
    const spec = WEAPONS[slot.weaponId];
    p.reloading = true;
    p.reloadDuration = spec.reloadTime;
    p.reloadTimer = spec.reloadTime;
    this.soundEvents.push({ type: 'reload', weaponId: slot.weaponId, x: p.x, y: p.y, z: p.z });
  }

  private fireWeapon(p: PlayerState): void {
    const slot = p.weapons[p.activeSlot]!;
    const spec = WEAPONS[slot.weaponId];

    const isBurstDual = spec.id === 'dual_pistols' && p.secondaryActive && slot.magAmmo >= 2;
    const shotsToFire = isBurstDual ? 2 : 1;
    slot.magAmmo -= shotsToFire;

    p.fireCooldown = 1 / spec.fireRate;
    p.recoilOffset = Math.min(0.45, p.recoilOffset + spec.recoil);

    const aimVec = aimAnglesToVector(p.aimYaw, p.aimPitch);
    const rgtX = Math.cos(p.aimYaw);
    const rgtZ = -Math.sin(p.aimYaw);

    const mx = p.x + rgtX * 0.25 + aimVec.dx * MUZZLE_REACH;
    const my = p.y + MUZZLE_CENTER_Y + aimVec.dy * MUZZLE_REACH;
    const mz = p.z + rgtZ * 0.25 + aimVec.dz * MUZZLE_REACH;

    const totalPellets = spec.pellets * shotsToFire;
    for (let i = 0; i < totalPellets; i++) {
      const yawSpread = (Math.random() - 0.5) * 2 * spec.spread;
      const pitchSpread = (Math.random() - 0.5) * 2 * spec.spread;
      const pDir = aimAnglesToVector(p.aimYaw + yawSpread, p.aimPitch + pitchSpread);
      const speed = spec.projectileSpeed;
      const maxLife = spec.effectiveRange / speed;
      const dmg = spec.id === 'plasma_rifle' && p.secondaryActive ? spec.damage * 1.25 : spec.damage;

      this.projectiles.push({
        id: this.nextProjectileId++,
        ownerId: p.id,
        team: p.team,
        weaponId: spec.id,
        x: mx,
        y: my,
        z: mz,
        prevX: p.x,
        prevY: p.y + MUZZLE_CENTER_Y,
        prevZ: p.z,
        vx: pDir.dx * speed,
        vy: pDir.dy * speed,
        vz: pDir.dz * speed,
        damage: dmg,
        life: maxLife,
        maxLife,
        explosiveRadius: spec.explosiveRadius,
        knockback: spec.knockback,
        color: spec.trailColor,
        isEnergy: Boolean(spec.isEnergy),
      });
    }

    this.particleEvents.push({
      type: 'muzzle',
      x: mx,
      y: my,
      z: mz,
      color: spec.trailColor,
    });
    this.soundEvents.push({ type: 'fire', weaponId: spec.id, x: mx, y: my, z: mz });

    if (spec.id === 'rocket_launcher' || spec.id === 'sniper' || spec.id === 'shotgun') {
      this.screenShake = Math.max(this.screenShake, spec.id === 'rocket_launcher' ? 0.35 : 0.16);
    }

    if (slot.magAmmo === 0 && slot.reserveAmmo > 0) {
      this.startReload(p);
    }
  }

  private performMelee(p: PlayerState, damage: number, range: number): void {
    p.meleeAnimTimer = 0.24;
    const dir = aimAnglesToVector(p.aimYaw, p.aimPitch);
    const hitCx = p.x + dir.dx * (range * 0.65);
    const hitCy = p.y + PLAYER_CENTER_Y + dir.dy * (range * 0.65);
    const hitCz = p.z + dir.dz * (range * 0.65);

    this.soundEvents.push({ type: 'melee', x: p.x, y: p.y, z: p.z });
    this.particleEvents.push({
      type: 'melee_slash',
      x: hitCx,
      y: hitCy,
      z: hitCz,
      color: '#e879f9',
    });

    for (const target of this.players) {
      if (!target.alive || target.id === p.id) continue;
      if (this.isFriendly(p.team, target.team)) continue;
      const dist = Math.hypot(
        target.x - hitCx,
        target.y + PLAYER_CENTER_Y - hitCy,
        target.z - hitCz
      );
      if (dist <= range * 0.78 + PLAYER_RADIUS) {
        this.damagePlayer(
          target,
          damage,
          p.id,
          'Melee Strike',
          dir.dx * 10,
          dir.dy * 6 + 4,
          dir.dz * 10
        );
      }
    }
  }

  private throwGrenade(p: PlayerState): void {
    p.grenades[p.grenadeType] -= 1;
    p.grenadeCooldown = 0.65;
    const spec = GRENADES[p.grenadeType];
    const dir = aimAnglesToVector(p.aimYaw, p.aimPitch);
    const speed = 19.0;
    const mx = p.x + dir.dx * 0.75;
    const my = p.y + MUZZLE_CENTER_Y + dir.dy * 0.75;
    const mz = p.z + dir.dz * 0.75;

    this.grenades.push({
      id: this.nextGrenadeId++,
      ownerId: p.id,
      team: p.team,
      type: p.grenadeType,
      x: mx,
      y: my,
      z: mz,
      vx: dir.dx * speed + p.vx * 0.35,
      vy: dir.dy * speed + 3.8,
      vz: dir.dz * speed + p.vz * 0.35,
      fuseTimer: spec.fuseTime,
      armed: false,
      life: spec.duration > 0 ? spec.duration : spec.fuseTime + 0.5,
    });
    this.soundEvents.push({ type: 'grenade_throw', x: mx, y: my, z: mz });
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.prevX = pr.x;
      pr.prevY = pr.y;
      pr.prevZ = pr.z;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.z += pr.vz * dt;
      pr.life -= dt;

      let remove = pr.life <= 0;

      const wallHit = raycastSolidPlatforms3D(
        pr.prevX,
        pr.prevY,
        pr.prevZ,
        pr.x,
        pr.y,
        pr.z,
        this.map.platforms
      );
      if (wallHit) {
        pr.x = wallHit.x;
        pr.y = wallHit.y;
        pr.z = wallHit.z;
        remove = true;
        if (pr.explosiveRadius > 0) {
          this.triggerExplosion(
            pr.x,
            pr.y,
            pr.z,
            pr.explosiveRadius,
            pr.damage,
            pr.ownerId,
            pr.team,
            WEAPONS[pr.weaponId].shortName,
            pr.knockback
          );
        } else {
          this.particleEvents.push({ type: 'impact', x: pr.x, y: pr.y, z: pr.z, color: pr.color });
        }
      }

      if (!remove) {
        for (const target of this.players) {
          if (!target.alive || target.id === pr.ownerId) continue;
          if (this.isFriendly(pr.team, target.team)) continue;

          const hit = segmentIntersectsBox3D(
            pr.prevX,
            pr.prevY,
            pr.prevZ,
            pr.x,
            pr.y,
            pr.z,
            target.x,
            target.y + PLAYER_CENTER_Y,
            target.z,
            PLAYER_RADIUS * 2.1,
            PLAYER_HEIGHT,
            PLAYER_RADIUS * 2.1
          );

          if (hit) {
            remove = true;
            if (pr.explosiveRadius > 0) {
              this.triggerExplosion(
                hit.x,
                hit.y,
                hit.z,
                pr.explosiveRadius,
                pr.damage,
                pr.ownerId,
                pr.team,
                WEAPONS[pr.weaponId].shortName,
                pr.knockback
              );
            } else {
              const dirLen = Math.hypot(pr.vx, pr.vy, pr.vz) || 1;
              this.damagePlayer(
                target,
                pr.damage,
                pr.ownerId,
                WEAPONS[pr.weaponId].shortName,
                (pr.vx / dirLen) * pr.knockback,
                (pr.vy / dirLen) * pr.knockback + 1.2,
                (pr.vz / dirLen) * pr.knockback
              );
              this.particleEvents.push({
                type: 'hit_spark',
                x: hit.x,
                y: hit.y,
                z: hit.z,
                color: pr.color,
              });
            }
            break;
          }
        }
      }

      if (remove) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateGrenades(dt: number): void {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      const spec = GRENADES[g.type];

      const prevX = g.x;
      const prevY = g.y;
      const prevZ = g.z;
      g.vy -= PHYSICS.gravity * 0.78 * dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.z += g.vz * dt;

      const hit = raycastSolidPlatforms3D(prevX, prevY, prevZ, g.x, g.y, g.z, this.map.platforms);
      if (hit) {
        g.x = hit.x + hit.nx * 0.1;
        g.y = hit.y + hit.ny * 0.1;
        g.z = hit.z + hit.nz * 0.1;
        if (g.type === 'proximity') {
          g.vx = 0;
          g.vy = 0;
          g.vz = 0;
        } else {
          if (hit.nx !== 0) g.vx = -g.vx * 0.55;
          if (hit.nz !== 0) g.vz = -g.vz * 0.55;
          if (hit.ny !== 0) {
            g.vy = -g.vy * 0.45;
            g.vx *= 0.78;
            g.vz *= 0.78;
          }
        }
      }

      if (g.type === 'proximity') {
        if (!g.armed) {
          g.fuseTimer -= dt;
          if (g.fuseTimer <= 0) g.armed = true;
        } else {
          g.life -= dt;
          let triggered = g.life <= 0;
          if (!triggered) {
            for (const p of this.players) {
              if (!p.alive || p.id === g.ownerId || this.isFriendly(g.team, p.team)) continue;
              if (Math.hypot(p.x - g.x, p.y + PLAYER_CENTER_Y - g.y, p.z - g.z) < spec.radius * 0.75) {
                triggered = true;
                break;
              }
            }
          }
          if (triggered) {
            this.triggerExplosion(g.x, g.y, g.z, spec.radius, spec.damage, g.ownerId, g.team, 'Proximity Mine', 10);
            this.grenades.splice(i, 1);
          }
        }
      } else {
        g.fuseTimer -= dt;
        if (g.fuseTimer <= 0) {
          if (g.type === 'frag') {
            this.triggerExplosion(g.x, g.y, g.z, spec.radius, spec.damage, g.ownerId, g.team, 'Frag Grenade', 11);
          } else if (g.type === 'incendiary') {
            this.hazardZones.push({
              id: this.nextHazardId++,
              ownerId: g.ownerId,
              team: g.team,
              x: g.x,
              y: g.y,
              z: g.z,
              radius: spec.radius,
              timer: spec.duration,
              tickTimer: 0,
            });
            this.particleEvents.push({
              type: 'fire_burst',
              x: g.x,
              y: g.y,
              z: g.z,
              radius: spec.radius,
              color: '#f97316',
            });
            this.soundEvents.push({ type: 'explosion', x: g.x, y: g.y, z: g.z });
          }
          this.grenades.splice(i, 1);
        }
      }
    }
  }

  private updateHazardZones(dt: number): void {
    for (let i = this.hazardZones.length - 1; i >= 0; i--) {
      const hz = this.hazardZones[i];
      hz.timer -= dt;
      hz.tickTimer -= dt;
      if (hz.tickTimer <= 0) {
        hz.tickTimer = 0.25;
        for (const p of this.players) {
          if (!p.alive || this.isFriendly(hz.team, p.team)) continue;
          const dist = Math.hypot(p.x - hz.x, p.y + PLAYER_CENTER_Y - hz.y, p.z - hz.z);
          if (dist <= hz.radius) {
            this.damagePlayer(p, 7, hz.ownerId, 'Thermite Zone', 0, 0, 0);
          }
        }
      }
      if (hz.timer <= 0) this.hazardZones.splice(i, 1);
    }
  }

  private triggerExplosion(
    x: number,
    y: number,
    z: number,
    radius: number,
    maxDamage: number,
    ownerId: string,
    ownerTeam: TeamId,
    weaponName: string,
    knockback: number
  ): void {
    this.particleEvents.push({ type: 'explosion', x, y, z, radius, color: '#f97316' });
    this.soundEvents.push({ type: 'explosion', x, y, z });
    this.screenShake = Math.max(this.screenShake, 0.55);

    for (const target of this.players) {
      if (!target.alive) continue;
      if (target.id !== ownerId && this.isFriendly(ownerTeam, target.team)) continue;
      const dx = target.x - x;
      const dy = target.y + PLAYER_CENTER_Y - y;
      const dz = target.z - z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist <= radius) {
        const falloff = 1 - (dist / radius) * 0.72;
        const selfScale = target.id === ownerId ? 0.45 : 1.0;
        const dmg = Math.round(maxDamage * falloff * selfScale);
        const nx = dist > 0.05 ? dx / dist : 0;
        const ny = dist > 0.05 ? dy / dist : 1;
        const nz = dist > 0.05 ? dz / dist : 0;
        this.damagePlayer(
          target,
          dmg,
          ownerId,
          weaponName,
          nx * knockback * falloff,
          ny * knockback * falloff + 4,
          nz * knockback * falloff
        );
      }
    }
  }

  private damagePlayer(
    target: PlayerState,
    damage: number,
    attackerId: string,
    weaponName: string,
    kx: number,
    ky: number,
    kz: number
  ): void {
    if (!target.alive || target.spawnProtectionTimer > 0) return;

    target.health = Math.max(0, target.health - damage);
    target.hitFlashTimer = 0.14;
    target.vx += kx;
    target.vy += ky;
    target.vz += kz;
    target.lastDamagedBy = attackerId;

    const attacker = this.players.find((p) => p.id === attackerId);
    if (attacker && attacker.localSlot !== -1) {
      this.soundEvents.push({ type: 'hit', x: target.x, y: target.y, z: target.z, listenerSlot: attacker.localSlot });
    }
    if (target.localSlot !== -1) {
      this.soundEvents.push({ type: 'damage', x: target.x, y: target.y, z: target.z, listenerSlot: target.localSlot });
    }

    if (target.health <= 0) {
      this.handlePlayerDeath(target, attacker, weaponName);
    }
  }

  private handlePlayerDeath(
    victim: PlayerState,
    killer: PlayerState | undefined,
    weaponName: string
  ): void {
    victim.alive = false;
    victim.deaths += 1;
    victim.streak = 0;
    victim.respawnTimer = this.config.mode === 'survival' && victim.isBot ? 999 : 2.6;

    if (this.flags.team1.carrierId === victim.id) {
      this.flags.team1.carrierId = null;
      this.flags.team1.x = victim.x;
      this.flags.team1.y = victim.y + 0.5;
      this.flags.team1.z = victim.z;
      this.flags.team1.dropTimer = 14;
    }
    if (this.flags.team2.carrierId === victim.id) {
      this.flags.team2.carrierId = null;
      this.flags.team2.x = victim.x;
      this.flags.team2.y = victim.y + 0.5;
      this.flags.team2.z = victim.z;
      this.flags.team2.dropTimer = 14;
    }

    this.soundEvents.push({ type: 'death', x: victim.x, y: victim.y, z: victim.z });
    this.particleEvents.push({
      type: 'explosion',
      x: victim.x,
      y: victim.y + PLAYER_CENTER_Y,
      z: victim.z,
      radius: 1.8,
      color: '#ef4444',
    });

    if (killer && killer.id !== victim.id) {
      killer.kills += 1;
      killer.streak += 1;
      killer.score += 100;
      if (killer.localSlot !== -1) this.hitstopTimer = 0.035;
      if (this.config.mode === 'team_deathmatch') {
        if (killer.team === 1) this.teamScores.team1 += 1;
        else if (killer.team === 2) this.teamScores.team2 += 1;
      }
    }

    this.killFeed.unshift({
      id: this.nextKillId++,
      killerName: killer && killer.id !== victim.id ? killer.name : 'Hazard',
      victimName: victim.name,
      weaponName,
      killerTeam: killer ? killer.team : 0,
      victimTeam: victim.team,
      timestamp: this.elapsed,
    });
    if (this.killFeed.length > 5) this.killFeed.pop();

    this.checkWinCondition();
  }

  private respawnPlayer(p: PlayerState): void {
    const sp = this.chooseSafeSpawn(p.team);
    p.x = sp.x;
    p.y = sp.y;
    p.z = sp.z;
    p.vx = 0;
    p.vy = 0;
    p.vz = 0;
    p.health = p.maxHealth;
    p.fuel = p.maxFuel;
    p.alive = true;
    p.spawnProtectionTimer = 1.8;
    p.reloading = false;
    p.reloadTimer = 0;
    const startWeapon: WeaponId = this.config.mode === 'training' ? 'assault_rifle' : 'pistol';
    const wSpec = WEAPONS[startWeapon];
    p.weapons = [
      { weaponId: startWeapon, magAmmo: wSpec.magSize, reserveAmmo: wSpec.reserveMax },
      null,
    ];
    p.activeSlot = 0;
    p.grenades = { frag: 2, incendiary: 1, proximity: 1 };
    this.particleEvents.push({ type: 'respawn', x: p.x, y: p.y + 0.8, z: p.z, color: '#38bdf8' });
  }

  private updatePickups(dt: number): void {
    for (const pk of this.pickups) {
      if (!pk.available) {
        pk.respawnTimer -= dt;
        if (pk.respawnTimer <= 0) pk.available = true;
      }
    }
  }

  private updateFlags(dt: number): void {
    const updateSingleFlag = (flag: FlagState, enemyFlag: FlagState) => {
      if (flag.carrierId) {
        const carrier = this.players.find((p) => p.id === flag.carrierId);
        if (carrier && carrier.alive) {
          flag.x = carrier.x;
          flag.y = carrier.y + 1.9;
          flag.z = carrier.z;
        } else {
          flag.carrierId = null;
          flag.dropTimer = 14;
        }
      } else if (!flag.atBase) {
        flag.dropTimer -= dt;
        if (flag.dropTimer <= 0) {
          flag.x = flag.homeX;
          flag.y = flag.homeY;
          flag.z = flag.homeZ;
          flag.atBase = true;
        }
      }

      for (const p of this.players) {
        if (!p.alive) continue;
        const dist = Math.hypot(p.x - flag.x, p.y + 0.8 - flag.y, p.z - flag.z);
        if (dist > 1.8) continue;

        if (p.team !== flag.team && !flag.carrierId) {
          flag.carrierId = p.id;
          flag.atBase = false;
          this.soundEvents.push({ type: 'flag', x: flag.x, y: flag.y, z: flag.z });
        } else if (p.team === flag.team && !flag.atBase && !flag.carrierId) {
          flag.x = flag.homeX;
          flag.y = flag.homeY;
          flag.z = flag.homeZ;
          flag.atBase = true;
          this.soundEvents.push({ type: 'flag', x: flag.x, y: flag.y, z: flag.z });
        } else if (p.team === flag.team && flag.atBase && enemyFlag.carrierId === p.id) {
          enemyFlag.carrierId = null;
          enemyFlag.x = enemyFlag.homeX;
          enemyFlag.y = enemyFlag.homeY;
          enemyFlag.z = enemyFlag.homeZ;
          enemyFlag.atBase = true;
          p.flagCaptures += 1;
          p.score += 300;
          if (p.team === 1) this.teamScores.team1 += 1;
          else this.teamScores.team2 += 1;
          this.soundEvents.push({ type: 'flag', x: flag.x, y: flag.y, z: flag.z });
          this.checkWinCondition();
        }
      }
    };

    updateSingleFlag(this.flags.team1, this.flags.team2);
    updateSingleFlag(this.flags.team2, this.flags.team1);
  }

  private updateSurvival(dt: number): void {
    const aliveBots = this.players.filter((p) => p.isBot && p.alive).length;
    const aliveHumans = this.players.filter((p) => !p.isBot && p.alive).length;

    if (aliveHumans === 0 && this.players.every((p) => p.isBot || !p.alive)) {
      this.phase = 'ended';
      this.winnerText = `Eliminated on Wave ${this.survivalWave}`;
      return;
    }

    if (aliveBots === 0) {
      this.survivalNextWaveTimer += dt;
      if (this.survivalNextWaveTimer >= 2.2) {
        this.survivalNextWaveTimer = 0;
        this.survivalWave += 1;
        this.players = this.players.filter((p) => !p.isBot);
        const count = Math.min(7, 2 + this.survivalWave);
        for (let i = 0; i < count; i++) {
          const preset = PRESET_LIST[(i + this.survivalWave) % PRESET_LIST.length];
          const bot = this.createPlayer(
            `wave_${this.survivalWave}_bot_${i}`,
            `Raider W${this.survivalWave}-${i + 1}`,
            true,
            -1,
            2,
            preset
          );
          bot.maxHealth = 80 + this.survivalWave * 15;
          bot.health = bot.maxHealth;
          bot.botDifficulty = this.survivalWave >= 4 ? 'hard' : this.survivalWave >= 2 ? 'normal' : 'easy';
          this.players.push(bot);
        }
      }
    }
  }

  private checkWinCondition(): void {
    if (this.config.mode === 'training' || this.config.mode === 'survival') return;

    if (this.config.mode === 'deathmatch') {
      const winner = this.players.find((p) => p.kills >= this.config.scoreLimit);
      if (winner) {
        this.phase = 'ended';
        this.winnerText = `${winner.name} Wins!`;
      }
    } else if (this.config.mode === 'team_deathmatch' || this.config.mode === 'ctf') {
      if (this.teamScores.team1 >= this.config.scoreLimit) {
        this.phase = 'ended';
        this.winnerText = 'Cobalt Squadron Wins!';
      } else if (this.teamScores.team2 >= this.config.scoreLimit) {
        this.phase = 'ended';
        this.winnerText = 'Crimson Vanguard Wins!';
      }
    }
  }

  private endMatchByTime(): void {
    this.phase = 'ended';
    if (this.config.mode === 'deathmatch') {
      const sorted = [...this.players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
      this.winnerText = sorted[0] ? `${sorted[0].name} Wins!` : 'Match Complete';
    } else {
      if (this.teamScores.team1 > this.teamScores.team2) {
        this.winnerText = 'Cobalt Squadron Wins!';
      } else if (this.teamScores.team2 > this.teamScores.team1) {
        this.winnerText = 'Crimson Vanguard Wins!';
      } else {
        this.winnerText = 'Draw Match!';
      }
    }
  }

  private isFriendly(t1: TeamId, t2: TeamId): boolean {
    if (this.config.mode === 'deathmatch' || this.config.mode === 'training') return false;
    return t1 !== 0 && t1 === t2;
  }

  public getSnapshot(): MatchSnapshot {
    return this.buildSnapshot();
  }

  private buildSnapshot(): MatchSnapshot {
    return {
      tick: this.tickCount,
      timeRemaining: this.timeRemaining,
      elapsed: this.elapsed,
      mode: this.config.mode,
      mapId: this.config.mapId,
      phase: this.phase,
      winnerText: this.winnerText,
      teamScores: { ...this.teamScores },
      survivalWave: this.survivalWave,
      players: this.players.map((p) => ({
        ...p,
        weapons: [p.weapons[0] ? { ...p.weapons[0] } : null, p.weapons[1] ? { ...p.weapons[1] } : null] as [
          PlayerState['weapons'][0],
          PlayerState['weapons'][1]
        ],
        grenades: { ...p.grenades },
      })),
      projectiles: this.projectiles.map((pr) => ({ ...pr })),
      grenades: this.grenades.map((g) => ({ ...g })),
      hazardZones: this.hazardZones.map((h) => ({ ...h })),
      pickups: this.pickups.map((pk) => ({ ...pk })),
      flags: {
        team1: { ...this.flags.team1 },
        team2: { ...this.flags.team2 },
      },
      killFeed: [...this.killFeed],
      particleEvents: [...this.particleEvents],
      soundEvents: [...this.soundEvents],
      hitstopTimer: this.hitstopTimer,
      screenShake: this.screenShake,
    };
  }
}
