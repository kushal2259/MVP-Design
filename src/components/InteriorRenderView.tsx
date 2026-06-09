'use client';
import { useRef, useEffect, useState } from 'react';
import type { RoomLayout, PlotSettings } from '@/types';
import type * as THREE_TYPES from 'three';

interface Props {
  rooms: RoomLayout[];
  settings: PlotSettings;
  floor?: number;
}

const FLOOR_HEIGHT = 10; // feet per floor
const FT = 0.3048;       // feet to metres (Three.js uses metres)

const ROOM_WALL_COLORS: Record<string, string> = {
  living:    '#f5f0e8',
  bedroom:   '#eee8f0',
  kitchen:   '#e8f0ec',
  dining:    '#f0ece4',
  toilet:    '#e4ecf0',
  corridor:  '#f0f0ec',
  lobby:     '#f0ece4',
  staircase: '#e8e8e8',
  balcony:   '#dff0e8',
  default:   '#f0f0ee',
};

const ROOM_FLOOR_COLORS: Record<string, string> = {
  living:    '#c8b89a',
  bedroom:   '#d4c4b0',
  kitchen:   '#c0c8c0',
  dining:    '#c8bca8',
  toilet:    '#b8c8d0',
  corridor:  '#c8c4bc',
  default:   '#c4bcb0',
};

