# SKYBREAK — 3D Jetpack Arena Shooter (Technical Reference & Dev Log)

> **Purpose of this file:** Complete technical reference, architecture guide, and living changelog for **SKYBREAK**. Read this file first before modifying the codebase so every system, invariant, and extension point is understood immediately.

---

## 1. Project Overview & Scope

**SKYBREAK** is a fast-paced 2.5D side-view 3D jetpack arena shooter built with **React 19**, **TypeScript**, **Three.js**, **Tailwind CSS v4**, and **Web Audio API**.

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
| `src/game/data/maps.ts` | 6 original playable 2.5D arenas (`ironworks`, `hollow_rift`, `skybridge`, `frostline`, `red_canyon`, `orbital_station`) with multi-tier solid/one-way platforms, cover, weapon/health/ammo spawns, safe spawn points, and CTF flag bases. |
| `src/game/data/cosmetics.ts` | 8 original character archetypes + modular cosmetic palettes/styles (skin, hair, face, headgear, jacket, pants, boots, gloves, backpack, jetpack, flames, accessories). Standardized hitbox enforced. |
| `src/game/sim/Physics.ts` | Constants (`PLAYER_HALF_W = 0.42`, `PLAYER_HEIGHT = 1.75`), continuous `segmentIntersectsRect` ray-AABB collision, line-of-sight checks, and arcade 2.5D movement/platform collision resolution. |
| `src/game/sim/BotAI.ts` | Modular Bot AI (`easy`, `normal`, `hard`) with platform/jetpack pathing, void avoidance, weapon/health pickup seeking, target velocity leading, incoming projectile dodging, grenade throwing, and CTF objective priority. |
| `src/game/sim/GameSimulation.ts` | Fixed-timestep (`1/60s`) authoritative match simulation supporting 5 modes (`deathmatch`, `team_deathmatch`, `ctf`, `survival`, `training`), up to 8 combatants, continuous bullet/wall collision, explosive splash + knockback, grenades, pickups, spawn protection, hitstop, and kill feed. |
| `src/game/net/MatchTransport.ts` | `IMatchTransport` interface + `LocalMatchTransport` accumulator wrapper + blueprint for future `WebSocketMatchTransport`. |
| `src/game/input/InputManager.ts` | Simultaneous Keyboard/Mouse + Gamepad API (`gamepadconnected`/`gamepaddisconnected` live detection, dual-stick aiming, dead zones, aim acceleration, subtle aim assist, vibration rumble, manual zoom, and controller menu navigation). |
| `src/game/audio/SoundEngine.ts` | 100% procedural Web Audio API synthesizer (weapon fire per weapon class, reload, empty click, continuous modulated jetpack thrust, jump/land, explosions, pickups, hit marker, UI clicks). |
| `src/game/render/WeaponBuilder.ts` | Procedural multi-part 3D models for all 10 weapons, 3 grenades, and rotating pickup pedestals. |
| `src/game/render/CharacterBuilder.ts` | Procedural 12+ part articulated 3D humanoid rig with cosmetic variants, animated thruster flames, spawn shield bubble, contact shadow, and procedural run/jump/jetpack/aim/reload/melee animations. |
| `src/game/render/MapBuilder.ts` | Procedural canvas PBR textures (`SRGBColorSpace`, anisotropy), playable platform meshes with edge trim strips, CTF flag meshes, and per-map 3D parallax background vistas. |
| `src/game/render/ParticlePool.ts` | Zero-GC `EffectsPool` using `InstancedMesh` for particles & projectiles and pooled shockwave rings. |
| `src/game/render/CameraSystem.ts` | Smooth damped 2.5D side-view camera(s) with weapon-dependent zoom profiles, aim lookahead, threat framing, manual zoom offset, and **2-Player Dynamic Split-Screen** (auto-merges when close, splits Left/Right or Top/Bottom with hysteresis at 16.5 / 13.0 units). |
| `src/game/render/ArenaRenderer.ts` | WebGLRenderer setup (`detectSoftwareWebGL`, `RoomEnvironment` PMREM, 3-point lighting, fog), entity synchronization, and single/scissor-split viewport rendering. |
| `src/components/CharacterPreview3D.tsx` | Isolated Three.js turntable preview for Character Customization (mouse drag + Xbox Right Stick rotation). |
| `src/components/CustomizationScreen.tsx` | Full P1 & P2 Character Hangar UI with 8 presets and modular tabs. |
| `src/components/MatchSetupModal.tsx` | Match configuration modal (1P vs 2P Local Split-Screen, 5 modes, 6 maps, bots, input device assignment, split behavior). |
| `src/components/GameHUD.tsx` | Low-occlusion HUD for both 1P full-screen and 2P dynamic/split-screen (HP, Fuel, Zoom state, Ammo, Grenades, Pickup prompt, Kill feed, Timer/Score). |
| `src/components/SettingsModal.tsx` | Xbox controller tuning, key remapping, audio sliders, and split-screen settings. |
| `src/components/MatchOverlays.tsx` | Pause Modal, Live Scoreboard, Match Results, and Credits Modal. |

---

## 3. Gameplay & Controls Reference

