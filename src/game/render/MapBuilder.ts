import * as THREE from 'three';
import { MapData, MapId } from '../types';

function createProceduralSurfaceTexture(
  baseHex: string,
  accentHex: string,
  pattern: 'metal' | 'rock' | 'ice' | 'energy' | 'sandstone' | 'grate',
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  if (pattern === 'metal' || pattern === 'grate') {
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 4;
    for (let i = 0; i <= 256; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
    ctx.fillStyle = accentHex;
    ctx.globalAlpha = 0.25;
    for (let x = 16; x < 256; x += 64) {
      for (let y = 16; y < 256; y += 64) {
        ctx.fillRect(x, y, 8, 8);
      }
    }
    ctx.globalAlpha = 1;
    if (pattern === 'grate') {
      ctx.fillStyle = 'rgba(15,23,42,0.45)';
      for (let x = 8; x < 256; x += 32) {
        ctx.fillRect(x, 0, 10, 256);
      }
    }
  } else if (pattern === 'rock' || pattern === 'sandstone') {
    for (let i = 0; i < 180; i++) {
      const rx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const ry = (Math.sin(i * 78.233) * 23421.631) % 1;
      const x = Math.abs(rx) * 256;
      const y = Math.abs(ry) * 256;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, y, 22, 8);
    }
    if (pattern === 'sandstone') {
      ctx.fillStyle = accentHex;
      ctx.globalAlpha = 0.14;
      for (let y = 12; y < 256; y += 36) {
        ctx.fillRect(0, y, 256, 7);
      }
      ctx.globalAlpha = 1;
    }
  } else if (pattern === 'ice') {
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.moveTo((i * 47) % 256, 0);
      ctx.lineTo(((i * 91) + 80) % 256, 256);
      ctx.stroke();
    }
  } else if (pattern === 'energy') {
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function buildMapSceneGeometry(
  map: MapData,
  maxAnisotropy: number
): { group: THREE.Group; animatedProps: THREE.Object3D[] } {
  const group = new THREE.Group();
  const animatedProps: THREE.Object3D[] = [];

  // Create shared procedural textures per style
  const metalTex = createProceduralSurfaceTexture(
    map.theme.platformColor,
    map.theme.platformAccent,
    'metal',
    maxAnisotropy
  );
  const rockTex = createProceduralSurfaceTexture(
    map.theme.platformColor,
    map.theme.platformAccent,
    map.id === 'red_canyon' ? 'sandstone' : 'rock',
    maxAnisotropy
  );
  const iceTex = createProceduralSurfaceTexture(
    map.theme.platformColor,
    map.theme.platformAccent,
    'ice',
    maxAnisotropy
  );
  const grateTex = createProceduralSurfaceTexture(
    map.theme.wallColor,
    map.theme.platformAccent,
    'grate',
    maxAnisotropy
  );

  const trimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(map.theme.platformAccent),
    emissive: new THREE.Color(map.theme.platformAccent),
    emissiveIntensity: 0.55,
    roughness: 0.35,
    metalness: 0.6,
  });

  // Build playable platforms & cover
  for (const p of map.platforms) {
    const depth = p.zDepth ?? (p.oneWay ? 2.6 : 3.4);
    const tex =
      p.style === 'rock' || p.style === 'sandstone'
        ? rockTex.clone()
        : p.style === 'ice'
        ? iceTex.clone()
        : p.style === 'grate'
        ? grateTex.clone()
        : metalTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(p.w / 4)), Math.max(1, Math.round(p.h / 2)));

    const isEnergy = p.style === 'energy';
    const mat = new THREE.MeshStandardMaterial({
      map: isEnergy ? null : tex,
      color: isEnergy ? new THREE.Color(map.theme.platformAccent) : 0xffffff,
      emissive: isEnergy ? new THREE.Color(map.theme.hazardGlow) : 0x000000,
      emissiveIntensity: isEnergy ? 0.65 : 0,
      transparent: isEnergy,
      opacity: isEnergy ? 0.78 : 1,
      roughness: p.style === 'ice' ? 0.25 : p.style === 'rock' ? 0.85 : 0.45,
      metalness: p.style === 'metal' || p.style === 'bridge' ? 0.62 : 0.12,
    });

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, depth), mat);
    mesh.position.set(p.x, p.y, 0);
    mesh.receiveShadow = true;
    mesh.castShadow = !p.oneWay;
    group.add(mesh);

    // Edge highlight strip for crisp platform silhouette readability in side-view
    if (!p.cover && p.w > 3 && p.h < 4) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(p.w + 0.04, 0.1, depth + 0.08),
        trimMat
      );
      strip.position.set(p.x, p.y + p.h * 0.5 - 0.04, 0);
      group.add(strip);
    }
  }

  // Build Map-specific 3D background vistas (placed at z = -6 to -34 for depth parallax)
  addMapEnvironmentVista(group, animatedProps, map.id, map);

  return { group, animatedProps };
}

