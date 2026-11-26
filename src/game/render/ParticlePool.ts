import * as THREE from 'three';
import { ParticleEvent, ProjectileState } from '../types';

interface ActiveParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

interface ActiveRing {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  maxRadius: number;
}

const MAX_PARTICLES = 260;
const MAX_PROJECTILES = 140;
const MAX_RINGS = 16;

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export class EffectsPool {
  private particleMesh: THREE.InstancedMesh;
  private particles: ActiveParticle[] = [];

  private projectileMesh: THREE.InstancedMesh;
  private rings: ActiveRing[] = [];
  private group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    // Pooled particle cubes/sparks
    const pGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, MAX_PARTICLES);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        color: new THREE.Color(0xffffff),
      });
      this.particleMesh.setColorAt(i, _color);
    }
    this.group.add(this.particleMesh);

    // Pooled projectile tracer bolts
    const bGeo = new THREE.BoxGeometry(0.55, 0.11, 0.11);
    const bMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.projectileMesh = new THREE.InstancedMesh(bGeo, bMat, MAX_PROJECTILES);
    this.projectileMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.projectileMesh.frustumCulled = false;
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      _dummy.position.set(0, -999, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.projectileMesh.setMatrixAt(i, _dummy.matrix);
      this.projectileMesh.setColorAt(i, _color);
    }
    this.group.add(this.projectileMesh);

    // Pooled shockwave rings
    const ringGeo = new THREE.RingGeometry(0.75, 1.0, 24);
    for (let i = 0; i < MAX_RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push({ mesh, life: 0, maxLife: 0.35, maxRadius: 4 });
    }

    scene.add(this.group);
  }

  public emitEvents(events: ParticleEvent[]): void {
    for (const ev of events) {
      if (ev.type === 'muzzle') {
        this.spawnBurst(ev.x, ev.y, 4, 4.5, 0.14, 0.9, ev.color || '#fde047');
      } else if (ev.type === 'impact' || ev.type === 'hit_spark') {
        this.spawnBurst(ev.x, ev.y, 7, 6.5, 0.24, 1.0, ev.color || '#facc15');
      } else if (ev.type === 'explosion' || ev.type === 'fire_burst') {
        this.spawnBurst(ev.x, ev.y, 24, 13.0, 0.48, 2.2, ev.color || '#f97316');
        this.spawnRing(ev.x, ev.y, ev.radius || 4.0, ev.color || '#f97316');
      } else if (ev.type === 'pickup' || ev.type === 'respawn') {
        this.spawnBurst(ev.x, ev.y, 12, 5.5, 0.4, 1.3, ev.color || '#38bdf8');
      } else if (ev.type === 'melee_slash') {
        this.spawnBurst(ev.x, ev.y, 10, 7.5, 0.22, 1.4, ev.color || '#e879f9');
      }
    }
  }

  public spawnJetpackExhaust(x: number, y: number, colorHex: string): void {
    this.spawnSingle(
      x + (Math.random() - 0.5) * 0.2,
      y,
      (Math.random() - 0.5) * 0.25,
      (Math.random() - 0.5) * 1.4,
      -4.5 - Math.random() * 2.5,
      0,
      0.24,
      1.1,
      colorHex
    );
  }

  private spawnBurst(
    x: number,
    y: number,
    count: number,
    speed: number,
    life: number,
    size: number,
    colorHex: string
  ): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * (0.35 + Math.random() * 0.65);
      this.spawnSingle(
        x,
        y,
        (Math.random() - 0.5) * 0.3,
        Math.cos(ang) * spd,
        Math.sin(ang) * spd,
        (Math.random() - 0.5) * spd * 0.35,
        life * (0.7 + Math.random() * 0.5),
        size,
        colorHex
      );
    }
  }

  private spawnSingle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    colorHex: string
  ): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        p.vx = vx;
        p.vy = vy;
        p.vz = vz;
        p.life = life;
        p.maxLife = life;
        p.size = size;
        p.color.set(colorHex);
        return;
      }
    }
  }

  private spawnRing(x: number, y: number, maxRadius: number, colorHex: string): void {
    for (const r of this.rings) {
      if (r.life <= 0) {
        r.life = 0.35;
        r.maxLife = 0.35;
        r.maxRadius = maxRadius;
        r.mesh.position.set(x, y, 0.2);
        r.mesh.scale.setScalar(0.2);
        (r.mesh.material as THREE.MeshBasicMaterial).color.set(colorHex);
        r.mesh.visible = true;
        return;
      }
    }
  }

  public update(dt: number, projectiles: ProjectileState[]): void {
    // Update particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) {
        _dummy.position.set(0, -999, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _dummy.position.set(0, -999, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 9.5 * dt;

      const s = p.size * (p.life / p.maxLife);
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.life * 6, p.life * 4, 0);
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, p.color);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;

    // Update projectile instances
    const projCount = Math.min(projectiles.length, MAX_PROJECTILES);
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      if (i < projCount) {
        const pr = projectiles[i];
        const angle = Math.atan2(pr.vy, pr.vx);
        _dummy.position.set(pr.x, pr.y, 0);
        _dummy.rotation.set(0, 0, angle);
        const scaleX = pr.weaponId === 'rocket_launcher' ? 1.7 : pr.weaponId === 'sniper' ? 2.2 : 1.0;
        const scaleY = pr.weaponId === 'rocket_launcher' ? 2.2 : pr.isEnergy ? 1.6 : 1.0;
        _dummy.scale.set(scaleX, scaleY, scaleY);
        _dummy.updateMatrix();
        _color.set(pr.color);
        this.projectileMesh.setMatrixAt(i, _dummy.matrix);
        this.projectileMesh.setColorAt(i, _color);
      } else {
        _dummy.position.set(0, -999, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.projectileMesh.setMatrixAt(i, _dummy.matrix);
      }
    }
    this.projectileMesh.instanceMatrix.needsUpdate = true;
    if (this.projectileMesh.instanceColor) this.projectileMesh.instanceColor.needsUpdate = true;

    // Update rings
    for (const r of this.rings) {
      if (r.life > 0) {
        r.life -= dt;
        const progress = 1 - Math.max(0, r.life) / r.maxLife;
        r.mesh.scale.setScalar(0.3 + progress * r.maxRadius);
        (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.85;
        if (r.life <= 0) r.mesh.visible = false;
      }
    }
  }

  public dispose(): void {
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.projectileMesh.geometry.dispose();
    (this.projectileMesh.material as THREE.Material).dispose();
  }
}
