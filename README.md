# SKYBREAK — 3D Jetpack Arena Shooter (Technical Reference & Dev Log)

> **Purpose of this file:** Complete technical reference, architecture guide, and living changelog for **SKYBREAK**. Read this file first before modifying the codebase so every system, invariant, and extension point is understood immediately.

---

## 1. Project Overview & Scope

**SKYBREAK** is a fast-paced **3D multi-axis jetpack arena shooter** built with **React 19**, **TypeScript**, **Three.js**, **Tailwind CSS v4**, and **Web Audio API**.

- **Current Play Mode Scope:** **100% Local Play** (Solo vs Bots, Offline Training Range, and **Local 2-Player Dynamic Split-Screen** with multi-controller / Xbox Gamepad support).
- **Online Multiplayer Readiness:** All simulation logic is strictly decoupled from rendering and UI via `IMatchTransport` (`src/game/net/MatchTransport.ts`) and a deterministic fixed-timestep `GameSimulation` (`src/game/sim/GameSimulation.ts`). Adding WebSocket server-authoritative online multiplayer requires only implementing a `WebSocketMatchTransport` and running `GameSimulation` on the Node.js server.

---

## 2. File Structure & Module Responsibilities

| File | Responsibility |
| --- | --- |
| `index.html` / `metadata.json` | App metadata (`SKYBREAK`) and OpenGraph title/description. |
| `src/index.css` | Tailwind v4 import and full-viewport `overflow: hidden` / `user-select: none` rules. |
| `src/App.tsx` | Top-level Game Shell (`title`, `setup`, `customization`, `playing`), isolated WebGL mount ref, fixed-timestep loop (`afterDraw` on software WebGL, `rAF` on GPU), Xbox controller menu navigation, and modal orchestration. |
| `src/game/types.ts` | Shared TypeScript interfaces for weapons, grenades, maps, character cosmetics, inputs, physics state, snapshots, and settings. |
| `src/game/storage.ts` | `localStorage` persistence for settings, P1/P2 names, and P1/P2 character appearances. |
| `src/game/data/weapons.ts` | 10 original weapons (`pistol`, `dual_pistols`, `smg`, `assault_rifle`, `heavy_rifle`, `shotgun`, `sniper`, `rocket_launcher`, `plasma_rifle`, `energy_blade`) with per-weapon zoom profiles, plus 3 grenade specs (`frag`, `incendiary`, `proximity`). |
| `src/game/data/maps.ts` | 6 original full-3D enclosed arenas (`ironworks`, `hollow_rift`, `skybridge`, `frostline`, `red_canyon`, `orbital_station`) with perimeter fortress walls, multi-tier X/Z bridges, cover pillars, pickups, spawns, and CTF flag bases. |
| `src/game/data/cosmetics.ts` | 8 original character archetypes + modular cosmetic palettes/styles (skin, hair, face, headgear, jacket, pants, boots, gloves, backpack, jetpack, flames, accessories). Standardized hitbox enforced. |
| `src/game/sim/Physics.ts` | 3D constants (`PLAYER_RADIUS = 0.44`, `PLAYER_HEIGHT = 1.78`), `aimAnglesToVector(yaw, pitch)`, continuous 3D `segmentIntersectsBox3D` ray-AABB collision, 3D LOS checks, and sub-stepped axis-separated `resolveCharacterMapCollision3D` preventing any tunneling through walls/floors. |
| `src/game/sim/BotAI.ts` | Modular 3D Bot AI (`easy`, `normal`, `hard`) with full X/Y/Z pathing, yaw/pitch lead tracking, 3D LOS, dodge thrusts, and CTF objective priority. |
| `src/game/sim/GameSimulation.ts` | Fixed-timestep (`1/60s`) 3D authoritative simulation supporting 5 modes (`deathmatch`, `team_deathmatch`, `ctf`, `survival`, `training`), 360° omni-directional shooting/grenades/melee, continuous bullet/wall collision, explosive splash + knockback, pickups, spawn protection, hitstop, and kill feed. |
| `src/game/net/MatchTransport.ts` | `IMatchTransport` interface + `LocalMatchTransport` accumulator wrapper + blueprint for future `WebSocketMatchTransport`. |
| `src/game/input/InputManager.ts` | Simultaneous Keyboard/Mouse (Pointer Lock FPS/TPS 360° look + WASD relative movement + Arrow fallback) & Gamepad API (Left Stick 3D movement, Right Stick 360° camera/aim look, aim assist, dead zones, rumble, menu nav). |
| `src/game/audio/SoundEngine.ts` | 100% procedural Web Audio API synthesizer (weapon fire per weapon class, reload, empty click, continuous modulated jetpack thrust, jump/land, explosions, pickups, hit marker, UI clicks). |
| `src/game/render/WeaponBuilder.ts` | Procedural multi-part 3D models for all 10 weapons, 3 grenades, and rotating pickup pedestals. |
| `src/game/render/CharacterBuilder.ts` | Procedural 12+ part articulated 3D humanoid rig turning 360° (`aimYaw + PI/2`) and pitching with `aimPitch`, animated thruster flames, spawn shield bubble, contact shadow, and velocity-projected run/flight lean animations. |
| `src/game/render/MapBuilder.ts` | Custom GLSL Sky Dome shader, 512px procedural PBR textures (`SRGBColorSpace`, anisotropy), exact-footprint 3D platforms & glowing perimeter boundary walls, CTF flag meshes, and 360° surrounding map vistas. |
| `src/game/render/ParticlePool.ts` | Zero-GC `EffectsPool` using `InstancedMesh` for 3D particles & velocity-aligned 3D tracer bolts plus pooled 3D blast cores/rings. |
| `src/game/render/CameraSystem.ts` | Smooth 3D over-the-shoulder orbit/chase camera rotating with `aimYaw`/`aimPitch`, weapon-dependent arm zoom + FOV transitions, `raycastSolidPlatforms3D` camera wall-collision prevention, and **2-Player Dynamic Split-Screen**. |
| `src/game/render/ArenaRenderer.ts` | WebGLRenderer setup (`detectSoftwareWebGL`, `RoomEnvironment` PMREM, 2048px shadows, pooled dynamic muzzle/explosion `PointLight`s, fog), 3D entity synchronization, and single/scissor-split viewport rendering. |
| `src/components/CharacterPreview3D.tsx` | Isolated Three.js turntable preview for Character Customization (mouse drag + Xbox Right Stick rotation). |
| `src/components/CustomizationScreen.tsx` | Full P1 & P2 Character Hangar UI with 8 presets and modular tabs. |
| `src/components/MatchSetupModal.tsx` | Match configuration modal (1P vs 2P Local Split-Screen, 5 modes, 6 maps, bots, input device assignment, split behavior). |
| `src/components/ControlsGuideModal.tsx` | Dedicated interactive **Controls & Thumbstick/Keyboard Guide** page featuring annotated Xbox controller SVG & Keyboard/Mouse 3D visual diagrams. |
| `src/components/GameHUD.tsx` | Low-occlusion HUD with centered 3D crosshair reticles per viewport, pointer-lock hint, HP, Fuel, Zoom/FOV readout, Ammo, Grenades, Pickup prompt, Kill feed, Timer/Score. |
| `src/components/SettingsModal.tsx` | Xbox controller tuning, key remapping (`forward`/`backward`/`left`/`right`), audio sliders, and split-screen settings. |
| `src/components/MatchOverlays.tsx` | Pause Modal (with Controls Guide access), Live Scoreboard, Match Results, and Credits Modal. |