function addMapEnvironmentVista(
  group: THREE.Group,
  animatedProps: THREE.Object3D[],
  mapId: MapId,
  map: MapData
): void {
  const bgDark = new THREE.MeshStandardMaterial({
    color: new THREE.Color(map.theme.wallColor),
    roughness: 0.7,
    metalness: 0.4,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(map.theme.hazardGlow),
    emissive: new THREE.Color(map.theme.hazardGlow),
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });

  if (mapId === 'ironworks') {
    // Giant background smelter vats, pipes & glowing molten core
    for (let x = -28; x <= 28; x += 14) {
      const vat = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 14, 14), bgDark);
      vat.position.set(x, 7, -11);
      group.add(vat);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.75, 0.22, 8, 20), glowMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 5.5, -11);
      group.add(ring);
    }
    // Molten trough below background
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(110, 18), glowMat);
    lava.rotation.x = -Math.PI / 2;
    lava.position.set(0, -1.8, -10);
    group.add(lava);
    // Overhead industrial truss
    const beam = new THREE.Mesh(new THREE.BoxGeometry(82, 1.4, 2.2), bgDark);
    beam.position.set(0, 24.5, -6);
    group.add(beam);
  } else if (mapId === 'hollow_rift') {
    // Back cavern rock wall & glowing crystal clusters
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(110, 50),
      new THREE.MeshStandardMaterial({ color: 0x0f252c, roughness: 0.95 })
    );
    backWall.position.set(0, 14, -14);
    group.add(backWall);

    for (let i = -28; i <= 28; i += 7) {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.1 + (Math.abs(i) % 3) * 0.4, 0), glowMat);
      crystal.position.set(i, 2 + (Math.abs(i * 3) % 14), -8 - (Math.abs(i) % 4));
      crystal.rotation.z = (i % 3) * 0.35;
      group.add(crystal);
      animatedProps.push(crystal);
    }
  } else if (mapId === 'skybridge') {
    // Distant stratosphere spires & drifting cloud banks
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.95,
      transparent: true,
      opacity: 0.78,
    });
    for (let x = -45; x <= 45; x += 15) {
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(5.5, 12, 10), cloudMat);
      cloud.scale.set(2.2, 0.55, 1.2);
      cloud.position.set(x, -9 + (Math.abs(x) % 5), -14 - (Math.abs(x) % 8));
      group.add(cloud);
      animatedProps.push(cloud);
    }
    // Distant sky towers
    for (const tx of [-28, 0, 28]) {
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 3.2, 34, 8), bgDark);
      spire.position.set(tx, 6, -22);
      group.add(spire);
    }
  } else if (mapId === 'frostline') {
    // Distant snow mountains & glowing cryo pylons
    const peakMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 });
    for (let x = -48; x <= 48; x += 16) {
      const peak = new THREE.Mesh(new THREE.ConeGeometry(12, 26, 5), peakMat);
      peak.position.set(x, 11, -24);
      group.add(peak);
    }
    for (const cx of [-18, 18]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 18, 10), bgDark);
      tower.position.set(cx, 9, -9);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 10), glowMat);
      beacon.position.set(cx, 18.5, -9);
      group.add(tower, beacon);
    }
  } else if (mapId === 'red_canyon') {
    // Layered desert mesas & blazing sun disc
    const mesaMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.9 });
    for (let x = -42; x <= 42; x += 18) {
      const mesa = new THREE.Mesh(new THREE.CylinderGeometry(5, 8, 22, 7), mesaMat);
      mesa.position.set(x, 9, -22);
      group.add(mesa);
    }
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(7.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    sun.position.set(14, 24, -40);
    group.add(sun);
  } else if (mapId === 'orbital_station') {
    // Starfield, distant ringed planet & rotating reactor ring
    const starPositions = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 140;
      starPositions[i * 3 + 1] = Math.random() * 55 - 10;
      starPositions[i * 3 + 2] = -25 - Math.random() * 30;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xe0e7ff, size: 0.35 })
    );
    group.add(stars);

    const reactorRing = new THREE.Mesh(
      new THREE.TorusGeometry(9.5, 0.45, 10, 36),
      glowMat
    );
    reactorRing.position.set(0, 12, -11);
    group.add(reactorRing);
    animatedProps.push(reactorRing);

    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(12, 24, 20),
      new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.65 })
    );
    planet.position.set(-24, 20, -45);
    group.add(planet);
  }
}

export function buildFlagMesh(team: 1 | 2): THREE.Group {
  const g = new THREE.Group();
  const color = team === 1 ? 0x38bdf8 : 0xf87171;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.06, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.2 })
  );
  pole.position.y = 1.2;

  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.55, 0.06),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.8,
      roughness: 0.4,
    })
  );
  banner.position.set(0.48, 2.05, 0);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.55, 0.14, 12),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 })
  );
  base.position.y = 0.07;
  g.add(pole, banner, base);
  return g;
}
