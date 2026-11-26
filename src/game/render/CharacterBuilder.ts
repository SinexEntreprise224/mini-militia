import * as THREE from 'three';
import { CharacterAppearance, PlayerState, WeaponId } from '../types';
import { buildWeaponMesh } from './WeaponBuilder';

export interface CharacterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  backArmPivot: THREE.Group;
  aimPivot: THREE.Group;
  weaponMount: THREE.Group;
  jetpackGroup: THREE.Group;
  flameLeft: THREE.Mesh;
  flameRight: THREE.Mesh;
  shieldBubble: THREE.Mesh;
  teamRing: THREE.Mesh;
  contactShadow: THREE.Mesh;
  currentWeaponId: WeaponId | null;
  appearanceKey: string;
}

function makeMat(hex: string, roughness = 0.55, metalness = 0.18): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex),
    roughness,
    metalness,
  });
}

export function serializeAppearance(app: CharacterAppearance): string {
  return JSON.stringify(app);
}

export function buildCharacterRig(appearance: CharacterAppearance, team = 0): CharacterRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const skinMat = makeMat(appearance.skinColor, 0.7, 0.03);
  const clothMat = makeMat(appearance.clothingColor, 0.62, 0.16);
  const accentMat = makeMat(appearance.accentColor, 0.34, 0.58);
  const pantsMat = makeMat(appearance.pantsColor, 0.72, 0.1);
  const bootsMat = makeMat(appearance.bootsColor, 0.48, 0.32);
  const glovesMat = makeMat(appearance.glovesColor, 0.55, 0.22);
  const hairMat = makeMat(appearance.hairColor, 0.75, 0.05);
  const headgearMat = makeMat(appearance.headgearColor, 0.36, 0.48);
  const jetpackMat = makeMat(appearance.jetpackColor, 0.32, 0.72);
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.34,
    metalness: 0.78,
  });

  // Ground contact shadow
  const shadowGeo = new THREE.CircleGeometry(0.58, 22);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.02;
  root.add(contactShadow);

  // Team / Player ground aura ring
  const ringColor = team === 1 ? 0x38bdf8 : team === 2 ? 0xf87171 : 0xfacc15;
  const teamRing = new THREE.Mesh(
    new THREE.RingGeometry(0.47, 0.6, 26),
    new THREE.MeshBasicMaterial({
      color: ringColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    })
  );
  teamRing.rotation.x = -Math.PI / 2;
  teamRing.position.y = 0.03;
  root.add(teamRing);

  // Articulated Legs
  const buildLeg = (zOffset: number): THREE.Group => {
    const hip = new THREE.Group();
    hip.position.set(0, 0.68, zOffset);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.22, 4, 8), pantsMat);
    thigh.position.y = -0.2;
    const knee = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.12, 0.23), darkMetal);
    knee.position.set(0.02, -0.38, 0);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.2), pantsMat);
    shin.position.y = -0.5;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.16, 0.24), bootsMat);
    boot.position.set(0.04, -0.6, 0);
    hip.add(thigh, knee, shin, boot);
    return hip;
  };
  const leftLegPivot = buildLeg(-0.14);
  const rightLegPivot = buildLeg(0.14);
  bodyPivot.add(leftLegPivot, rightLegPivot);

  // Torso
  const torso = new THREE.Group();
  torso.position.set(0, 0.96, 0);
  bodyPivot.add(torso);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.56, 0.49), clothMat);
  torso.add(chest);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.1, 0.52), darkMetal);
  belt.position.y = -0.24;
  torso.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.12), accentMat);
  buckle.position.set(0.24, -0.24, 0);
  torso.add(buckle);

  if (appearance.jacketStyle === 'tactical_vest') {
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.53), accentMat);
    vest.position.y = 0.04;
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.36), darkMetal);
    pouch.position.set(0.24, -0.06, 0);
    torso.add(vest, pouch);
  } else if (appearance.jacketStyle === 'flight_jacket') {
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.12, 0.53), accentMat);
    collar.position.y = 0.26;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.08, 0.51), accentMat);
    stripe.position.y = 0.05;
    torso.add(collar, stripe);
  } else if (appearance.jacketStyle === 'heavy_plate') {
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.44, 0.57), darkMetal);
    chestPlate.position.y = 0.06;
    const coreGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12),
      new THREE.MeshStandardMaterial({
        color: appearance.accentColor,
        emissive: appearance.accentColor,
        emissiveIntensity: 1.5,
      })
    );
    coreGlow.rotation.z = Math.PI / 2;
    coreGlow.position.set(0.27, 0.08, 0);
    torso.add(chestPlate, coreGlow);
  } else {
    const strap1 = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.54, 0.1), accentMat);
    strap1.position.z = 0.14;
    const strap2 = strap1.clone();
    strap2.position.z = -0.14;
    torso.add(strap1, strap2);
  }

  // Accessories
  if (appearance.accessory === 'shoulder_pad') {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.26), darkMetal);
    pad.position.set(0, 0.26, 0.32);
    torso.add(pad);
  } else if (appearance.accessory === 'ammo_bandolier') {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.09, 0.55), accentMat);
    band.rotation.z = 0.55;
    torso.add(band);
  } else if (appearance.accessory === 'scarf') {
    const neckWrap = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 16), accentMat);
    neckWrap.rotation.x = Math.PI / 2;
    neckWrap.position.y = 0.31;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.14), accentMat);
    tail.position.set(-0.28, 0.24, 0);
    tail.rotation.z = 0.28;
    torso.add(neckWrap, tail);
  } else if (appearance.accessory === 'antenna') {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.65, 6), darkMetal);
    rod.position.set(-0.28, 0.45, -0.18);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshStandardMaterial({
        color: appearance.accentColor,
        emissive: appearance.accentColor,
        emissiveIntensity: 1.6,
      })
    );
    tip.position.set(-0.28, 0.78, -0.18);
    torso.add(rod, tip);
  }

  // Backpack & Jetpack with glowing exhaust rings
  const jetpackGroup = new THREE.Group();
  jetpackGroup.position.set(-0.34, 0.04, 0);
  torso.add(jetpackGroup);

  const packSize =
    appearance.backpackStyle === 'heavy_pack'
      ? [0.28, 0.46, 0.42]
      : appearance.backpackStyle === 'sleek_thruster'
      ? [0.2, 0.38, 0.34]
      : [0.24, 0.4, 0.36];
  const packMesh = new THREE.Mesh(
    new THREE.BoxGeometry(packSize[0], packSize[1], packSize[2]),
    jetpackMat
  );
  jetpackGroup.add(packMesh);

  const packTrim = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, packSize[1] * 0.68, packSize[2] * 0.65),
    new THREE.MeshStandardMaterial({
      color: appearance.flameColor,
      emissive: appearance.flameColor,
      emissiveIntensity: 1.1,
    })
  );
  packTrim.position.set(-packSize[0] * 0.5 - 0.01, 0, 0);
  jetpackGroup.add(packTrim);

  if (appearance.backpackStyle === 'cryo_tank') {
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.38, 10),
      makeMat('#38bdf8', 0.25, 0.5)
    );
    tank.position.set(-0.08, 0, 0);
    jetpackGroup.add(tank);
  }

  if (appearance.jetpackStyle === 'vector_wings') {
    const wingTop = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.88), accentMat);
    wingTop.position.set(-0.06, 0.14, 0);
    wingTop.rotation.y = 0.18;
    jetpackGroup.add(wingTop);
  }

  const nozzleGeo =
    appearance.jetpackStyle === 'plasma_thruster'
      ? new THREE.CylinderGeometry(0.065, 0.105, 0.22, 10)
      : new THREE.CylinderGeometry(0.055, 0.09, 0.24, 10);

  const nozzleL = new THREE.Mesh(nozzleGeo, darkMetal);
  nozzleL.position.set(-0.06, -0.22, -0.13);
  nozzleL.rotation.z = -0.18;
  const nozzleR = new THREE.Mesh(nozzleGeo, darkMetal);
  nozzleR.position.set(-0.06, -0.22, 0.13);
  nozzleR.rotation.z = -0.18;
  jetpackGroup.add(nozzleL, nozzleR);

  // Thruster flames
  const flameMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(appearance.flameColor),
    transparent: true,
    opacity: 0.92,
  });
  const flameGeo = new THREE.ConeGeometry(0.095, 0.58, 10);
  const flameLeft = new THREE.Mesh(flameGeo, flameMat);
  flameLeft.rotation.x = Math.PI;
  flameLeft.position.set(-0.11, -0.54, -0.13);
  flameLeft.visible = false;

  const flameRight = new THREE.Mesh(flameGeo, flameMat);
  flameRight.rotation.x = Math.PI;
  flameRight.position.set(-0.11, -0.54, 0.13);
  flameRight.visible = false;
  jetpackGroup.add(flameLeft, flameRight);

  // Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.52, 0);
  torso.add(headGroup);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
  headGroup.add(head);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.06), eyeMat);
  eyeL.position.set(0.21, 0.04, -0.09);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.06), eyeMat);
  eyeR.position.set(0.21, 0.04, 0.09);
  headGroup.add(eyeL, eyeR);

  if (appearance.faceStyle === 'tactical_mask') {
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.44), darkMetal);
    mask.position.set(0.01, -0.1, 0);
    headGroup.add(mask);
  } else if (appearance.faceStyle === 'cyber_eye') {
    const optic = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.09, 0.11),
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 1.7,
      })
    );
    optic.position.set(0.215, 0.04, 0.09);
    headGroup.add(optic);
  } else if (appearance.faceStyle === 'visor_scowl') {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.28), hairMat);
    brow.position.set(0.21, 0.1, 0);
    headGroup.add(brow);
  } else if (appearance.faceStyle === 'grin') {
    const grin = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.05, 0.16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    grin.position.set(0.21, -0.09, 0);
    headGroup.add(grin);
  }

  if (appearance.hairStyle === 'crew') {
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.44), hairMat);
    hairTop.position.y = 0.22;
    headGroup.add(hairTop);
  } else if (appearance.hairStyle === 'mohawk') {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.12), hairMat);
    fin.position.y = 0.28;
    headGroup.add(fin);
  } else if (appearance.hairStyle === 'swept') {
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.13, 0.44), hairMat);
    top.position.set(0.04, 0.23, 0);
    headGroup.add(top);
  } else if (appearance.hairStyle === 'long') {
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.45), hairMat);
    top.position.y = 0.22;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.36, 0.44), hairMat);
    back.position.set(-0.2, 0.02, 0);
    headGroup.add(top, back);
  }

  if (appearance.headgear === 'combat_helmet') {
    const dome = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.48), headgearMat);
    dome.position.y = 0.18;
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.06, 0.5), headgearMat);
    rim.position.set(0.02, 0.09, 0);
    headGroup.add(dome, rim);
  } else if (appearance.headgear === 'tactical_cap') {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.45), headgearMat);
    cap.position.y = 0.21;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.42), headgearMat);
    brim.position.set(0.26, 0.15, 0);
    headGroup.add(cap, brim);
  } else if (appearance.headgear === 'beret') {
    const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.12, 12), headgearMat);
    beret.position.set(-0.03, 0.24, 0.04);
    beret.rotation.z = 0.22;
    headGroup.add(beret);
  } else if (appearance.headgear === 'visor_goggles') {
    const gog = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.13, 0.44),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 1.1,
        roughness: 0.15,
        metalness: 0.6,
      })
    );
    gog.position.set(0.21, 0.05, 0);
    headGroup.add(gog);
  } else if (appearance.headgear === 'space_dome') {
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 14, 12),
      new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x581c87,
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.55,
        roughness: 0.1,
        metalness: 0.8,
      })
    );
    headGroup.add(visor);
  } else if (appearance.headgear === 'cryo_hood') {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.48, 0.5), headgearMat);
    hood.position.set(-0.03, 0.04, 0);
    headGroup.add(hood);
  } else if (appearance.headgear === 'comms_headset') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 6, 16, Math.PI), darkMetal);
    band.rotation.y = Math.PI / 2;
    band.position.y = 0.06;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 10), headgearMat);
    cup.rotation.x = Math.PI / 2;
    cup.position.set(0, 0.02, 0.24);
    headGroup.add(band, cup);
  }

  // Left support arm
  const backArmPivot = new THREE.Group();
  backArmPivot.position.set(0, 1.15, -0.28);
  const backArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), clothMat);
  backArm.position.y = -0.18;
  const backGlove = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.14, 0.17), glovesMat);
  backGlove.position.y = -0.38;
  backArmPivot.add(backArm, backGlove);
  bodyPivot.add(backArmPivot);

  // Right Aiming Arm & Weapon Mount
  const aimPivot = new THREE.Group();
  aimPivot.position.set(0, 1.12, 0.24);
  bodyPivot.add(aimPivot);

  const frontArm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.15, 0.15), clothMat);
  frontArm.position.set(0.18, 0, 0);
  const frontGlove = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.16), glovesMat);
  frontGlove.position.set(0.38, 0, 0);
  aimPivot.add(frontArm, frontGlove);

  const weaponMount = new THREE.Group();
  weaponMount.position.set(0.4, 0.02, -0.14);
  aimPivot.add(weaponMount);

  weaponMount.add(buildWeaponMesh('pistol'));

  // Spawn protection shield
  const shieldBubble = new THREE.Mesh(
    new THREE.SphereGeometry(1.08, 18, 14),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
      wireframe: true,
    })
  );
  shieldBubble.position.y = 0.9;
  shieldBubble.visible = false;
  root.add(shieldBubble);

  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const m = obj as THREE.Mesh;
      if (m !== contactShadow && m !== teamRing && m !== shieldBubble) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    }
  });

  return {
    root,
    bodyPivot,
    torso,
    headGroup,
    leftLegPivot,
    rightLegPivot,
    backArmPivot,
    aimPivot,
    weaponMount,
    jetpackGroup,
    flameLeft,
    flameRight,
    shieldBubble,
    teamRing,
    contactShadow,
    currentWeaponId: 'pistol',
    appearanceKey: serializeAppearance(appearance),
  };
}

