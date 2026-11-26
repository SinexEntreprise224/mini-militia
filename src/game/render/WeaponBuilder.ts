import * as THREE from 'three';
import { WEAPONS } from '../data/weapons';
import { GrenadeType, WeaponId } from '../types';

const gunMetal = new THREE.MeshStandardMaterial({
  color: 0x334155,
  roughness: 0.35,
  metalness: 0.78,
});
const darkSteel = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  roughness: 0.45,
  metalness: 0.7,
});
const polymerGrip = new THREE.MeshStandardMaterial({
  color: 0x0f172a,
  roughness: 0.8,
  metalness: 0.1,
});
const woodAccent = new THREE.MeshStandardMaterial({
  color: 0x7c2d12,
  roughness: 0.7,
  metalness: 0.05,
});

export function buildWeaponMesh(weaponId: WeaponId): THREE.Group {
  const g = new THREE.Group();
  const spec = WEAPONS[weaponId];
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.color),
    roughness: 0.32,
    metalness: 0.65,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.trailColor),
    emissive: new THREE.Color(spec.trailColor),
    emissiveIntensity: 1.5,
    roughness: 0.2,
    metalness: 0.2,
  });

  switch (weaponId) {
    case 'pistol': {
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.1), gunMetal);
      slide.position.set(0.15, 0.04, 0);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.2, 0.09), polymerGrip);
      grip.position.set(0.02, -0.07, 0);
      grip.rotation.z = 0.22;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.14, 8), darkSteel);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.38, 0.04, 0);
      g.add(slide, grip, barrel);
      break;
    }
    case 'dual_pistols': {
      for (const zOff of [-0.14, 0.14]) {
        const sub = new THREE.Group();
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.09), accentMat);
        slide.position.set(0.16, 0.03, 0);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.08), polymerGrip);
        grip.position.set(0.02, -0.07, 0);
        grip.rotation.z = 0.2;
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.08), glowMat);
        tip.position.set(0.35, 0.03, 0);
        sub.add(slide, grip, tip);
        sub.position.z = zOff;
        g.add(sub);
      }
      break;
    }
    case 'smg': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.14, 0.12), accentMat);
      body.position.set(0.16, 0.03, 0);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.24, 8), darkSteel);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.48, 0.04, 0);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.07), polymerGrip);
      mag.position.set(0.24, -0.13, 0);
      mag.rotation.z = -0.18;
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.09), polymerGrip);
      grip.position.set(0.02, -0.08, 0);
      grip.rotation.z = 0.2;
      g.add(body, barrel, mag, grip);
      break;
    }
    case 'assault_rifle': {
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.12), accentMat);
      receiver.position.set(0.18, 0.03, 0);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.1), polymerGrip);
      stock.position.set(-0.2, 0.01, 0);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.36, 10), darkSteel);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.62, 0.04, 0);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.08), darkSteel);
      mag.position.set(0.26, -0.12, 0);
      mag.rotation.z = -0.2;
      const optic = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.08), glowMat);
      optic.position.set(0.16, 0.12, 0);
      g.add(receiver, stock, barrel, mag, optic);
      break;
    }
    case 'heavy_rifle': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.16, 0.13), accentMat);
      body.position.set(0.2, 0.03, 0);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.11), woodAccent);
      stock.position.set(-0.24, 0.0, 0);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.44, 10), darkSteel);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.72, 0.05, 0);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.2, 0.09), darkSteel);
      mag.position.set(0.3, -0.11, 0);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 10), gunMetal);
      scope.rotation.z = Math.PI / 2;
      scope.position.set(0.18, 0.14, 0);
      g.add(body, stock, barrel, mag, scope);
      break;
    }
    case 'shotgun': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.15, 0.14), accentMat);
      body.position.set(0.15, 0.03, 0);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.46, 10), darkSteel);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.58, 0.06, 0);
      const underTube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), gunMetal);
      underTube.rotation.z = Math.PI / 2;
      underTube.position.set(0.55, -0.02, 0);
      const pump = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.15), woodAccent);
      pump.position.set(0.45, -0.03, 0);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.13, 0.11), woodAccent);
      stock.position.set(-0.2, -0.02, 0);
      stock.rotation.z = 0.15;
      g.add(body, barrel, underTube, pump, stock);
      break;
    }
    case 'sniper': {
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.14, 0.13), accentMat);
      chassis.position.set(0.22, 0.03, 0);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.72, 10), gunMetal);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.92, 0.05, 0);
      const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.1), darkSteel);
      muzzleBrake.position.set(1.26, 0.05, 0);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.048, 0.42, 12), darkSteel);
      scope.rotation.z = Math.PI / 2;
      scope.position.set(0.22, 0.16, 0);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.04, 12), glowMat);
      lens.rotation.z = Math.PI / 2;
      lens.position.set(0.43, 0.16, 0);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.11), polymerGrip);
      stock.position.set(-0.26, 0.0, 0);
      g.add(chassis, barrel, muzzleBrake, scope, lens, stock);
      break;
    }
    case 'rocket_launcher': {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.15, 14), accentMat);
      tube.rotation.z = Math.PI / 2;
      tube.position.set(0.22, 0.08, 0);
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.2, 14), darkSteel);
      bell.rotation.z = Math.PI / 2;
      bell.position.set(0.8, 0.08, 0);
      const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.24, 12), glowMat);
      warhead.rotation.z = -Math.PI / 2;
      warhead.position.set(0.94, 0.08, 0);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.2, 0.09), polymerGrip);
      grip.position.set(0.15, -0.08, 0);
      const sight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.08), gunMetal);
      sight.position.set(0.35, 0.21, 0);
      g.add(tube, bell, warhead, grip, sight);
      break;
    }
    case 'plasma_rifle': {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.15), accentMat);
      hull.position.set(0.2, 0.03, 0);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.42, 10), glowMat);
      core.rotation.z = Math.PI / 2;
      core.position.set(0.38, 0.05, 0);
      const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 0.11), darkSteel);
      railTop.position.set(0.56, 0.1, 0);
      const railBot = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 0.11), darkSteel);
      railBot.position.set(0.56, -0.02, 0);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.12), polymerGrip);
      stock.position.set(-0.2, 0.02, 0);
      g.add(hull, core, railTop, railBot, stock);
      break;
    }
    case 'energy_blade': {
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.26, 10), darkSteel);
      hilt.rotation.z = Math.PI / 2;
      hilt.position.set(0.06, 0.02, 0);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.12), gunMetal);
      guard.position.set(0.2, 0.02, 0);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.075, 0.03), glowMat);
      blade.position.set(0.66, 0.03, 0);
      const edge = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 4), glowMat);
      edge.rotation.z = -Math.PI / 2;
      edge.position.set(1.18, 0.03, 0);
      g.add(hilt, guard, blade, edge);
      break;
    }
  }

  g.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
    }
  });
  return g;
}

