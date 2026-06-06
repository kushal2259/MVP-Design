'use client';
import { useEffect, useRef, useState } from 'react';
import type { FloorPlan } from '@/types';

interface Props {
  floorPlans: FloorPlan[];
}

const ROOM_COLORS_3D: Record<string, number> = {
  living: 0xc8d8f5,
  dining: 0xc0e8f8,
  kitchen: 0xf8f0a0,
  bedroom: 0xe8d8ff,
  bathroom: 0xb8f0d0,
  balcony: 0xa8f0c0,
  study: 0xf8d0e8,
  garage: 0xe0e8f0,
  utility: 0xd0f8e0,
  pooja: 0xfff0c8,
  terrace: 0xd0f8e8,
  staircase: 0xf0f4f8,
  corridor: 0xf0f4f8,
  store: 0xf0f0f0,
};

export default function ThreeDViewer({ floorPlans }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [viewMode, setViewMode] = useState<'exterior' | 'aerial' | 'walkthrough'>('aerial');
  const autoRotateRef = useRef(autoRotate);
  const cameraRef = useRef<unknown>(null);
  const controlsRef = useRef<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;
    let frameId: number;
    let destroyed = false;

    (async () => {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js' as string);
      if (destroyed) return;

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xeef2f7);
      scene.fog = new THREE.Fog(0xeef2f7, 80, 160);

      // Camera
      const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 500);
      cameraRef.current = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      mount.appendChild(renderer.domElement);

      // Controls
      const controls = new (OrbitControls as new (camera: unknown, dom: HTMLElement) => {
        enableDamping: boolean;
        dampingFactor: number;
        minDistance: number;
        maxDistance: number;
        maxPolarAngle: number;
        autoRotate: boolean;
        autoRotateSpeed: number;
        target: { set: (x: number, y: number, z: number) => void };
        update: () => void;
      })(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.minDistance = 5;
      controls.maxDistance = 120;
      controls.maxPolarAngle = Math.PI / 2;
      controlsRef.current = controls;

      // Lights
      const ambient = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambient);

      const sun = new THREE.DirectionalLight(0xfffbf0, 1.2);
      sun.position.set(40, 60, 30);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 200;
      sun.shadow.camera.left = -60;
      sun.shadow.camera.right = 60;
      sun.shadow.camera.top = 60;
      sun.shadow.camera.bottom = -60;
      scene.add(sun);

      const fill = new THREE.DirectionalLight(0xd0e8ff, 0.4);
      fill.position.set(-30, 20, -20);
      scene.add(fill);

      // Calculate building bounds
      let maxBX = 0, maxBZ = 0;
      for (const plan of floorPlans) {
        for (const room of plan.rooms) {
          maxBX = Math.max(maxBX, (room.x + room.width) * 1.524);
          maxBZ = Math.max(maxBZ, (room.y + room.height) * 1.524);
        }
      }
      const centerX = maxBX / 2;
      const centerZ = maxBZ / 2;
      const FLOOR_H = 3.2;
      const UNIT = 1.524;
      const WALL_T = 0.18;

      // Ground
      const groundGeo = new THREE.PlaneGeometry(200, 200, 20, 20);
      const groundMat = new THREE.MeshStandardMaterial({
        color: 0xc8b89a,
        roughness: 0.9,
        metalness: 0,
      });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      // Grass patches
      const grassGeo = new THREE.PlaneGeometry(maxBX + 20, maxBZ + 20);
      const grassMat = new THREE.MeshStandardMaterial({ color: 0x88bb66, roughness: 0.95 });
      const grass = new THREE.Mesh(grassGeo, grassMat);
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(0, 0.01, 0);
      grass.receiveShadow = true;
      scene.add(grass);

      // Build floors
      for (const plan of floorPlans) {
        const floorY = plan.floor * FLOOR_H;

        // Floor slab
        const slabGeo = new THREE.BoxGeometry(maxBX + WALL_T * 2, 0.15, maxBZ + WALL_T * 2);
        const slabMat = new THREE.MeshStandardMaterial({ color: 0xf0ebe0, roughness: 0.8 });
        const slab = new THREE.Mesh(slabGeo, slabMat);
        slab.position.set(0, floorY - 0.075, 0);
        slab.receiveShadow = true;
        scene.add(slab);

        for (const room of plan.rooms) {
          const rx = room.x * UNIT - centerX;
          const rz = room.y * UNIT - centerZ;
          const rw = room.width * UNIT;
          const rd = room.height * UNIT;
          const roomColor = ROOM_COLORS_3D[room.type] || 0xf0f0f0;

          // Room volume (colored, translucent)
          if (room.type !== 'balcony' && room.type !== 'terrace') {
            const volGeo = new THREE.BoxGeometry(rw - WALL_T, FLOOR_H, rd - WALL_T);
            const volMat = new THREE.MeshStandardMaterial({
              color: roomColor, roughness: 0.7, metalness: 0,
              transparent: true, opacity: 0.15,
            });
            const vol = new THREE.Mesh(volGeo, volMat);
            vol.position.set(rx + rw / 2, floorY + FLOOR_H / 2, rz + rd / 2);
            scene.add(vol);
          }

          // Walls — exterior only (simplified: 4 walls per room)
          const wallMat = new THREE.MeshStandardMaterial({ color: 0xf8f2e8, roughness: 0.85 });
          const wallDark = new THREE.MeshStandardMaterial({ color: 0xddd8cc, roughness: 0.85 });

          const addWall = (wx: number, wy: number, wz: number, ww: number, wh: number, wd: number) => {
            const geo = new THREE.BoxGeometry(ww, wh, wd);
            const mesh = new THREE.Mesh(geo, wallMat);
            mesh.position.set(wx, wy, wz);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
          };

          const wh = FLOOR_H;
          const wy = floorY + wh / 2;

          // North wall
          addWall(rx + rw / 2, wy, rz, rw, wh, WALL_T);
          // South wall
          addWall(rx + rw / 2, wy, rz + rd, rw, wh, WALL_T);
          // West wall
          addWall(rx, wy, rz + rd / 2, WALL_T, wh, rd);
          // East wall
          addWall(rx + rw, wy, rz + rd / 2, WALL_T, wh, rd);

          // Window openings (lighter patches)
          if (room.windows > 0 && room.type !== 'staircase' && room.type !== 'corridor') {
            const winMat = new THREE.MeshStandardMaterial({ color: 0xc8e0f8, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.1 });
            const winGeo = new THREE.BoxGeometry(rw * 0.4, wh * 0.35, WALL_T + 0.05);
            const win = new THREE.Mesh(winGeo, winMat);
            win.position.set(rx + rw / 2, floorY + wh * 0.6, rz);
            scene.add(win);
          }

          // Balcony slab (thinner)
          if (room.type === 'balcony') {
            const balGeo = new THREE.BoxGeometry(rw, 0.1, rd);
            const balMat = new THREE.MeshStandardMaterial({ color: 0xd0c8b0, roughness: 0.9 });
            const bal = new THREE.Mesh(balGeo, balMat);
            bal.position.set(rx + rw / 2, floorY, rz + rd / 2);
            bal.castShadow = true;
            scene.add(bal);

            // Railing
            const railMat = new THREE.MeshStandardMaterial({ color: 0x888078, roughness: 0.5 });
            const railGeo = new THREE.BoxGeometry(rw, 0.9, 0.05);
            const rail = new THREE.Mesh(railGeo, railMat);
            rail.position.set(rx + rw / 2, floorY + 0.45, rz);
            scene.add(rail);
          }

          // Roof label (dummy - handled by ceiling slab)
          void wallDark;
        }

        // Ceiling slab
        const ceilGeo = new THREE.BoxGeometry(maxBX + WALL_T * 2, 0.2, maxBZ + WALL_T * 2);
        const ceilMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d4, roughness: 0.9 });
        const ceil = new THREE.Mesh(ceilGeo, ceilMat);
        ceil.position.set(0, floorY + FLOOR_H, 0);
        ceil.castShadow = true;
        ceil.receiveShadow = true;
        scene.add(ceil);
      }

      // Roof
      const totalH = floorPlans.length * FLOOR_H;
      const roofH = Math.max(1.5, maxBX * 0.15);
      const roofGeo = new THREE.ConeGeometry(
        Math.sqrt(maxBX * maxBX + maxBZ * maxBZ) / 2 + 0.5,
        roofH, 4, 1
      );
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x885533, roughness: 0.85 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.set(0, totalH + roofH / 2, 0);
      roof.castShadow = true;
      scene.add(roof);

      // Trees
      const treeMat = new THREE.MeshStandardMaterial({ color: 0x2d7a2d, roughness: 0.9 });
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x664422, roughness: 0.9 });
      [[-centerX - 4, -centerZ - 4], [centerX + 4, -centerZ - 4], [-centerX - 4, centerZ + 4]].forEach(([tx, tz]) => {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2.5, 8), trunkMat);
        trunk.position.set(tx, 1.25, tz);
        scene.add(trunk);
        const crown = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6), treeMat);
        crown.position.set(tx, 4, tz);
        crown.castShadow = true;
        scene.add(crown);
      });

      // Position camera
      const camDist = Math.max(maxBX, maxBZ) * 2.2;
      camera.position.set(camDist * 0.7, camDist * 0.8, camDist * 0.7);
      camera.lookAt(0, totalH / 2, 0);
      controls.target.set(0, totalH / 3, 0);
      controls.update();

      setLoading(false);

      // Animate
      const animate = () => {
        if (destroyed) return;
        frameId = requestAnimationFrame(animate);
        controls.autoRotate = autoRotateRef.current;
        controls.autoRotateSpeed = 1.5;
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // Resize
      const onResize = () => {
        if (!mount) return;
        camera.aspect = mount.clientWidth / mount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mount.clientWidth, mount.clientHeight);
      };
      window.addEventListener('resize', onResize);

      cleanupRef.current = () => {
        destroyed = true;
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      };
    })();

    return () => {
      cleanupRef.current?.();
    };
  }, [floorPlans]);

  const setView = (mode: typeof viewMode) => {
    setViewMode(mode);
    const camera = cameraRef.current as { position: { set: (x: number, y: number, z: number) => void }; lookAt: (x: number, y: number, z: number) => void } | null;
    const controls = controlsRef.current as { target: { set: (x: number, y: number, z: number) => void }; update: () => void } | null;
    if (!camera || !controls) return;
    const h = floorPlans.length * 3.2;
    if (mode === 'aerial') {
      camera.position.set(0, 35, 0.001);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
    } else if (mode === 'exterior') {
      camera.position.set(20, h + 2, 20);
      camera.lookAt(0, h / 2, 0);
      controls.target.set(0, h / 3, 0);
    } else {
      camera.position.set(5, h * 0.5, 5);
      camera.lookAt(0, h * 0.5, 0);
      controls.target.set(0, h * 0.5, 0);
    }
    controls.update();
  };

  return (
    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' }}>
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#eef2f7', zIndex: 10, flexDirection: 'column', gap: 12,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--blueprint)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ fontSize: 13, color: 'var(--steel)', fontFamily: 'var(--font-body)' }}>Building 3D model…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Controls */}
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 20,
        display: 'flex', gap: 6, flexWrap: 'wrap',
      }}>
        {(['aerial', 'exterior', 'walkthrough'] as const).map(m => (
          <button key={m} onClick={() => setView(m)} style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500,
            cursor: 'pointer', border: 'none', fontFamily: 'var(--font-body)',
            backgroundColor: viewMode === m ? 'var(--blueprint)' : 'rgba(255,255,255,0.85)',
            color: viewMode === m ? 'white' : 'var(--ink)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}>
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
        <button onClick={() => setAutoRotate(v => !v)} style={{
          padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500,
          cursor: 'pointer', border: 'none', fontFamily: 'var(--font-body)',
          backgroundColor: autoRotate ? '#c8853a' : 'rgba(255,255,255,0.85)',
          color: autoRotate ? 'white' : 'var(--ink)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          {autoRotate ? '⏸ Stop' : '▶ Auto-rotate'}
        </button>
      </div>

      {/* Hint */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12, zIndex: 20,
        padding: '4px 10px', borderRadius: 12, fontSize: 10,
        backgroundColor: 'rgba(0,0,0,0.35)', color: 'white',
        fontFamily: 'var(--font-mono)',
      }}>
        Drag to orbit · Scroll to zoom · Right-drag to pan
      </div>

      <div ref={mountRef} style={{ width: '100%', height: 520 }} />
    </div>
  );
}
