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
  gravity: number;
  color: THREE.Color;
}

interface ActiveBlast {
  ring: THREE.Mesh;
  core: THREE.Mesh;
  life: number;
  maxLife: number;
  maxRadius: number;
}

const MAX_PARTICLES = 380;
const MAX_PROJECTILES = 160;
const MAX_BLASTS = 18;

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _fwd = new THREE.Vector3(0, 0, 1);
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();

export class EffectsPool {
  private particleMesh: THREE.InstancedMesh;
  private particles: ActiveParticle[] = [];

  private projectileMesh: THREE.InstancedMesh;
  private blasts: ActiveBlast[] = [];
  private group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    // Pooled 3D particle sparks & smoke cubes
    const pGeo = new THREE.IcosahedronGeometry(0.12, 0);
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
        gravity: 9.5,
        color: new THREE.Color(0xffffff),
      });
      this.particleMesh.setColorAt(i, _color);
    }
    this.group.add(this.particleMesh);

    // Pooled 3D projectile tracer bolts (+Z aligned for quaternion look direction)
    const bGeo = new THREE.BoxGeometry(0.11, 0.11, 0.72);
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

    // Pooled 3D explosion shockwave rings & flash cores
    const ringGeo = new THREE.TorusGeometry(0.88, 0.09, 8, 24);
    const coreGeo = new THREE.SphereGeometry(0.6, 12, 10);
    for (let i = 0; i < MAX_BLASTS; i++) {
      const rMat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, rMat);
      ring.rotation.x = Math.PI / 2;
      ring.visible = false;

      const cMat = new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const core = new THREE.Mesh(coreGeo, cMat);
      core.visible = false;

      this.group.add(ring, core);
      this.blasts.push({ ring, core, life: 0, maxLife: 0.36, maxRadius: 4 });
    }

    scene.add(this.group);
  }

  public emitEvents(events: ParticleEvent[]): void {
    for (const ev of events) {
      if (ev.type === 'muzzle') {
        this.spawnBurst3D(ev.x, ev.y, ev.z, 6, 5.2, 0.14, 0.95, ev.color || '#fde047', 1.5);
      } else if (ev.type === 'impact' || ev.type === 'hit_spark') {
        this.spawnBurst3D(ev.x, ev.y, ev.z, 9, 7.0, 0.26, 1.05, ev.color || '#facc15', 11.0);
      } else if (ev.type === 'explosion' || ev.type === 'fire_burst') {
        this.spawnBurst3D(ev.x, ev.y, ev.z, 28, 13.5, 0.52, 2.3, ev.color || '#f97316', 7.5);
        this.spawnBlast3D(ev.x, ev.y, ev.z, ev.radius || 4.0, ev.color || '#f97316');
      } else if (ev.type === 'pickup' || ev.type === 'respawn') {
        this.spawnBurst3D(ev.x, ev.y, ev.z, 14, 5.8, 0.42, 1.3, ev.color || '#38bdf8', -1.8);
      } else if (ev.type === 'melee_slash') {
        this.spawnBurst3D(ev.x, ev.y, ev.z, 12, 8.0, 0.22, 1.4, ev.color || '#e879f9', 2.0);
      }
    }
  }

  public spawnJetpackExhaust(x: number, y: number, z: number, colorHex: string): void {
    this.spawnSingle(
      x + (Math.random() - 0.5) * 0.28,
      y,
      z + (Math.random() - 0.5) * 0.28,
      (Math.random() - 0.5) * 1.6,
      -4.8 - Math.random() * 2.6,
      (Math.random() - 0.5) * 1.6,
      0.26,
      1.15,
      -1.0,
      colorHex
    );
  }

  private spawnBurst3D(
    x: number,
    y: number,
    z: number,
    count: number,
    speed: number,
    life: number,
    size: number,
    colorHex: string,
    gravity: number
  ): void {
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const spd = speed * (0.35 + Math.random() * 0.65);
      const sp = Math.sin(phi);
      this.spawnSingle(
        x,
        y,
        z,
        Math.cos(theta) * sp * spd,
        Math.cos(phi) * spd,
        Math.sin(theta) * sp * spd,
        life * (0.7 + Math.random() * 0.5),
        size,
        gravity,
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
    gravity: number,
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
        p.gravity = gravity;
        p.color.set(colorHex);
        return;
      }
    }
  }

  private spawnBlast3D(x: number, y: number, z: number, maxRadius: number, colorHex: string): void {
    for (const b of this.blasts) {
      if (b.life <= 0) {
        b.life = 0.36;
        b.maxLife = 0.36;
        b.maxRadius = maxRadius;
        b.ring.position.set(x, y + 0.08, z);
        b.ring.scale.setScalar(0.2);
        (b.ring.material as THREE.MeshBasicMaterial).color.set(colorHex);
        b.ring.visible = true;

        b.core.position.set(x, y, z);
        b.core.scale.setScalar(0.35);
        (b.core.material as THREE.MeshBasicMaterial).color.set(colorHex);
        b.core.visible = true;
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
      p.vy -= p.gravity * dt;

      const s = p.size * (p.life / p.maxLife);
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.life * 7, p.life * 5, p.life * 3);
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, p.color);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;

    // Update 3D projectile instances oriented along 3D velocity vector
    const projCount = Math.min(projectiles.length, MAX_PROJECTILES);
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      if (i < projCount) {
        const pr = projectiles[i];
        _dir.set(pr.vx, pr.vy, pr.vz);
        if (_dir.lengthSq() > 0.0001) {
          _dir.normalize();
          _quat.setFromUnitVectors(_fwd, _dir);
        } else {
          _quat.identity();
        }
        _dummy.position.set(pr.x, pr.y, pr.z);
        _dummy.quaternion.copy(_quat);
        const lenScale = pr.weaponId === 'rocket_launcher' ? 1.8 : pr.weaponId === 'sniper' ? 2.4 : 1.0;
        const thickScale = pr.weaponId === 'rocket_launcher' ? 2.2 : pr.isEnergy ? 1.55 : 1.0;
        _dummy.scale.set(thickScale, thickScale, lenScale);
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

    // Update 3D blasts
    for (const b of this.blasts) {
      if (b.life > 0) {
        b.life -= dt;
        const progress = 1 - Math.max(0, b.life) / b.maxLife;
        b.ring.scale.setScalar(0.3 + progress * b.maxRadius);
        (b.ring.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.85;
        b.core.scale.setScalar(0.35 + progress * (b.maxRadius * 0.55));
        (b.core.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.55;
        if (b.life <= 0) {
          b.ring.visible = false;
          b.core.visible = false;
        }
      }
    }
  }

  public dispose(): void {
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.projectileMesh.geometry.dispose();
    (this.projectileMesh.material as THREE.Material).dispose();
    for (const b of this.blasts) {
      b.ring.geometry.dispose();
      (b.ring.material as THREE.Material).dispose();
      b.core.geometry.dispose();
      (b.core.material as THREE.Material).dispose();
    }
  }
}
