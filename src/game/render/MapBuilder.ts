import * as THREE from 'three';
import { MapData, MapId } from '../types';

function createSkyDome(skyTopHex: string, skyBottomHex: string, glowHex: string): THREE.Mesh {
  const geo = new THREE.SphereGeometry(145, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTopColor: { value: new THREE.Color(skyTopHex) },
      uBottomColor: { value: new THREE.Color(skyBottomHex) },
      uGlowColor: { value: new THREE.Color(glowHex) },
      uSunDir: { value: new THREE.Vector3(0.45, 0.35, -0.82).normalize() },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform vec3 uGlowColor;
      uniform vec3 uSunDir;
      varying vec3 vWorldDir;
      void main() {
        float h = clamp(vWorldDir.y * 0.5 + 0.5, 0.0, 1.0);
        float horizonBlend = smoothstep(0.32, 0.78, h);
        vec3 col = mix(uBottomColor, uTopColor, horizonBlend);
        float horizonGlow = pow(1.0 - abs(vWorldDir.y), 4.0) * 0.35;
        col += uGlowColor * horizonGlow;
        float sunAmt = max(dot(normalize(vWorldDir), uSunDir), 0.0);
        col += uGlowColor * pow(sunAmt, 24.0) * 0.55;
        col += vec3(1.0, 0.96, 0.85) * pow(sunAmt, 160.0) * 0.8;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

function createProceduralSurfaceTexture(
  baseHex: string,
  accentHex: string,
  pattern: 'metal' | 'rock' | 'ice' | 'energy' | 'sandstone' | 'grate',
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  if (pattern === 'metal' || pattern === 'grate') {
    // Sub-plate shading variation
    for (let gx = 0; gx < size; gx += 128) {
      for (let gy = 0; gy < size; gy += 128) {
        if (((gx + gy) / 128) % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.035)';
          ctx.fillRect(gx, gy, 128, 128);
        } else {
          ctx.fillStyle = 'rgba(0,0,0,0.06)';
          ctx.fillRect(gx, gy, 128, 128);
        }
      }
    }
    // Panel seams & highlights
    ctx.strokeStyle = 'rgba(0,0,0,0.38)';
    ctx.lineWidth = 4;
    for (let i = 0; i <= size; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 2;
    for (let i = 4; i <= size; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
    }
    // Corner bolts
    ctx.fillStyle = accentHex;
    ctx.globalAlpha = 0.28;
    for (let x = 16; x < size; x += 128) {
      for (let y = 16; y < size; y += 128) {
        ctx.fillRect(x, y, 10, 10);
        ctx.fillRect(x + 86, y, 10, 10);
        ctx.fillRect(x, y + 86, 10, 10);
        ctx.fillRect(x + 86, y + 86, 10, 10);
      }
    }
    ctx.globalAlpha = 1;
    if (pattern === 'grate') {
      ctx.fillStyle = 'rgba(10,16,30,0.42)';
      for (let x = 12; x < size; x += 32) {
        ctx.fillRect(x, 0, 12, size);
      }
      ctx.fillStyle = accentHex;
      ctx.globalAlpha = 0.16;
      ctx.fillRect(0, 0, size, 16);
      ctx.fillRect(0, size - 16, size, 16);
      ctx.globalAlpha = 1;
    }
  } else if (pattern === 'rock' || pattern === 'sandstone') {
    for (let i = 0; i < 320; i++) {
      const rx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const ry = (Math.sin(i * 78.233) * 23421.631) % 1;
      const x = Math.abs(rx) * size;
      const y = Math.abs(ry) * size;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.07)';
      ctx.fillRect(x, y, 36 + (i % 24), 10 + (i % 8));
    }
    if (pattern === 'sandstone') {
      ctx.fillStyle = accentHex;
      ctx.globalAlpha = 0.15;
      for (let y = 18; y < size; y += 44) {
        ctx.fillRect(0, y, size, 11);
      }
      ctx.globalAlpha = 1;
    }
  } else if (pattern === 'ice') {
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, 'rgba(255,255,255,0.14)');
    grad.addColorStop(1, 'rgba(56,189,248,0.08)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.52)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 24; i++) {
      ctx.beginPath();
      ctx.moveTo((i * 73) % size, 0);
      ctx.lineTo(((i * 131) + 120) % size, size);
      ctx.stroke();
    }
  } else if (pattern === 'energy') {
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < size; i += 48) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
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

  // Atmospheric gradient sky dome
  const skyDome = createSkyDome(map.theme.skyTop, map.theme.skyBottom, map.theme.hazardGlow);
  group.add(skyDome);

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
  const energyTex = createProceduralSurfaceTexture(
    map.theme.platformColor,
    map.theme.platformAccent,
    'energy',
    maxAnisotropy
  );

  const trimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(map.theme.platformAccent),
    emissive: new THREE.Color(map.theme.platformAccent),
    emissiveIntensity: 0.72,
    roughness: 0.28,
    metalness: 0.65,
  });

  const boundaryRimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(map.theme.hazardGlow),
    emissive: new THREE.Color(map.theme.hazardGlow),
    emissiveIntensity: 0.9,
    roughness: 0.25,
    metalness: 0.5,
  });

  // Build exact-match 3D solid platforms, floors, cover pillars & perimeter walls
  for (const p of map.platforms) {
    const tex =
      p.style === 'rock' || p.style === 'sandstone'
        ? rockTex.clone()
        : p.style === 'ice'
        ? iceTex.clone()
        : p.style === 'grate' || p.boundary
        ? grateTex.clone()
        : p.style === 'energy'
        ? energyTex.clone()
        : metalTex.clone();
    tex.needsUpdate = true;
    const repU = Math.max(1, Math.round(Math.max(p.w, p.d) / 4));
    const repV = Math.max(1, Math.round(Math.max(p.h, p.d) / 4));
    tex.repeat.set(repU, repV);

    const isEnergy = p.style === 'energy';
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      color: isEnergy ? new THREE.Color(map.theme.platformAccent) : 0xffffff,
      emissive: isEnergy ? new THREE.Color(map.theme.hazardGlow) : 0x000000,
      emissiveIntensity: isEnergy ? 0.55 : 0,
      transparent: isEnergy,
      opacity: isEnergy ? 0.84 : 1,
      roughness: p.style === 'ice' ? 0.22 : p.style === 'rock' || p.style === 'sandstone' ? 0.85 : 0.42,
      metalness: p.style === 'metal' || p.style === 'bridge' || p.boundary ? 0.62 : 0.14,
    });

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), mat);
    mesh.position.set(p.x, p.y, p.z);
    mesh.receiveShadow = true;
    mesh.castShadow = !p.boundary || p.h < 10;
    group.add(mesh);

    // Visual trim & lighting accents matching exact footprint
    if (p.boundary) {
      // Glowing perimeter strip along inner wall face for clear arena limit readability
      const barW = p.w > p.d ? p.w - 0.5 : 0.18;
      const barD = p.d > p.w ? p.d - 0.5 : 0.18;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(barW, 0.22, barD), boundaryRimMat);
      bar.position.set(p.x, 3.8, p.z);
      group.add(bar);
    } else if (p.y > map.floorY + 0.5 && !p.cover) {
      // Elevated platform top rim beacon frame
      const rimH = 0.12;
      const rim = new THREE.Mesh(
        new THREE.BoxGeometry(p.w + 0.08, rimH, p.d + 0.08),
        trimMat
      );
      rim.position.set(p.x, p.y + p.h * 0.5 - rimH * 0.5, p.z);
      group.add(rim);
    } else if (p.cover) {
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(p.w + 0.1, 0.14, p.d + 0.1),
        trimMat
      );
      cap.position.set(p.x, p.y + p.h * 0.5 - 0.05, p.z);
      group.add(cap);
    }
  }

  // 360-degree surrounding background vistas outside arena perimeter
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
    roughness: 0.68,
    metalness: 0.42,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(map.theme.hazardGlow),
    emissive: new THREE.Color(map.theme.hazardGlow),
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });

  if (mapId === 'ironworks') {
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const rx = Math.cos(ang) * 44;
      const rz = Math.sin(ang) * 34;
      const vat = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 26, 14), bgDark);
      vat.position.set(rx, 11, rz);
      group.add(vat);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.24, 8, 22), glowMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(rx, 14, rz);
      group.add(ring);
    }
  } else if (mapId === 'hollow_rift') {
    for (let a = 0; a < 14; a++) {
      const ang = (a / 14) * Math.PI * 2;
      const dist = 36 + (a % 3) * 5;
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(2.2 + (a % 3) * 0.8, 0), glowMat);
      crystal.position.set(Math.cos(ang) * dist, 8 + (a % 4) * 4, Math.sin(ang) * dist);
      crystal.rotation.z = (a % 3) * 0.35;
      group.add(crystal);
      animatedProps.push(crystal);
    }
  } else if (mapId === 'skybridge') {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.95,
      transparent: true,
      opacity: 0.78,
    });
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(6.5, 12, 10), cloudMat);
      cloud.scale.set(2.2, 0.55, 1.4);
      cloud.position.set(Math.cos(ang) * 46, -6 + (a % 3) * 4, Math.sin(ang) * 42);
      group.add(cloud);
      animatedProps.push(cloud);
    }
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2 + 0.3;
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 3.6, 44, 8), bgDark);
      spire.position.set(Math.cos(ang) * 48, 8, Math.sin(ang) * 40);
      group.add(spire);
    }
  } else if (mapId === 'frostline') {
    const peakMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 });
    for (let a = 0; a < 10; a++) {
      const ang = (a / 10) * Math.PI * 2;
      const peak = new THREE.Mesh(new THREE.ConeGeometry(13, 34, 5), peakMat);
      peak.position.set(Math.cos(ang) * 52, 14, Math.sin(ang) * 46);
      group.add(peak);
    }
  } else if (mapId === 'red_canyon') {
    const mesaMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.9 });
    for (let a = 0; a < 10; a++) {
      const ang = (a / 10) * Math.PI * 2;
      const mesa = new THREE.Mesh(new THREE.CylinderGeometry(6, 9.5, 28, 7), mesaMat);
      mesa.position.set(Math.cos(ang) * 50, 12, Math.sin(ang) * 44);
      group.add(mesa);
    }
  } else if (mapId === 'orbital_station') {
    const starPositions = new Float32Array(420 * 3);
    for (let i = 0; i < 420; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 75 + Math.random() * 40;
      starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      starPositions[i * 3 + 1] = Math.cos(phi) * r * 0.7 + 12;
      starPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xe0e7ff, size: 0.45 })
    );
    group.add(stars);

    const reactorRing = new THREE.Mesh(new THREE.TorusGeometry(28, 0.7, 10, 48), glowMat);
    reactorRing.rotation.x = Math.PI / 2.4;
    reactorRing.position.set(0, 22, 0);
    group.add(reactorRing);
    animatedProps.push(reactorRing);

    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(14, 24, 20),
      new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.6 })
    );
    planet.position.set(-42, 30, -56);
    group.add(planet);
  }
}

export function buildFlagMesh(team: 1 | 2): THREE.Group {
  const g = new THREE.Group();
  const color = team === 1 ? 0x38bdf8 : 0xf87171;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.06, 2.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.82, roughness: 0.2 })
  );
  pole.position.y = 1.25;

  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.55, 0.06),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.85,
      roughness: 0.35,
    })
  );
  banner.position.set(0.48, 2.1, 0);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.55, 0.14, 14),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55 })
  );
  base.position.y = 0.07;
  g.add(pole, banner, base);
  return g;
}
