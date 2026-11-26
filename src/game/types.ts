export type WeaponId =
  | 'pistol'
  | 'dual_pistols'
  | 'smg'
  | 'assault_rifle'
  | 'heavy_rifle'
  | 'shotgun'
  | 'sniper'
  | 'rocket_launcher'
  | 'plasma_rifle'
  | 'energy_blade';

export type WeaponCategory =
  | 'pistol'
  | 'dual_pistol'
  | 'smg'
  | 'assault_rifle'
  | 'heavy_rifle'
  | 'shotgun'
  | 'sniper'
  | 'launcher'
  | 'energy'
  | 'melee';

export type GrenadeType = 'frag' | 'incendiary' | 'proximity';

export type MapId =
  | 'ironworks'
  | 'hollow_rift'
  | 'skybridge'
  | 'frostline'
  | 'red_canyon'
  | 'orbital_station';

export type GameMode =
  | 'deathmatch'
  | 'team_deathmatch'
  | 'ctf'
  | 'survival'
  | 'training';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export type SplitScreenMode = 'dynamic' | 'always_split' | 'shared';

export type TeamId = 0 | 1 | 2; // 0 = FFA / Neutral, 1 = Cobalt (Blue), 2 = Crimson (Red)

export interface WeaponZoomProfile {
  baseZoom: number;       // Camera distance at rest (higher = wider view)
  aimZoom: number;        // Camera distance when holding LT / RMB
  lookAhead: number;      // How far camera shifts in aim direction
  enemyWeight: number;    // How strongly nearby enemies pull camera framing
}

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  shortName: string;
  category: WeaponCategory;
  description: string;
  fireRate: number;         // Shots per second
  damage: number;           // Damage per projectile/hit
  projectileSpeed: number;  // World units/sec (0 for instant/melee)
  effectiveRange: number;   // Max travel distance
  spread: number;           // Radians half-cone spread
  recoil: number;           // Visual/aim kick
  reloadTime: number;       // Seconds
  magSize: number;
  reserveMax: number;
  pellets: number;          // >1 for shotguns
  automatic: boolean;
  explosiveRadius: number;  // >0 for rockets
  knockback: number;
  color: string;
  trailColor: string;
  zoomProfile: WeaponZoomProfile;
  secondaryMode: 'precision_zoom' | 'burst_shot' | 'overcharge' | 'lunge' | 'none';
  isEnergy?: boolean;
  isMelee?: boolean;
}

export interface GrenadeSpec {
  type: GrenadeType;
  name: string;
  damage: number;
  radius: number;
  fuseTime: number;
  duration: number;         // Lingering duration (incendiary / proximity life)
  color: string;
}

export type CharacterPresetId =
  | 'desert_soldier'
  | 'arctic_explorer'
  | 'urban_tactical'
  | 'industrial_mechanic'
  | 'futuristic_pilot'
  | 'space_ranger'
  | 'jungle_scout'
  | 'heavy_armored';

export type HairStyle = 'crew' | 'mohawk' | 'swept' | 'long' | 'bald';
export type FaceStyle = 'determined' | 'visor_scowl' | 'grin' | 'tactical_mask' | 'cyber_eye';
export type HeadgearStyle =
  | 'none'
  | 'combat_helmet'
  | 'tactical_cap'
  | 'beret'
  | 'visor_goggles'
  | 'space_dome'
  | 'cryo_hood'
  | 'comms_headset';
export type JacketStyle = 'tactical_vest' | 'flight_jacket' | 'heavy_plate' | 'utility_harness';
export type BackpackStyle = 'standard' | 'heavy_pack' | 'cryo_tank' | 'sleek_thruster';
export type JetpackStyle = 'twin_turbine' | 'vector_wings' | 'industrial_dual' | 'plasma_thruster';
export type AccessoryStyle = 'none' | 'shoulder_pad' | 'ammo_bandolier' | 'scarf' | 'antenna';

