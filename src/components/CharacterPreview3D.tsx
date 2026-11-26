import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCharacterRig, CharacterRig } from '../game/render/CharacterBuilder';
import { detectSoftwareWebGL } from '../game/render/ArenaRenderer';
import { buildWeaponMesh } from '../game/render/WeaponBuilder';
import { CharacterAppearance, WeaponId } from '../game/types';

interface Props {
  appearance: CharacterAppearance;
  previewWeapon: WeaponId;
  jetpackDemo: boolean;
  externalYawDelta?: number;
}

export const CharacterPreview3D: React.FC<Props> = ({
  appearance,
  previewWeapon,
  jetpackDemo,
  externalYawDelta = 0,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    appearance,
    previewWeapon,
    jetpackDemo,
    yaw: 0.48,
    pitch: 0.08,
    dragging: false,
    lastX: 0,
    lastY: 0,
  });

  stateRef.current.appearance = appearance;
  stateRef.current.previewWeapon = previewWeapon;
  stateRef.current.jetpackDemo = jetpackDemo;

  useEffect(() => {
    if (externalYawDelta !== 0) {
      stateRef.current.yaw += externalYawDelta;
    }
  }, [externalYawDelta]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = container.clientWidth || 380;
    const height = container.clientHeight || 460;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 50);
    camera.position.set(0, 1.35, 4.4);
    camera.lookAt(0, 1.0, 0);

    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.9);
    const key = new THREE.DirectionalLight(0xfffbeb, 2.2);
    key.position.set(3, 5, 4);
    const rim = new THREE.DirectionalLight(0x38bdf8, 1.1);
    rim.position.set(-4, 3, -3);
    scene.add(hemi, key, rim);

    // Hangar turntable pedestal
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.25, 0.18, 28),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.75 })
    );
    pedestal.position.y = -0.09;
    const pedRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.08, 0.025, 8, 32),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.4,
      })
    );
    pedRing.rotation.x = Math.PI / 2;
    pedRing.position.y = 0.01;
    scene.add(pedestal, pedRing);

    let currentRig: CharacterRig | null = null;
    let lastAppKey = '';
    let lastWeapon: WeaponId | null = null;

    const rebuildIfNeeded = () => {
      const s = stateRef.current;
      const keyStr = JSON.stringify(s.appearance);
      if (keyStr !== lastAppKey) {
        if (currentRig) scene.remove(currentRig.root);
        currentRig = buildCharacterRig(s.appearance, 0);
        currentRig.teamRing.visible = false;
        currentRig.contactShadow.visible = false;
        scene.add(currentRig.root);
        lastAppKey = keyStr;
        lastWeapon = null;
      }
      if (currentRig && lastWeapon !== s.previewWeapon) {
        while (currentRig.weaponMount.children.length > 0) {
          currentRig.weaponMount.remove(currentRig.weaponMount.children[0]);
        }
        currentRig.weaponMount.add(buildWeaponMesh(s.previewWeapon));
        lastWeapon = s.previewWeapon;
      }
    };

    rebuildIfNeeded();

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();
      const s = stateRef.current;

      rebuildIfNeeded();

      if (currentRig) {
        currentRig.root.rotation.y = s.yaw;
        currentRig.root.position.y = s.jetpackDemo ? 0.25 + Math.sin(elapsed * 4) * 0.08 : 0;
        currentRig.flameLeft.visible = s.jetpackDemo;
        currentRig.flameRight.visible = s.jetpackDemo;
        if (s.jetpackDemo) {
          const fl = 0.8 + Math.sin(elapsed * 45) * 0.25;
          currentRig.flameLeft.scale.set(1, fl, 1);
          currentRig.flameRight.scale.set(1, fl, 1);
          currentRig.leftLegPivot.rotation.z = -0.25;
          currentRig.rightLegPivot.rotation.z = 0.2;
        } else {
          currentRig.leftLegPivot.rotation.z = 0.05;
          currentRig.rightLegPivot.rotation.z = -0.05;
          currentRig.torso.position.y = 0.96 + Math.sin(elapsed * 2.5) * 0.015;
        }
        currentRig.aimPivot.rotation.z = 0.06 + Math.sin(elapsed * 1.8) * 0.04;
      }

      camera.position.y = THREE.MathUtils.clamp(1.35 + s.pitch, 0.7, 2.2);
      camera.lookAt(0, 1.0, 0);

      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    tick();

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 380;
      const h = container.clientHeight || 460;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    stateRef.current.dragging = true;
    stateRef.current.lastX = e.clientX;
    stateRef.current.lastY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!stateRef.current.dragging) return;
    const dx = e.clientX - stateRef.current.lastX;
    const dy = e.clientY - stateRef.current.lastY;
    stateRef.current.lastX = e.clientX;
    stateRef.current.lastY = e.clientY;
    stateRef.current.yaw += dx * 0.012;
    stateRef.current.pitch = THREE.MathUtils.clamp(
      stateRef.current.pitch + dy * 0.005,
      -0.45,
      0.7
    );
  };

  const onPointerUp = () => {
    stateRef.current.dragging = false;
  };

  return (
    <div
      ref={mountRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      title="Drag or use Xbox Right Stick to rotate 3D pilot"
    />
  );
};