---

## 3. Gameplay & Controls Reference

### Keyboard + Mouse (Default P1)
- **Move Forward / Back / Strafe Left / Right:** `W` / `S` / `A` / `D` (camera-relative 3D)
- **Jump (tap) / Jetpack (hold):** `Space`
- **Rotate Camera 360° & Pitch Up/Down:** Mouse movement (click arena for FPS/TPS Pointer Lock, or Arrow keys)
- **Fire / Zoom:** `Left Click` / `Right Click` (Wheel adjusts manual zoom)
- **Reload / Pick Up Weapon:** `R` / `E`
- **Switch Weapon / Secondary Mode:** `Q` / `V`
- **Throw Grenade / Cycle Grenade:** `G` / `C`
- **Melee Attack:** `F`
- **Scoreboard / Pause:** `Tab` / `Escape`

### Xbox / Gamepad Mapping (P1 or P2)
- **Left Stick (Pouce Gauche):** 3D multi-axis movement relative to camera gaze (menu navigation in UI)
- **Right Stick (Pouce Droit):** Rotate camera Left/Right/Up/Down (`aimYaw`/`aimPitch`) + 360° 3D aim + subtle aim assist
- **RT / LT:** Fire 3D (hold for auto) / Weapon-dependent optic & arm Zoom
- **A:** Jump (tap) / Jetpack Thrust (hold)
- **B:** Melee Strike (also Back in menus)
- **X:** Context-sensitive Pick Up Weapon (near crate) or Reload
- **Y:** Switch Weapon
- **RB / LB:** Throw Grenade / Secondary Weapon Function
- **D-Pad Up/Down:** Manual Zoom Adjust
- **D-Pad Left/Right:** Cycle Grenade Type (`frag` → `incendiary` → `proximity`)
- **Start / View:** Pause Menu / Scoreboard