export interface CharacterAppearance {
  presetId: CharacterPresetId;
  name: string;
  skinColor: string;
  hairStyle: HairStyle;
  hairColor: string;
  faceStyle: FaceStyle;
  headgear: HeadgearStyle;
  headgearColor: string;
  jacketStyle: JacketStyle;
  clothingColor: string;
  accentColor: string;
  pantsColor: string;
  bootsColor: string;
  glovesColor: string;
  backpackStyle: BackpackStyle;
  jetpackStyle: JetpackStyle;
  jetpackColor: string;
  flameColor: string;
  accessory: AccessoryStyle;
}

export interface PlatformRect {
  id: string;
  x: number;        // Center X
  y: number;        // Center Y
  w: number;        // Width
  h: number;        // Height
  zDepth?: number;  // Visual 3D depth
  oneWay?: boolean; // Can jump up through from below
  style?: 'metal' | 'rock' | 'ice' | 'energy' | 'bridge' | 'sandstone' | 'grate';
  cover?: boolean;  // Decorative / vertical pillar
}

export interface PickupSpawn {
  id: string;
  x: number;
  y: number;
  kind: 'weapon' | 'health' | 'ammo';
  weaponId?: WeaponId;
  respawnTime: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
  team: TeamId; // 0 = any
}

export interface MapData {
  id: MapId;
  name: string;
  subtitle: string;
  combatStyle: string;
  width: number;
  height: number;
  floorY: number;
  ceilingY: number;
  theme: {
    skyTop: string;
    skyBottom: string;
    fogColor: string;
    fogNear: number;
    fogFar: number;
    keyLightColor: string;
    keyLightIntensity: number;
    hemiSkyColor: string;
    hemiGroundColor: string;
    platformColor: string;
    platformAccent: string;
    wallColor: string;
    hazardGlow: string;
  };
  platforms: PlatformRect[];
  pickupSpawns: PickupSpawn[];
  spawnPoints: SpawnPoint[];
  flagBases: {
    team1: { x: number; y: number };
    team2: { x: number; y: number };
  };
}

export type InputDeviceAssignment = 'kb_mouse' | 'gamepad_0' | 'gamepad_1' | 'kb_arrows';

export interface KeyBindings {
  left: string;
  right: string;
  down: string;
  jump: string;
  reload: string;
  switchWeapon: string;
  grenade: string;
  melee: string;
  pickup: string;
  secondary: string;
  scoreboard: string;
  pause: string;
}

export interface ControllerSettings {
  horizontalSensitivity: number;
  verticalSensitivity: number;
  aimDeadZone: number;
  moveDeadZone: number;
  aimAcceleration: number;
  aimAssistStrength: number; // 0 to 1
  zoomSensitivity: number;
  vibrationEnabled: boolean;
  invertY: boolean;
}

export interface AudioSettings {
  masterVolume: number;
  sfxVolume: number;
  uiVolume: number;
  muted: boolean;
}

export interface GameSettings {
  keyBindings: KeyBindings;
  controller: ControllerSettings;
  audio: AudioSettings;
  splitScreenMode: SplitScreenMode;
  splitOrientation: 'vertical' | 'horizontal';
  showControlsHints: boolean;
}

export interface PlayerInputFrame {
  playerId: string;
  moveX: number;        // -1..1
  moveY: number;        // -1..1 (down = drop through)
  aimAngle: number;     // Radians in XY plane
  aimActive: boolean;
  jumpHeld: boolean;
  jumpJustPressed: boolean;
  fireHeld: boolean;
  fireJustPressed: boolean;
  zoomHeld: boolean;
  manualZoomDelta: number; // -1, 0, +1
  reloadJustPressed: boolean;
  pickupJustPressed: boolean;
  switchWeaponJustPressed: boolean;
  grenadeJustPressed: boolean;
  cycleGrenadeJustPressed: boolean;
  meleeJustPressed: boolean;
  secondaryJustPressed: boolean;
}

export interface WeaponSlotState {
  weaponId: WeaponId;
  magAmmo: number;
  reserveAmmo: number;
}

export interface PlayerState {
  id: string;
  name: string;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
  localSlot: 0 | 1 | -1; // 0 = P1, 1 = P2, -1 = Bot/Remote
  team: TeamId;
  appearance: CharacterAppearance;

  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  aimAngle: number;