export function animateCharacterRig(
  rig: CharacterRig,
  player: PlayerState,
  elapsed: number,
  dt: number
): void {
  rig.root.visible = player.alive;
  if (!player.alive) return;

  rig.root.position.set(player.x, player.y, player.z);

  const activeSlot = player.weapons[player.activeSlot];
  const weaponId = activeSlot ? activeSlot.weaponId : 'pistol';
  if (rig.currentWeaponId !== weaponId) {
    while (rig.weaponMount.children.length > 0) {
      rig.weaponMount.remove(rig.weaponMount.children[0]);
    }
    rig.weaponMount.add(buildWeaponMesh(weaponId));
    rig.currentWeaponId = weaponId;
  }

  // Full 360-degree yaw orientation matching aimAnglesToVector (yaw=0 faces -Z)
  const targetRotY = player.aimYaw + Math.PI * 0.5;
  let diff = targetRotY - rig.bodyPivot.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (dt > 0) {
    rig.bodyPivot.rotation.y += diff * Math.min(1, dt * 18);
  } else {
    rig.bodyPivot.rotation.y = targetRotY;
  }

  // Pitch aimPivot & weapon in 3D vertical axis
  let armExtraAngle = 0;
  if (player.meleeAnimTimer > 0) {
    const t = player.meleeAnimTimer / 0.24;
    armExtraAngle = Math.sin(t * Math.PI * 2) * 1.3;
  } else if (player.reloading) {
    armExtraAngle = -0.65 + Math.sin(elapsed * 16) * 0.18;
  }

  rig.aimPivot.rotation.z = player.aimPitch + armExtraAngle;
  rig.weaponMount.position.x = 0.4 - player.recoilOffset * 0.35;

  // Compute forward & strafe velocity components relative to player gaze
  const fwdX = -Math.sin(player.aimYaw);
  const fwdZ = -Math.cos(player.aimYaw);
  const rightX = Math.cos(player.aimYaw);
  const rightZ = -Math.sin(player.aimYaw);
  const forwardVel = player.vx * fwdX + player.vz * fwdZ;
  const strafeVel = player.vx * rightX + player.vz * rightZ;
  const horizSpeed = Math.hypot(player.vx, player.vz);
  const speedRatio = Math.min(1, horizSpeed / 11);

  if (player.grounded) {
    if (speedRatio > 0.08) {
      const stridePhase = elapsed * 13 * (0.5 + speedRatio * 0.6);
      rig.leftLegPivot.rotation.z = Math.sin(stridePhase) * 0.72 * speedRatio;
      rig.rightLegPivot.rotation.z = -Math.sin(stridePhase) * 0.72 * speedRatio;
      rig.torso.position.y = 0.96 + Math.abs(Math.cos(stridePhase)) * 0.05 * speedRatio;
      rig.torso.rotation.z = THREE.MathUtils.clamp(-forwardVel * 0.012, -0.16, 0.14);
      rig.torso.rotation.x = THREE.MathUtils.clamp(-strafeVel * 0.014, -0.18, 0.18);
      rig.backArmPivot.rotation.z = -Math.sin(stridePhase) * 0.5 * speedRatio;
    } else {
      rig.leftLegPivot.rotation.z = THREE.MathUtils.damp(rig.leftLegPivot.rotation.z, 0.06, 14, dt || 0.016);
      rig.rightLegPivot.rotation.z = THREE.MathUtils.damp(rig.rightLegPivot.rotation.z, -0.06, 14, dt || 0.016);
      rig.torso.position.y = 0.96 + Math.sin(elapsed * 3.5) * 0.02;
      rig.torso.rotation.z = THREE.MathUtils.damp(rig.torso.rotation.z, 0, 14, dt || 0.016);
      rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, 0, 14, dt || 0.016);
      rig.backArmPivot.rotation.z = THREE.MathUtils.damp(rig.backArmPivot.rotation.z, 0.12, 14, dt || 0.016);
    }
  } else {
    const pitchTilt = THREE.MathUtils.clamp(-forwardVel * 0.025, -0.35, 0.25);
    const bankTilt = THREE.MathUtils.clamp(-strafeVel * 0.025, -0.32, 0.32);
    rig.torso.rotation.z = THREE.MathUtils.damp(rig.torso.rotation.z, pitchTilt, 10, dt || 0.016);
    rig.torso.rotation.x = THREE.MathUtils.damp(rig.torso.rotation.x, bankTilt, 10, dt || 0.016);
    rig.leftLegPivot.rotation.z = THREE.MathUtils.damp(rig.leftLegPivot.rotation.z, -0.35, 10, dt || 0.016);
    rig.rightLegPivot.rotation.z = THREE.MathUtils.damp(rig.rightLegPivot.rotation.z, 0.25, 10, dt || 0.016);
    rig.backArmPivot.rotation.z = THREE.MathUtils.damp(rig.backArmPivot.rotation.z, -0.45, 10, dt || 0.016);
  }

  rig.headGroup.rotation.z = THREE.MathUtils.clamp(player.aimPitch * 0.45, -0.42, 0.42);

  rig.flameLeft.visible = player.jetpackActive;
  rig.flameRight.visible = player.jetpackActive;
  if (player.jetpackActive) {
    const flicker = 0.8 + Math.sin(elapsed * 55) * 0.25 + Math.random() * 0.15;
    rig.flameLeft.scale.set(1, flicker, 1);
    rig.flameRight.scale.set(1, flicker * 0.95, 1);
  }

  rig.shieldBubble.visible = player.spawnProtectionTimer > 0;
  if (rig.shieldBubble.visible) {
    rig.shieldBubble.rotation.y += dt * 2.5;
  }

  rig.contactShadow.visible = player.grounded;
  const flash = player.hitFlashTimer > 0;
  rig.bodyPivot.scale.setScalar(flash ? 1.04 : 1.0);
}