### P2 Keyboard Fallback (if testing 2P without 2 controllers)
- **Move 3D:** `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight`
- **Rotate Camera Left/Right/Up/Down:** `J` / `L` / `I` / `K`
- **Jump / Jetpack:** `Numpad0` or `Right Ctrl`
- **Fire / Zoom:** `Enter` (`Numpad1`) / `Right Shift`
- **Reload/Pickup / Swap / Grenade / Melee:** `Numpad2` (`P`) / `Numpad3` (`[`) / `Numpad4` (`]`) / `Numpad5` (`\`)

---

## 4. Technical Invariants & Performance Rules

1. **Zero GC in Render Loop:** `ParticlePool`, `ArenaRenderer`, and `CameraSystem` reuse pre-allocated `Object3D`, `Vector3`, `Quaternion`, and `Color` instances outside `tick()`.
2. **Software WebGL Guard:** `detectSoftwareWebGL()` disables MSAA/shadows and switches the loop from `requestAnimationFrame` to `gl.fenceSync` + `afterDraw()` so headless / software WebGL environments never starve the main thread.
3. **No `backdrop-filter` Over WebGL:** All HUD and modal layers use solid or `rgba` Tailwind backgrounds (`bg-slate-950/90`) without `backdrop-blur` to preserve 60 FPS WebGL compositing.
4. **Standardized 3D Gameplay Hitbox:** All characters use `PLAYER_RADIUS = 0.44`, `PLAYER_HEIGHT = 1.78` in `Physics.ts` regardless of cosmetic headgear/armor choices.
5. **Sub-Stepped 3D Collision & Raycasting:** Character movement runs sub-stepped axis-separated 3D AABB collision (`resolveCharacterMapCollision3D`) and projectiles + chase cameras use `segmentIntersectsBox3D` / `raycastSolidPlatforms3D` so neither players, bullets, grenades, nor cameras ever pass through map walls or floors.

---

## 5. Future Online Multiplayer Migration Guide

To enable online multiplayer later:
1. Create a Node.js + WebSocket (`ws`) server that instantiates `new GameSimulation(matchConfig)` per room at a fixed `60Hz` tick (`setInterval(..., 1000 / 60)`).
2. Have clients send `PlayerInputFrame` messages over WebSocket.
3. Implement `WebSocketMatchTransport implements IMatchTransport` in `src/game/net/MatchTransport.ts` that sends local `PlayerInputFrame`s to the server and buffers/interpolates incoming `MatchSnapshot`s (using `tick` and `elapsed` timestamps) for `ArenaRenderer.renderMatch()`.
4. Keep `LocalMatchTransport` intact for offline Training and Local 2P Split-Screen.

---

## 6. Changelog

### v2.0.0 — Full 3D Multi-Axis Look, Collision & Graphics Upgrade + Controls Guide
- Upgraded simulation, physics, Bot AI, and input from single-plane 2.5D to true **3D multi-axis gameplay** (`X, Y, Z` camera-relative movement, free 360° horizontal `aimYaw` + vertical `aimPitch` camera rotation via Xbox Right Thumbstick or Pointer-Locked Mouse Look, and omni-directional 3D shooting/grenades/melee).
- Implemented sub-stepped 3D axis-separated AABB collision (`resolveCharacterMapCollision3D`) and continuous 3D ray-box checks (`segmentIntersectsBox3D`) for players, projectiles, grenades, and the chase camera spring-arm so nothing clips or passes through arena boundaries, walls, or platforms.
- Upgraded **SKYBREAK** Title Screen lockup and created `ControlsGuideModal.tsx` with annotated SVG Xbox Controller (Left/Right Thumbsticks, Triggers, Buttons, D-Pad) and Keyboard/Mouse visual diagrams.
- Enhanced 3D graphics with a custom GLSL atmospheric Sky Dome, 512px procedural PBR surface textures, 2048px shadows, pooled dynamic muzzle/explosion `PointLight` flashes, 3D quaternion-oriented projectiles, 3D shockwave blasts, and 360° orbital showcase & vistas across all 6 arenas.

### v1.0.0 — Initial Full Build
- Built complete **SKYBREAK** 3D 2.5D jetpack arena shooter architecture in TypeScript + Three.js + React.
- Implemented 10 distinct weapons with unique zoom profiles, 3 grenade types (`frag`, `incendiary`, `proximity`), and rotating pickup pedestals.
- Built 6 original playable 3D arenas (`Ironworks`, `Hollow Rift`, `Skybridge`, `Frostline`, `Red Canyon`, `Orbital Station`) with procedural PBR textures and parallax vistas.
- Built 12+ part articulated 3D character rig with 8 original presets and full modular customization + `localStorage` persistence.
- Implemented Local 1P vs Bots, Offline Training, and **Local 2-Player Dynamic Split-Screen** (auto-merges when close, splits Left/Right or Top/Bottom when separated) with simultaneous Keyboard/Mouse + dual Xbox Gamepad API support.
- Implemented 3-tier intelligent Bot AI (`easy`, `normal`, `hard`), procedural Web Audio `SoundEngine`, and `IMatchTransport` boundary for future online multiplayer.