export default function InteriorRenderView({ rooms, settings, floor = 0 }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<import('three').WebGLRenderer | null>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!canvasRef.current) return;
    let animId: number;
    let mounted = true;

    const init = async () => {
      try {
        const THREE = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

        if (!mounted || !canvasRef.current) return;

        const W = canvasRef.current.clientWidth || 900;
        const H = canvasRef.current.clientHeight || 600;

        // ── Compute building bounding box (floor 0) for a dollhouse framing ──
        const f0 = rooms.filter(r => r.floor === floor && r.type !== 'garden' && r.type !== 'parking');
        const bbRooms = f0.length ? f0 : rooms.filter(r => r.floor === floor);
        const minX = Math.min(...bbRooms.map(r => r.x)) * FT;
        const maxX = Math.max(...bbRooms.map(r => r.x + r.w)) * FT;
        const minZ = Math.min(...bbRooms.map(r => r.y)) * FT;
        const maxZ = Math.max(...bbRooms.map(r => r.y + r.h)) * FT;
        const cx = (minX + maxX) / 2;
        const cz = (minZ + maxZ) / 2;
        const span = Math.max(maxX - minX, maxZ - minZ, 4);

        // Scene — bright neutral studio backdrop so interiors read clearly
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#e9ecf2');

        // Camera — elevated "dollhouse" angle looking down into the open-roof rooms
        const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 2000);
        camera.position.set(cx + span * 0.85, span * 1.05, cz + span * 0.95);
        camera.lookAt(cx, 0, cz);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        canvasRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Controls — orbit around the building centre
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = span * 0.4;
        controls.maxDistance = span * 4;
        controls.maxPolarAngle = Math.PI / 2 - 0.05; // stay above the floor
        controls.target.set(cx, FLOOR_HEIGHT * FT * 0.3, cz);
        controls.update();

        // ── LIGHTING (bright, even — this is a client-facing showcase) ──
        scene.add(new THREE.AmbientLight('#ffffff', 0.55));
        const hemi = new THREE.HemisphereLight('#dce6ff', '#f0e2c8', 0.9);
        scene.add(hemi);

        // Sun directional light
        const sun = new THREE.DirectionalLight('#fff5e0', 1.6);
        sun.position.set(cx + span, span * 1.6, cz + span * 0.6);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = span * 6 + 100;
        sun.shadow.camera.left = -span * 1.2;
        sun.shadow.camera.right = span * 1.2;
        sun.shadow.camera.top = span * 1.2;
        sun.shadow.camera.bottom = -span * 1.2;
        sun.shadow.bias = -0.0005;
        scene.add(sun);
        // Fill light from the opposite side to lift shadows
        const fill = new THREE.DirectionalLight('#cfe0ff', 0.5);
        fill.position.set(cx - span, span, cz - span);
        scene.add(fill);

        // Room accent lights
        const rooms0 = rooms.filter(r => r.floor === floor);
        rooms0.forEach(r => {
          const lx = (r.x + r.w / 2) * FT;
          const lz = (r.y + r.h / 2) * FT;
          const ly = FLOOR_HEIGHT * FT * 0.85;
          const pointLight = new THREE.PointLight('#fff8e8', 0.5, r.w * FT * 3);
          pointLight.position.set(lx, ly, lz);
          pointLight.castShadow = false;
          scene.add(pointLight);
        });

        // ── MATERIALS ──────────────────────────────────────────
        const makeMat = (color: string, roughness = 0.8, metalness = 0) =>
          new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness, metalness });

        const floorMats: Record<string, THREE_TYPES.Material> = {};
        const wallMats: Record<string, THREE_TYPES.Material> = {};
        Object.entries(ROOM_FLOOR_COLORS).forEach(([k, v]) => {
          floorMats[k] = makeMat(v, 0.7);
        });
        Object.entries(ROOM_WALL_COLORS).forEach(([k, v]) => {
          wallMats[k] = makeMat(v, 0.9);
        });

        const ceilingMat = makeMat('#f8f8f5', 0.95);
        const glassMat = new THREE.MeshStandardMaterial({
          color: '#88ccff', transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.1,
        });
        const frameMat = makeMat('#5a4a3a', 0.6);
        const doorMat = makeMat('#8b6b4a', 0.5);
        const skirting = makeMat('#d4c4a8', 0.75);

        // ── BUILD ROOMS ───────────────────────────────────────
        rooms.filter(r => r.floor === floor).forEach(r => {
          const rx = r.x * FT, rz = r.y * FT;
          const rw = r.w * FT, rh = r.h * FT;
          const fh = FLOOR_HEIGHT * FT;
          const wallT = 0.15;
          const wt = wallMats[r.type] || wallMats.default;
          const ft = floorMats[r.type] || floorMats.default;

          // Floor slab
          const slab = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.15, rh), ft);
          slab.position.set(rx + rw / 2, -0.075, rz + rh / 2);
          slab.receiveShadow = true;
          scene.add(slab);

          // NOTE: No ceiling — this is an open-roof dollhouse view so the camera
          // can look down into every room. (ceilingMat retained for skirting tone.)
          void ceilingMat;

          // Skirting boards
          const skirtH = 0.1, skirtT = 0.03;
          [
            [rw, rz + rh / 2, rx + rw / 2, 0, 0],
            [rw, rz + rh / 2, rx + rw / 2, Math.PI, 0],
          ].forEach(() => {}); // simplified — just do 4 walls

          // 4 walls (N=front, S=back, E=right, W=left)
          const walls: [number, number, number, number, number][] = [
            [rw + wallT * 2, fh, wallT, rx + rw / 2, rz - wallT / 2],         // front
            [rw + wallT * 2, fh, wallT, rx + rw / 2, rz + rh + wallT / 2],    // back
            [wallT, fh, rh, rx - wallT / 2, rz + rh / 2],                     // left
            [wallT, fh, rh, rx + rw + wallT / 2, rz + rh / 2],                // right
          ];
          walls.forEach(([ww, wh, wd, wx, wz]) => {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, wd), wt);
            wall.position.set(wx, wh / 2, wz);
            wall.castShadow = true;
            wall.receiveShadow = true;
            scene.add(wall);
          });

          // Windows
          r.windows.forEach(win => {
            const ww = win.width * FT;
            const wH = 1.2;
            const sillH = 0.9;
            const off = win.offset * FT;
            let wx = 0, wz = 0, rx2 = 0, rz2 = 0;
            if (win.side === 'front') { wx = rx + off + ww / 2; wz = rz; rx2 = ww; rz2 = wallT + 0.02; }
            else if (win.side === 'back') { wx = rx + off + ww / 2; wz = rz + rh; rx2 = ww; rz2 = wallT + 0.02; }
            else if (win.side === 'left') { wx = rx; wz = rz + off + ww / 2; rx2 = wallT + 0.02; rz2 = ww; }
            else { wx = rx + rw; wz = rz + off + ww / 2; rx2 = wallT + 0.02; rz2 = ww; }

            // Glass pane
            const glass = new THREE.Mesh(new THREE.BoxGeometry(rx2, wH, rz2), glassMat);
            glass.position.set(wx, sillH + wH / 2, wz);
            scene.add(glass);
            // Frame
            const frame = new THREE.Mesh(new THREE.BoxGeometry(rx2 + 0.05, wH + 0.05, rz2 + 0.02), frameMat);
            frame.position.set(wx, sillH + wH / 2, wz);
            scene.add(frame);
          });

          // Doors
          r.doors.forEach(door => {
            const dw = door.width * FT;
            const dH = 2.1;
            const off = door.offset * FT;
            let dx = 0, dz = 0, dr = 0, dw2 = 0, dd2 = 0;
            if (door.side === 'front') { dx = rx + off + dw / 2; dz = rz; dw2 = dw; dd2 = wallT + 0.01; }
            else if (door.side === 'back') { dx = rx + off + dw / 2; dz = rz + rh; dw2 = dw; dd2 = wallT + 0.01; }
            else if (door.side === 'left') { dx = rx; dz = rz + off + dw / 2; dw2 = wallT + 0.01; dd2 = dw; }
            else { dx = rx + rw; dz = rz + off + dw / 2; dw2 = wallT + 0.01; dd2 = dw; }

            // Door panel (slightly open at 20°)
            const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(dw2, dH, dd2), doorMat);
            doorPanel.position.set(dx, dH / 2, dz);
            scene.add(doorPanel);
          });

          // ── FURNITURE ─────────────────────────────────────
          r.furniture.forEach(f => {
            const fx = (rx + f.x * FT), fz = (rz + f.y * FT);
            const fw = f.w * FT, fd = f.h * FT;

            const addBox = (w: number, h: number, d: number, ox: number, oy: number, oz: number, color: string, rough = 0.7) => {
              const mat = makeMat(color, rough, color.startsWith('#8') ? 0.2 : 0);
              const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
              mesh.position.set(fx + ox, oy + h / 2, fz + oz);
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              scene.add(mesh);
            };

            const addCyl = (r2: number, h: number, ox: number, oy: number, oz: number, color: string) => {
              const mat = makeMat(color, 0.8);
              const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r2, r2, h, 12), mat);
              mesh.position.set(fx + ox, oy + h / 2, fz + oz);
              mesh.castShadow = true;
              scene.add(mesh);
            };

            const rot = (f.rotation * Math.PI) / 180;

            switch (f.type) {
              case 'sofa': case 'sofa-3seater': {
                // Base
                addBox(fw, 0.45, fd * 0.6, 0, 0, fd * 0.1, '#8b7355');
                // Backrest
                addBox(fw, 0.75, fd * 0.2, 0, 0, -fd * 0.2, '#8b7355');
                // Cushions
                for (let i = 0; i < 3; i++) {
                  addBox(fw / 3 - 0.05, 0.15, fd * 0.5, -fw / 3 + (i * fw / 3), 0.45, fd * 0.05, '#a08060', 0.9);
                }
                break;
              }
              case 'bed': case 'bed-king': case 'bed-queen': {
                addBox(fw, 0.35, fd, 0, 0, 0, '#c4a882');
                addBox(fw, 0.55, fd * 0.2, 0, 0.35, -fd * 0.4, '#8b6b4a');
                addBox(fw - 0.1, 0.2, fd * 0.7, 0, 0.35, fd * 0.05, '#e0d0b8', 0.95);
                addBox(fw * 0.3, 0.15, fw * 0.3, -fw * 0.3, 0.5, -fd * 0.3, '#f0ead8', 0.95);
                addBox(fw * 0.3, 0.15, fw * 0.3, fw * 0.3, 0.5, -fd * 0.3, '#f0ead8', 0.95);
                break;
              }
              case 'dining-table': case 'dining-table-6seater': case 'dining-table-4seater': {
                addBox(fw, 0.05, fd, 0, 0.73, 0, '#6b4c2a', 0.5);
                [[-fw * 0.4, -fw * 0.4], [fw * 0.4, -fw * 0.4], [-fw * 0.4, fw * 0.4], [fw * 0.4, fw * 0.4]].forEach(([ox, oz]) => {
                  addCyl(0.03, 0.73, ox, 0, oz, '#5a3d1e');
                });
                break;
              }
              case 'dining-chair': case 'chair': {
                addBox(0.45, 0.05, 0.45, 0, 0.44, 0, '#7a5c38');
                addBox(0.45, 0.4, 0.06, 0, 0.44, -0.2, '#7a5c38');
                break;
              }
              case 'kitchen-counter': case 'kitchen-counter-l': case 'kitchen-counter-straight': {
                addBox(fw, 0.85, fd, 0, 0, 0, '#e8e0d4');
                addBox(fw + 0.04, 0.04, fd + 0.04, 0, 0.87, 0, '#d0c8bc', 0.3);
                // Cabinet doors
                for (let i = 0; i < Math.floor(fw / 0.5); i++) {
                  addBox(0.46, 0.7, 0.02, -fw / 2 + 0.25 + i * 0.5, 0, fd / 2, '#c8c0b4', 0.6);
                }
                // Upper cabinets
                addBox(fw, 0.7, fd * 0.35, 0, 0.85 + 0.5, -fd * 0.18, '#e0d8cc', 0.6);
                break;
              }
              case 'refrigerator': {
                addBox(fw, 1.7, fd, 0, 0, 0, '#e0e0e0', 0.2);
                addBox(fw - 0.04, 0.8, 0.02, 0, 0.05, fd / 2, '#d0d0d0', 0.2);
                addBox(fw - 0.04, 0.8, 0.02, 0, 0.95, fd / 2, '#d0d0d0', 0.2);
                break;
              }
              case 'tv-unit': {
                addBox(fw, 0.5, fd, 0, 0, 0, '#3a3530', 0.4);
                const tvW = Math.min(fw * 0.9, 1.5);
                addBox(tvW, tvW * 0.57, 0.06, 0, 0.5 + tvW * 0.285, -fd * 0.3, '#111111', 0.1);
                break;
              }
              case 'wardrobe': case 'wardrobe-sliding': case 'wardrobe-hinged': {
                addBox(fw, 2.1, fd, 0, 0, 0, '#c4b090', 0.5);
                addBox(0.02, 2.0, fd + 0.01, 0, 0.05, 0, '#b0a080', 0.4);
                addBox(fw * 0.05, 0.08, 0.06, 0, 1.0, fd / 2, '#8b7355', 0.3);
                break;
              }
              case 'wc': {
                addBox(fw * 0.5, 0.45, fd * 0.8, 0, 0, -fd * 0.05, '#f0f0f0', 0.3);
                addBox(fw * 0.55, 0.08, fd * 0.35, 0, 0.45, -fd * 0.28, '#e8e8e8', 0.3);
                break;
              }
              case 'basin': case 'basin-single': {
                addBox(fw, 0.12, fd, 0, 0.8, 0, '#f0f0f0', 0.2);
                addCyl(0.04, 0.82, 0, 0, 0, '#c0c0c0');
                break;
              }
              case 'bathtub': {
                addBox(fw, 0.55, fd, 0, 0, 0, '#f8f8f8', 0.2);
                addBox(fw - 0.15, 0.3, fd - 0.2, 0, 0.15, 0, '#e8f4ff', 0.1);
                break;
              }
              case 'shower': case 'shower-enclosure': {
                const glassMat2 = new THREE.MeshStandardMaterial({ color: '#88bbee', transparent: true, opacity: 0.3, roughness: 0.1 });
                const enc = new THREE.Mesh(new THREE.BoxGeometry(fw, 2.0, fd), glassMat2);
                enc.position.set(fx, 1.0, fz);
                scene.add(enc);
                break;
              }
              case 'plant': case 'plant-potted': case 'plant-fiddle': {
                addCyl(0.15, 0.3, 0, 0, 0, '#8b4513');
                addCyl(0.4, 0.8, 0, 0.3, 0, '#2d7a2d');
                break;
              }
              case 'coffee-table': {
                addBox(fw, 0.04, fd, 0, 0.4, 0, '#6b4c2a', 0.5);
                [[-fw * 0.4, -fd * 0.35], [fw * 0.4, -fd * 0.35], [-fw * 0.4, fd * 0.35], [fw * 0.4, fd * 0.35]].forEach(([ox, oz]) => {
                  addCyl(0.025, 0.4, ox, 0, oz, '#5a3d1e');
                });
                break;
              }
              default: {
                addBox(fw * 0.8, 0.5, fd * 0.8, 0, 0, 0, '#9a8a78');
              }
            }
          });
        });

        // ── CEILING LIGHTS ────────────────────────────────────
        rooms.filter(r => r.floor === floor).forEach(r => {
          const lx = (r.x + r.w / 2) * FT, lz = (r.y + r.h / 2) * FT;
          const fh = FLOOR_HEIGHT * FT;
          const lightDisc = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.18, 0.06, 16),
            new THREE.MeshStandardMaterial({ color: '#fffde0', emissive: '#ffe8a0', emissiveIntensity: 2.0 })
          );
          lightDisc.position.set(lx, fh - 0.04, lz);
          scene.add(lightDisc);
        });

        if (mounted) setLoading(false);

        // Animate
        const animate = () => {
          animId = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

        // Resize handler
        const onResize = () => {
          if (!canvasRef.current) return;
          const w = canvasRef.current.clientWidth, h = canvasRef.current.clientHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        window.addEventListener('resize', onResize);

        return () => {
          window.removeEventListener('resize', onResize);
          cancelAnimationFrame(animId);
          renderer.dispose();
          if (canvasRef.current && renderer.domElement.parentNode === canvasRef.current) {
            canvasRef.current.removeChild(renderer.domElement);
          }
        };
      } catch (e) {
        if (mounted) setError(String(e));
      }
    };

    const cleanup = init();
    return () => {
      mounted = false;
      cleanup.then(fn => fn?.());
    };
  }, [rooms, settings, floor]);

  if (error) return (
    <div style={{ padding: 32, color: '#ef4444', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
      Render error: {error}
    </div>
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: 640, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#1a1a2e', zIndex: 10, gap: 16,
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: '50%', backgroundColor: 'var(--amber)',
                animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}/>
            ))}
          </div>
          <div style={{ color: '#94a3b8', fontSize: 13, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
            RENDERING INTERIOR...
          </div>
        </div>
      )}

      <div ref={canvasRef} style={{ width: '100%', height: '100%' }} />

      {/* HUD */}
      {!loading && (
        <div style={{
          position: 'absolute', bottom: 16, left: 16, right: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          pointerEvents: 'none',
        }}>
          <div style={{
            backgroundColor: 'rgba(10,10,20,0.8)', color: '#94a3b8',
            padding: '8px 16px', borderRadius: 8, fontSize: 11,
            fontFamily: 'var(--font-mono)', backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ color: '#f8c060', fontWeight: 700, marginBottom: 4, letterSpacing: '0.08em' }}>
              INTERIOR 3D — CLIENT PREVIEW
            </div>
            Left drag: orbit · Scroll: zoom · Right drag: pan
          </div>
          <div style={{
            backgroundColor: 'rgba(10,10,20,0.8)', color: '#94a3b8',
            padding: '8px 16px', borderRadius: 8, fontSize: 11,
            fontFamily: 'var(--font-mono)', backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.08)',
            textAlign: 'right',
          }}>
            <div style={{ color: '#7dd3fc', marginBottom: 2 }}>
              {rooms.filter(r => r.floor === floor).length} rooms rendered
            </div>
            <div>{rooms.filter(r => r.floor === floor).reduce((s, r) => s + r.furniture.length, 0)} furniture items</div>
          </div>
        </div>
      )}
    </div>
  );
}
