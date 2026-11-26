import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MAPS } from '../data/maps';
import {
  MapData,
  MapId,
  MatchSnapshot,
  SplitScreenMode,
} from '../types';
import { CameraSystem } from './CameraSystem';
import {
  animateCharacterRig,
  buildCharacterRig,
  CharacterRig,
  serializeAppearance,
} from './CharacterBuilder';
import { buildFlagMesh, buildMapSceneGeometry } from './MapBuilder';
import { EffectsPool } from './ParticlePool';
import { buildGrenadeMesh, buildPickupPedestalMesh } from './WeaponBuilder';

export function detectSoftwareWebGL(): boolean {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

interface FlashLightSlot {
  light: THREE.PointLight;
  life: number;
}

export class ArenaRenderer {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly isSoftwareGl: boolean;
  public readonly scene: THREE.Scene;
  public readonly cameras: CameraSystem;

  private effects: EffectsPool;
  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;
  private flashLights: FlashLightSlot[] = [];

  private mapGroup: THREE.Group | null = null;
  private animatedProps: THREE.Object3D[] = [];
  private currentMapId: MapId | null = null;

  private characterRigs = new Map<string, CharacterRig>();
  private pickupMeshes = new Map<string, THREE.Group>();
  private grenadeMeshes = new Map<number, THREE.Group>();
  private hazardMeshes = new Map<number, THREE.Mesh>();
  private flagMeshes: { team1: THREE.Group; team2: THREE.Group };

  private width = 1280;
  private height = 720;

  constructor(container: HTMLElement) {
    this.isSoftwareGl = detectSoftwareWebGL();
    this.width = container.clientWidth || window.innerWidth;
    this.height = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.setSize(this.width, this.height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    // Three-point warm/cool lighting rig
    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x334155, 0.9);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff4e0, 2.3);
    this.keyLight.position.set(22, 38, 26);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 110;
    const d = 44;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x60a5fa, 0.85);
    this.rimLight.position.set(-24, 16, -24);
    this.scene.add(this.rimLight);

    // Pooled dynamic point lights for weapon muzzle flashes & blasts
    for (let i = 0; i < 3; i++) {
      const light = new THREE.PointLight(0xfde047, 0, 14, 2);
      this.scene.add(light);
      this.flashLights.push({ light, life: 0 });
    }

    this.cameras = new CameraSystem(this.width / Math.max(1, this.height));
    this.effects = new EffectsPool(this.scene);

    this.flagMeshes = {
      team1: buildFlagMesh(1),
      team2: buildFlagMesh(2),
    };
    this.flagMeshes.team1.visible = false;
    this.flagMeshes.team2.visible = false;
    this.scene.add(this.flagMeshes.team1, this.flagMeshes.team2);

    this.loadMap('ironworks');
  }

  public resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height);
    this.cameras.camP1.aspect = this.width / this.height;
    this.cameras.camP1.updateProjectionMatrix();
  }

  public loadMap(mapId: MapId): void {
    if (this.currentMapId === mapId) return;
    this.currentMapId = mapId;

    if (this.mapGroup) {
      this.scene.remove(this.mapGroup);
      this.mapGroup.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mt) => mt.dispose());
          else m.material.dispose();
        }
      });
    }

    for (const pkMesh of this.pickupMeshes.values()) {
      this.scene.remove(pkMesh);
    }
    this.pickupMeshes.clear();

    const map = MAPS[mapId];
    this.scene.background = new THREE.Color(map.theme.skyBottom);
    this.scene.fog = new THREE.Fog(
      map.theme.fogColor,
      map.theme.fogNear,
      map.theme.fogFar
    );
    this.keyLight.color.set(map.theme.keyLightColor);
    this.keyLight.intensity = map.theme.keyLightIntensity;
    this.hemiLight.color.set(map.theme.hemiSkyColor);
    this.hemiLight.groundColor.set(map.theme.hemiGroundColor);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const built = buildMapSceneGeometry(map, maxAniso);
    this.mapGroup = built.group;
    this.animatedProps = built.animatedProps;
    this.scene.add(this.mapGroup);

    for (const sp of map.pickupSpawns) {
      const pk = buildPickupPedestalMesh(sp.kind, sp.weaponId);
      pk.position.set(sp.x, sp.y - 0.5, sp.z);
      this.scene.add(pk);
      this.pickupMeshes.set(sp.id, pk);
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.cameras.camP1);
    }
  }

  private triggerFlashLight(x: number, y: number, z: number, colorHex: string, intensity: number, dur: number): void {
    let slot = this.flashLights[0];
    for (const fl of this.flashLights) {
      if (fl.life <= 0) {
        slot = fl;
        break;
      }
      if (fl.life < slot.life) slot = fl;
    }
    slot.light.position.set(x, y, z);
    slot.light.color.set(colorHex);
    slot.light.intensity = intensity;
    slot.life = dur;
  }

  public renderTitleShowcase(mapId: MapId, elapsed: number): void {
    this.loadMap(mapId);
    this.flagMeshes.team1.visible = false;
    this.flagMeshes.team2.visible = false;
    for (const rig of this.characterRigs.values()) rig.root.visible = false;

    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, this.width, this.height);

    this.cameras.camP1.aspect = this.width / Math.max(1, this.height);
    if (this.cameras.camP1.fov !== 56) {
      this.cameras.camP1.fov = 56;
    }
    this.cameras.camP1.updateProjectionMatrix();

    // Smooth 360-degree elevated orbital showcase sweep across the 3D arena
    const orbitAngle = elapsed * 0.16;
    this.cameras.camP1.position.set(
      Math.sin(orbitAngle) * 21,
      11.5 + Math.sin(elapsed * 0.4) * 2.5,
      Math.cos(orbitAngle) * 18
    );
    this.cameras.camP1.lookAt(0, 5.5, 0);

    this.animateEnvironment(elapsed, 0.016);
    this.renderer.render(this.scene, this.cameras.camP1);
  }

  public renderMatch(
    snapshot: MatchSnapshot,
    twoPlayerLocal: boolean,
    splitMode: SplitScreenMode,
    splitOrientation: 'vertical' | 'horizontal',
    dt: number
  ): void {
    this.loadMap(snapshot.mapId);
    const map: MapData = MAPS[snapshot.mapId];

    // Sync characters in full 3D
    const activeIds = new Set<string>();
    for (const p of snapshot.players) {
      activeIds.add(p.id);
      let rig = this.characterRigs.get(p.id);
      const appKey = serializeAppearance(p.appearance);
      if (!rig || rig.appearanceKey !== appKey) {
        if (rig) this.scene.remove(rig.root);
        rig = buildCharacterRig(p.appearance, p.team);
        this.scene.add(rig.root);
        this.characterRigs.set(p.id, rig);
      }
      animateCharacterRig(rig, p, snapshot.elapsed, dt);

      if (p.alive && p.jetpackActive && Math.random() < 0.78) {
        const backX = p.x + Math.sin(p.aimYaw) * 0.36;
        const backZ = p.z + Math.cos(p.aimYaw) * 0.36;
        this.effects.spawnJetpackExhaust(backX, p.y + 0.52, backZ, p.appearance.flameColor);
      }
    }
    for (const [id, rig] of this.characterRigs.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(rig.root);
        this.characterRigs.delete(id);
      }
    }

    // Sync pickups in 3D
    for (const pk of snapshot.pickups) {
      const mesh = this.pickupMeshes.get(pk.id);
      if (!mesh) continue;
      const floatItem = mesh.getObjectByName('floatingItem');
      if (floatItem) {
        floatItem.visible = pk.available;
        floatItem.rotation.y = snapshot.elapsed * 1.8;
        floatItem.position.y = 0.72 + Math.sin(snapshot.elapsed * 3.2 + pk.x + pk.z) * 0.12;
      }
    }

    // Sync grenades in 3D
    const activeGrenades = new Set<number>();
    for (const g of snapshot.grenades) {
      activeGrenades.add(g.id);
      let gm = this.grenadeMeshes.get(g.id);
      if (!gm) {
        gm = buildGrenadeMesh(g.type);
        this.scene.add(gm);
        this.grenadeMeshes.set(g.id, gm);
      }
      gm.position.set(g.x, g.y, g.z);
      if (g.type !== 'proximity') {
        gm.rotation.z -= dt * 8;
        gm.rotation.x += dt * 5;
      }
    }
    for (const [gid, gm] of this.grenadeMeshes.entries()) {
      if (!activeGrenades.has(gid)) {
        this.scene.remove(gm);
        this.grenadeMeshes.delete(gid);
      }
    }

    // Sync incendiary hazard zones in 3D
    const activeHazards = new Set<number>();
    for (const hz of snapshot.hazardZones) {
      activeHazards.add(hz.id);
      let hm = this.hazardMeshes.get(hz.id);
      if (!hm) {
        hm = new THREE.Mesh(
          new THREE.SphereGeometry(hz.radius, 18, 12),
          new THREE.MeshBasicMaterial({
            color: 0xf97316,
            transparent: true,
            opacity: 0.28,
            wireframe: true,
          })
        );
        this.scene.add(hm);
        this.hazardMeshes.set(hz.id, hm);
      }
      hm.position.set(hz.x, hz.y, hz.z);
      hm.rotation.y += dt * 3;
      const pulse = 0.92 + Math.sin(snapshot.elapsed * 14) * 0.08;
      hm.scale.setScalar(pulse);
    }
    for (const [hid, hm] of this.hazardMeshes.entries()) {
      if (!activeHazards.has(hid)) {
        this.scene.remove(hm);
        hm.geometry.dispose();
        (hm.material as THREE.Material).dispose();
        this.hazardMeshes.delete(hid);
      }
    }

    // Sync CTF flags in 3D
    const showFlags = snapshot.mode === 'ctf';
    this.flagMeshes.team1.visible = showFlags;
    this.flagMeshes.team2.visible = showFlags;
    if (showFlags) {
      this.flagMeshes.team1.position.set(
        snapshot.flags.team1.x,
        snapshot.flags.team1.y - 0.5,
        snapshot.flags.team1.z
      );
      this.flagMeshes.team2.position.set(
        snapshot.flags.team2.x,
        snapshot.flags.team2.y - 0.5,
        snapshot.flags.team2.z
      );
    }

    // Dynamic flash lights on gunfire & explosions
    for (const ev of snapshot.particleEvents) {
      if (ev.type === 'muzzle') {
        this.triggerFlashLight(ev.x, ev.y, ev.z, ev.color || '#fde047', 6.5, 0.07);
      } else if (ev.type === 'explosion') {
        this.triggerFlashLight(ev.x, ev.y, ev.z, ev.color || '#f97316', 18, 0.22);
      }
    }
    for (const fl of this.flashLights) {
      if (fl.life > 0) {
        fl.life -= dt;
        if (fl.life <= 0) fl.light.intensity = 0;
        else fl.light.intensity *= 0.84;
      }
    }

    // Particles & Projectiles
    this.effects.emitEvents(snapshot.particleEvents);
    this.effects.update(dt, snapshot.projectiles);
    this.animateEnvironment(snapshot.elapsed, dt);

    // Update 3D Camera(s) & Render (single or dynamic split-screen)
    this.cameras.update(
      snapshot.players,
      map,
      twoPlayerLocal,
      splitMode,
      splitOrientation,
      this.width,
      this.height,
      snapshot.screenShake,
      dt
    );

    if (!this.cameras.isSplitScreenActive()) {
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, this.width, this.height);
      this.renderer.render(this.scene, this.cameras.camP1);
    } else {
      this.renderer.setScissorTest(true);
      if (splitOrientation === 'vertical') {
        const halfW = Math.floor(this.width * 0.5);
        this.renderer.setViewport(0, 0, halfW, this.height);
        this.renderer.setScissor(0, 0, halfW, this.height);
        this.renderer.render(this.scene, this.cameras.camP1);
        this.renderer.setViewport(halfW, 0, this.width - halfW, this.height);
        this.renderer.setScissor(halfW, 0, this.width - halfW, this.height);
        this.renderer.render(this.scene, this.cameras.camP2);
      } else {
        const halfH = Math.floor(this.height * 0.5);
        this.renderer.setViewport(0, halfH, this.width, this.height - halfH);
        this.renderer.setScissor(0, halfH, this.width, this.height - halfH);
        this.renderer.render(this.scene, this.cameras.camP1);
        this.renderer.setViewport(0, 0, this.width, halfH);
        this.renderer.setScissor(0, 0, this.width, halfH);
        this.renderer.render(this.scene, this.cameras.camP2);
      }
    }
  }

  private animateEnvironment(elapsed: number, dt: number): void {
    for (const obj of this.animatedProps) {
      obj.rotation.z += dt * 0.25;
      obj.rotation.y += dt * 0.14;
      obj.position.y += Math.sin(elapsed * 1.4 + obj.position.x) * dt * 0.14;
    }
    for (const pk of this.pickupMeshes.values()) {
      const floatItem = pk.getObjectByName('floatingItem');
      if (floatItem && floatItem.visible) {
        floatItem.rotation.y = elapsed * 1.8;
      }
    }
  }

  public dispose(): void {
    this.effects.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