  grounded: boolean;
  coyoteTimer: number;
  jetpackActive: boolean;
  fuel: number;
  maxFuel: number;
  fuelRecoveryDelay: number;

  health: number;
  maxHealth: number;
  alive: boolean;
  respawnTimer: number;
  spawnProtectionTimer: number;
  hitFlashTimer: number;

  weapons: [WeaponSlotState, WeaponSlotState | null];
  activeSlot: 0 | 1;
  fireCooldown: number;
  reloading: boolean;
  reloadTimer: number;
  reloadDuration: number;
  secondaryActive: boolean;
  zoomHeld: boolean;
  manualZoomOffset: number;

  grenadeType: GrenadeType;
  grenades: Record<GrenadeType, number>;
  grenadeCooldown: number;

  meleeCooldown: number;
  meleeAnimTimer: number;
  recoilOffset: number;

  kills: number;
  deaths: number;
  score: number;
  flagCaptures: number;
  streak: number;
  pingMs: number;
  lastDamagedBy?: string;
  nearbyPickupId?: string;
}

export interface ProjectileState {
  id: number;
  ownerId: string;
  team: TeamId;
  weaponId: WeaponId;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  damage: number;
  life: number;
  maxLife: number;
  explosiveRadius: number;
  knockback: number;
  color: string;
  isEnergy: boolean;
}

export interface GrenadeState {
  id: number;
  ownerId: string;
  team: TeamId;
  type: GrenadeType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuseTimer: number;
  armed: boolean;
  life: number;
}

export interface HazardZoneState {
  id: number;
  ownerId: string;
  team: TeamId;
  x: number;
  y: number;
  radius: number;
  timer: number;
  tickTimer: number;
}

export interface PickupState {
  id: string;
  x: number;
  y: number;
  kind: 'weapon' | 'health' | 'ammo';
  weaponId?: WeaponId;
  available: boolean;
  respawnTimer: number;
}

export interface FlagState {
  team: TeamId;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  carrierId: string | null;
  atBase: boolean;
  dropTimer: number;
}

export interface KillFeedEntry {
  id: number;
  killerName: string;
  victimName: string;
  weaponName: string;
  killerTeam: TeamId;
  victimTeam: TeamId;
  timestamp: number;
}

export interface ParticleEvent {
  type: 'muzzle' | 'impact' | 'explosion' | 'fire_burst' | 'hit_spark' | 'pickup' | 'melee_slash' | 'respawn';
  x: number;
  y: number;
  angle?: number;
  color?: string;
  radius?: number;
}

export interface SoundEvent {
  type:
    | 'fire'
    | 'reload'
    | 'empty'
    | 'jump'
    | 'land'
    | 'explosion'
    | 'grenade_throw'
    | 'pickup'
    | 'hit'
    | 'damage'
    | 'death'
    | 'melee'
    | 'flag';
  weaponId?: WeaponId;
  x: number;
  y: number;
  listenerSlot?: 0 | 1;
}

export interface MatchConfig {
  mode: GameMode;
  mapId: MapId;
  botCount: number;
  botDifficulty: BotDifficulty;
  scoreLimit: number;
  timeLimitSec: number;
  twoPlayerLocal: boolean;
  p1Input: InputDeviceAssignment;
  p2Input: InputDeviceAssignment;
  p1Appearance: CharacterAppearance;
  p2Appearance: CharacterAppearance;
  p1Name: string;
  p2Name: string;
}

export interface MatchSnapshot {
  tick: number;
  timeRemaining: number;
  elapsed: number;
  mode: GameMode;
  mapId: MapId;
  phase: 'playing' | 'ended';
  winnerText: string;
  teamScores: { team1: number; team2: number };
  survivalWave: number;
  players: PlayerState[];
  projectiles: ProjectileState[];
  grenades: GrenadeState[];
  hazardZones: HazardZoneState[];
  pickups: PickupState[];
  flags: { team1: FlagState; team2: FlagState };
  killFeed: KillFeedEntry[];
  particleEvents: ParticleEvent[];
  soundEvents: SoundEvent[];
  hitstopTimer: number;
  screenShake: number;
}