### Keyboard + Mouse (Default P1)
- **Move Left / Right:** `A` / `D`
- **Drop Through One-Way Catwalk:** `S`
- **Jump (tap) / Jetpack (hold):** `Space`
- **Aim:** Mouse cursor (projected onto Z=0 gameplay plane)
- **Fire / Zoom:** `Left Click` / `Right Click` (Wheel adjusts manual zoom)
- **Reload / Pick Up Weapon:** `R` / `E`
- **Switch Weapon / Secondary Mode:** `Q` / `V`
- **Throw Grenade / Cycle Grenade:** `G` / `C`
- **Melee Attack:** `F`
- **Scoreboard / Pause:** `Tab` / `Escape`

### Xbox / Gamepad Mapping (P1 or P2)
- **Left Stick:** Move left/right, down to drop through platforms, menu navigation
- **Right Stick:** 360° dual-stick aiming (with configurable deadzone, acceleration, sensitivity & aim assist)
- **RT / LT:** Fire (hold for auto) / Weapon-dependent Zoom
- **A:** Jump (tap) / Jetpack Thrust (hold)
- **B:** Melee Strike (also Back in menus)
- **X:** Context-sensitive Pick Up Weapon (near crate) or Reload
- **Y:** Switch Weapon
- **RB / LB:** Throw Grenade / Secondary Weapon Function
- **D-Pad Up/Down:** Manual Zoom Adjust
- **D-Pad Left/Right:** Cycle Grenade Type (`frag` → `incendiary` → `proximity`)
- **Start / View:** Pause Menu / Scoreboard

### P2 Keyboard Fallback (if testing 2P without 2 controllers)
- **Move:** `ArrowLeft` / `ArrowRight` (`ArrowDown` drop)
- **Jump / Jetpack:** `ArrowUp` or `Numpad0`
- **Fire / Zoom:** `Enter` (`Numpad1`) / `Right Shift`
- **Reload/Pickup / Swap / Grenade / Melee:** `Numpad2` (`P`) / `Numpad3` (`[`) / `Numpad4` (`]`) / `Numpad5` (`\`)

---

## 4. Technical Invariants & Performance Rules

1. **Zero GC in Render Loop:** `ParticlePool`, `ArenaRenderer`, and `CameraSystem` reuse pre-allocated `Object3D`, `Vector3`, `Raycaster`, and `Color` instances outside `tick()`.
2. **Software WebGL Guard:** `detectSoftwareWebGL()` disables MSAA/shadows and switches the loop from `requestAnimationFrame` to `gl.fenceSync` + `afterDraw()` so headless / software WebGL environments never starve the main thread.
3. **No `backdrop-filter` Over WebGL:** All HUD and modal layers use solid or `rgba` Tailwind backgrounds (`bg-slate-950/90`) without `backdrop-blur` to preserve 60 FPS WebGL compositing.
4. **Standardized Gameplay Hitbox:** All characters use `PLAYER_HALF_W = 0.42`, `PLAYER_HEIGHT = 1.75` in `Physics.ts` regardless of cosmetic headgear/armor choices.
5. **Continuous Ray Collision:** Projectiles use `segmentIntersectsRect(prevX, prevY, x, y, ...)` so high-velocity sniper rounds never tunnel through solid walls or players.

---

## 5. Future Online Multiplayer Migration Guide

To enable online multiplayer later:
1. Create a Node.js + WebSocket (`ws`) server that instantiates `new GameSimulation(matchConfig)` per room at a fixed `60Hz` tick (`setInterval(..., 1000 / 60)`).
2. Have clients send `PlayerInputFrame` messages over WebSocket.
3. Implement `WebSocketMatchTransport implements IMatchTransport` in `src/game/net/MatchTransport.ts` that sends local `PlayerInputFrame`s to the server and buffers/interpolates incoming `MatchSnapshot`s (using `tick` and `elapsed` timestamps) for `ArenaRenderer.renderMatch()`.
4. Keep `LocalMatchTransport` intact for offline Training and Local 2P Split-Screen.

---

## 6. Changelog

### v1.0.0 — Initial Full Build
- Built complete **SKYBREAK** 3D 2.5D jetpack arena shooter architecture in TypeScript + Three.js + React.
- Implemented 10 distinct weapons with unique zoom profiles, 3 grenade types (`frag`, `incendiary`, `proximity`), and rotating pickup pedestals.
- Built 6 original playable 3D arenas (`Ironworks`, `Hollow Rift`, `Skybridge`, `Frostline`, `Red Canyon`, `Orbital Station`) with procedural PBR textures and parallax vistas.
- Built 12+ part articulated 3D character rig with 8 original presets and full modular customization + `localStorage` persistence.
- Implemented Local 1P vs Bots, Offline Training, and **Local 2-Player Dynamic Split-Screen** (auto-merges when close, splits Left/Right or Top/Bottom when separated) with simultaneous Keyboard/Mouse + dual Xbox Gamepad API support.
- Implemented 3-tier intelligent Bot AI (`easy`, `normal`, `hard`), procedural Web Audio `SoundEngine`, and `IMatchTransport` boundary for future online multiplayer.