export function buildGrenadeMesh(type: GrenadeType): THREE.Group {
  const g = new THREE.Group();
  const color = type === 'frag' ? 0xf97316 : type === 'incendiary' ? 0xef4444 : 0x22d3ee;
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.7,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.4,
    roughness: 0.3,
  });

  if (type === 'proximity') {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 12), bodyMat);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), glowMat);
    beacon.position.y = 0.08;
    g.add(disc, beacon);
  } else {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), bodyMat);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.07, 12), glowMat);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.09, 8), bodyMat);
    cap.position.y = 0.18;
    g.add(shell, band, cap);
  }
  return g;
}

export function buildPickupPedestalMesh(
  kind: 'weapon' | 'health' | 'ammo',
  weaponId?: WeaponId
): THREE.Group {
  const root = new THREE.Group();

  // Base pad
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.75,
  });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.68, 0.14, 16), padMat);
  pad.position.y = 0.07;
  root.add(pad);

  const ringColor =
    kind === 'health'
      ? 0x22c55e
      : kind === 'ammo'
      ? 0xfacc15
      : new THREE.Color(WEAPONS[weaponId || 'assault_rifle'].trailColor).getHex();

  const ringMat = new THREE.MeshStandardMaterial({
    color: ringColor,
    emissive: ringColor,
    emissiveIntensity: 1.3,
    roughness: 0.2,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.04, 8, 24), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.15;
  root.add(ring);

  const floatGroup = new THREE.Group();
  floatGroup.name = 'floatingItem';
  floatGroup.position.y = 0.72;

  if (kind === 'health') {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.42, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.1 })
    );
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.38), ringMat);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.38), ringMat);
    floatGroup.add(box, crossH, crossV);
  } else if (kind === 'ammo') {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.38, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.6, metalness: 0.35 })
    );
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.09, 0.4), ringMat);
    floatGroup.add(crate, stripe);
  } else if (weaponId) {
    const wMesh = buildWeaponMesh(weaponId);
    wMesh.scale.setScalar(1.05);
    wMesh.position.x = -0.2;
    floatGroup.add(wMesh);
  }

  root.add(floatGroup);
  return root;
}
