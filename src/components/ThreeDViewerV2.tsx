'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomLayout, PlotSettings } from '@/lib/layoutSolver';
import { Move, RotateCcw, Video, Eye } from 'lucide-react';

interface ThreeDViewerProps {
  rooms: RoomLayout[];
  settings: PlotSettings;
}

export default function ThreeDViewer({ rooms, settings }: ThreeDViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'orbit' | 'walkthrough' | 'video'>('orbit');
  const [activeFloorView, setActiveFloorView] = useState<'all' | '0' | '1' | '2'>('all');
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  // Walkthrough position trackers
  const walkPos = useRef({ x: 25, y: 5.5, z: 25 });
  const walkRotation = useRef(0); // in radians

  // Video Tour States and Refs
  const [currentRoomName, setRoomNameDisplay] = useState('');
  const [videoTimeDisplay, setVideoTimeDisplay] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [videoSpeed, setVideoSpeed] = useState(1);

  const videoTimeRef = useRef(0);
  const videoPlayingRef = useRef(true);
  const videoSpeedRef = useRef(1);
  const tourPathRef = useRef<any[]>([]);
  const currentRoomNameRef = useRef('');
  const lastSyncTimeRef = useRef(-1);

  // Keep refs in sync
  useEffect(() => {
    videoPlayingRef.current = videoPlaying;
  }, [videoPlaying]);

  useEffect(() => {
    videoSpeedRef.current = videoSpeed;
  }, [videoSpeed]);

  // Path generator for cinematic walkthrough
  const getTourPath = (
    roomsList: RoomLayout[],
    floorView: string,
    floorHeight: number,
    plinthHeight: number
  ) => {
    const targetFloorNum = floorView === 'all' ? 0 : parseInt(floorView);
    const targetRooms = roomsList.filter(
      r => r.floor === targetFloorNum && r.type !== 'parking' && r.type !== 'garden'
    );
    const roomsToUse = targetRooms.length > 0 ? targetRooms : roomsList.filter(
      r => r.type !== 'parking' && r.type !== 'garden'
    );
    if (roomsToUse.length === 0) return [];

    const path: { pos: THREE.Vector3; look: THREE.Vector3; roomName: string }[] = [];

    roomsToUse.forEach(r => {
      const rx = r.x + r.w / 2;
      const rz = r.y + r.h / 2;
      const ry = r.floor * floorHeight + plinthHeight + 5.5; // eye-level 5.5ft height
      const centerPos = new THREE.Vector3(rx, ry, rz);

      // Node 1: Entrance/Approach looking toward center
      path.push({
        pos: new THREE.Vector3(rx - Math.min(2, r.w / 4), ry, rz - Math.min(2, r.h / 4)),
        look: centerPos,
        roomName: `Entering: ${r.name.toUpperCase()}`
      });

      // Node 2: Center panning looking east/north corner
      path.push({
        pos: centerPos,
        look: new THREE.Vector3(rx + r.w / 3, ry, rz + r.h / 3),
        roomName: `Panning: ${r.name.toUpperCase()}`
      });

      // Node 3: Center panning looking west/south corner
      path.push({
        pos: centerPos,
        look: new THREE.Vector3(rx - r.w / 3, ry, rz - r.h / 3),
        roomName: `Panning: ${r.name.toUpperCase()}`
      });
    });

    return path;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Setup Scene, Camera, Renderer
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050811');
    sceneRef.current = scene;

    // Add fog for deep look
    scene.fog = new THREE.FogExp2('#050811', 0.005);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;

    // Clear previous renderer elements
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // 2. Add Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // don't go below ground
    controlsRef.current = controls;

    // Set initial camera positions
    camera.position.set(40, 50, 70);
    controls.target.set(25, 5, 22);
    controls.update();

    // 3. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
    sunLight.position.set(80, 100, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    // Grid Helper
    const gridHelper = new THREE.GridHelper(100, 100, '#10b981', '#1e293b');
    gridHelper.position.y = -0.05;
    scene.add(gridHelper);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 4. Generate Procedural 3D Geometry from rooms list
    const wallMaterial = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.7 });
    const glassMaterial = new THREE.MeshStandardMaterial({ color: '#38bdf8', transparent: true, opacity: 0.4, roughness: 0.1 });
    const floorMaterial = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6 });
    const slabMaterial = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 });
    const woodMaterial = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.5 });
    const greenMaterial = new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.9 });
    const greyMaterial = new THREE.MeshStandardMaterial({ color: '#64748b' });

    // Multi-floor offset (Y in feet)
    const floorHeight = 10;
    const plinthHeight = 1.5;

    // Generate tour path
    tourPathRef.current = getTourPath(rooms, activeFloorView, floorHeight, plinthHeight);

    rooms.forEach(r => {
      // Filter by activeFloorView
      if (activeFloorView !== 'all') {
        const floorNum = parseInt(activeFloorView);
        if (r.floor !== floorNum && r.type !== 'parking' && r.type !== 'garden') return;
      }

      // Calculate base Y position (in feet)
      const baseHeight = r.floor * floorHeight + plinthHeight;
      const roomH = r.type === 'staircase' ? floorHeight * 1.5 : floorHeight;

      // 3D coordinates (x = x, z = y (depth), y = height offset)
      const x = r.x;
      const z = r.y;
      const w = r.w;
      const h = r.h;

      // Draw Slabs for rooms
      if (r.type !== 'parking' && r.type !== 'garden') {
        const slabGeo = new THREE.BoxGeometry(w, 0.5, h);
        const slab = new THREE.Mesh(slabGeo, slabMaterial);
        // Position slab at base of room
        slab.position.set(x + w / 2, baseHeight - 0.25, z + h / 2);
        slab.receiveShadow = true;
        scene.add(slab);

        // Draw Walls (four walls per room)
        const wallThickness = 0.5; // 6 inches
        const wallH = roomH - 0.5;

        // Top Wall
        const wall1Geo = new THREE.BoxGeometry(w, wallH, wallThickness);
        const w1 = new THREE.Mesh(wall1Geo, wallMaterial);
        w1.position.set(x + w / 2, baseHeight + wallH / 2, z + wallThickness / 2);
        scene.add(w1);

        // Bottom Wall
        const wall2Geo = new THREE.BoxGeometry(w, wallH, wallThickness);
        const w2 = new THREE.Mesh(wall2Geo, wallMaterial);
        w2.position.set(x + w / 2, baseHeight + wallH / 2, z + h - wallThickness / 2);
        scene.add(w2);

        // Left Wall
        const wall3Geo = new THREE.BoxGeometry(wallThickness, wallH, h - wallThickness * 2);
        const w3 = new THREE.Mesh(wall3Geo, wallMaterial);
        w3.position.set(x + wallThickness / 2, baseHeight + wallH / 2, z + h / 2);
        scene.add(w3);

        // Right Wall
        const wall4Geo = new THREE.BoxGeometry(wallThickness, wallH, h - wallThickness * 2);
        const w4 = new THREE.Mesh(wall4Geo, wallMaterial);
        w4.position.set(x + w - wallThickness / 2, baseHeight + wallH / 2, z + h / 2);
        scene.add(w4);
      }

      // Draw Parking & Garden
      if (r.type === 'parking') {
        const parkGeo = new THREE.BoxGeometry(w, 0.1, h);
        const park = new THREE.Mesh(parkGeo, greyMaterial);
        park.position.set(x + w / 2, 0.05, z + h / 2);
        scene.add(park);
      } else if (r.type === 'garden') {
        const gardGeo = new THREE.BoxGeometry(w, 0.1, h);
        const gard = new THREE.Mesh(gardGeo, greenMaterial);
        gard.position.set(x + w / 2, 0.05, z + h / 2);
        scene.add(gard);
      }

      // Draw Furniture pieces in 3D
      r.furniture.forEach(f => {
        const fW = f.w;
        const fH = f.h;
        const fx = x + f.x;
        const fz = z + f.y;

        const fGroup = new THREE.Group();
        fGroup.position.set(fx, baseHeight, fz);
        fGroup.rotation.y = (f.rotation * Math.PI) / 180;

        // Custom materials
        const blueFabric = new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.8 });
        const whiteCeramic = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.2 });
        const pillowMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
        const chromeMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.8, roughness: 0.2 });
        const blackGlass = new THREE.MeshStandardMaterial({ color: '#020617', roughness: 0.1 });
        const greenFelt = new THREE.MeshStandardMaterial({ color: '#047857', roughness: 0.9 });

        if (f.type === 'bunk-bed') {
          // Bunk bed frames, ladder, support poles
          for (let fIdx = 0; fIdx < 2; fIdx++) {
            const hOffset = fIdx * 3.8;
            const frame = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.5, fH), woodMaterial);
            frame.position.y = hOffset + 0.25;
            fGroup.add(frame);
            const mat = new THREE.Mesh(new THREE.BoxGeometry(fW - 0.2, 0.7, fH - 0.3), pillowMat);
            mat.position.y = hOffset + 0.85;
            fGroup.add(mat);
            const pillow = new THREE.Mesh(new THREE.BoxGeometry(fW / 3, 0.2, 1.1), pillowMat);
            pillow.position.set(0, hOffset + 1.25, -fH / 2 + 1.0);
            fGroup.add(pillow);
          }
          const poleG = new THREE.CylinderGeometry(0.08, 0.08, 6.8);
          for (let px = -1; px <= 1; px += 2) {
            for (let pz = -1; pz <= 1; pz += 2) {
              const pole = new THREE.Mesh(poleG, woodMaterial);
              pole.position.set(px * (fW / 2 - 0.1), 3.4, pz * (fH / 2 - 0.1));
              fGroup.add(pole);
            }
          }
        } else if (f.type === 'bed-canopy') {
          // Canopy bed frames & posts
          const frame = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.8, fH), woodMaterial);
          frame.position.y = 0.4;
          fGroup.add(frame);
          const mat = new THREE.Mesh(new THREE.BoxGeometry(fW - 0.3, 1.0, fH - 0.4), pillowMat);
          mat.position.y = 1.1;
          fGroup.add(mat);
          const hb = new THREE.Mesh(new THREE.BoxGeometry(fW, 3.2, 0.3), woodMaterial);
          hb.position.set(0, 1.6, -fH / 2 + 0.15);
          fGroup.add(hb);
          // 4 Canopy poles
          const poleG = new THREE.CylinderGeometry(0.06, 0.06, 7.2);
          for (let px = -1; px <= 1; px += 2) {
            for (let pz = -1; pz <= 1; pz += 2) {
              const pole = new THREE.Mesh(poleG, woodMaterial);
              pole.position.set(px * (fW / 2 - 0.08), 3.6, pz * (fH / 2 - 0.08));
              fGroup.add(pole);
            }
          }
          // Top bars
          const topBarW = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.12, 0.12), woodMaterial);
          topBarW.position.set(0, 7.2, -fH / 2 + 0.08); fGroup.add(topBarW);
          const topBarW2 = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.12, 0.12), woodMaterial);
          topBarW2.position.set(0, 7.2, fH / 2 - 0.08); fGroup.add(topBarW2);

        } else if (f.type === 'crib') {
          // Baby crib
          const baseFrame = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.4, fH), woodMaterial);
          baseFrame.position.y = 0.2;
          fGroup.add(baseFrame);
          const mat = new THREE.Mesh(new THREE.BoxGeometry(fW - 0.15, 0.6, fH - 0.15), pillowMat);
          mat.position.y = 0.5;
          fGroup.add(mat);
          // Side slats
          const slatSide = new THREE.Mesh(new THREE.BoxGeometry(fW, 2.2, 0.08), woodMaterial);
          slatSide.position.set(0, 1.3, -fH / 2 + 0.04); fGroup.add(slatSide);
          const slatSide2 = new THREE.Mesh(new THREE.BoxGeometry(fW, 2.2, 0.08), woodMaterial);
          slatSide2.position.set(0, 1.3, fH / 2 - 0.04); fGroup.add(slatSide2);

        } else if (f.type.startsWith('bed')) {
          // BED: frame, mattress, headboard, pillows, blanket
          // Frame
          const frameGeo = new THREE.BoxGeometry(fW, 0.8, fH);
          const frame = new THREE.Mesh(frameGeo, woodMaterial);
          frame.position.y = 0.4;
          frame.castShadow = true;
          frame.receiveShadow = true;
          fGroup.add(frame);

          // Headboard
          const hbGeo = new THREE.BoxGeometry(fW, 3, 0.4);
          const hb = new THREE.Mesh(hbGeo, woodMaterial);
          hb.position.set(0, 1.5, -fH / 2 + 0.2);
          fGroup.add(hb);

          // Mattress
          const matGeo = new THREE.BoxGeometry(fW - 0.3, 1, fH - 0.4);
          const mattress = new THREE.Mesh(matGeo, pillowMat);
          mattress.position.y = 1.1;
          mattress.castShadow = true;
          fGroup.add(mattress);

          // Pillows
          const numPillows = f.type === 'bed-single' ? 1 : 2;
          const pillowW = fW / 3;
          const pillowD = 1.2;
          
          if (numPillows === 1) {
            const pGeo = new THREE.BoxGeometry(pillowW, 0.25, pillowD);
            const p = new THREE.Mesh(pGeo, pillowMat);
            p.position.set(0, 1.625, -fH / 2 + 1.2);
            fGroup.add(p);
          } else {
            const pGeo = new THREE.BoxGeometry(pillowW, 0.25, pillowD);
            const p1 = new THREE.Mesh(pGeo, pillowMat);
            p1.position.set(-fW / 4, 1.625, -fH / 2 + 1.2);
            fGroup.add(p1);

            const p2 = new THREE.Mesh(pGeo, pillowMat);
            p2.position.set(fW / 4, 1.625, -fH / 2 + 1.2);
            fGroup.add(p2);
          }

          // Blanket
          const blanketGeo = new THREE.BoxGeometry(fW - 0.25, 1.05, fH * 0.6);
          const blanket = new THREE.Mesh(blanketGeo, blueFabric);
          blanket.position.set(0, 1.1, fH * 0.2);
          fGroup.add(blanket);

        } else if (f.type.startsWith('sofa') || f.type === 'armchair') {
          // SOFA: base cushion, backrest, armrests
          // Base
          const baseGeo = new THREE.BoxGeometry(fW, 0.8, fH);
          const base = new THREE.Mesh(baseGeo, blueFabric);
          base.position.y = 0.4;
          base.castShadow = true;
          fGroup.add(base);

          if (f.type === 'sofa-sectional') {
            // L-shape sofa
            // Main Backrest
            const brGeo = new THREE.BoxGeometry(fW, 2.5, 0.6);
            const br = new THREE.Mesh(brGeo, blueFabric);
            br.position.set(0, 1.25, -fH / 2 + 0.3);
            fGroup.add(br);

            // Left return cushion
            const retGeo = new THREE.BoxGeometry(0.6, 2.5, fH - 0.6);
            const ret = new THREE.Mesh(retGeo, blueFabric);
            ret.position.set(-fW / 2 + 0.3, 1.25, 0.3);
            fGroup.add(ret);
          } else {
            // Straight Backrest
            const brGeo = new THREE.BoxGeometry(fW, 2.5, 0.6);
            const br = new THREE.Mesh(brGeo, blueFabric);
            br.position.set(0, 1.25, -fH / 2 + 0.3);
            fGroup.add(br);

            // Left Arm
            const laGeo = new THREE.BoxGeometry(0.6, 1.8, fH);
            const la = new THREE.Mesh(laGeo, blueFabric);
            la.position.set(-fW / 2 + 0.3, 0.9, 0);
            fGroup.add(la);

            // Right Arm
            const raGeo = new THREE.BoxGeometry(0.6, 1.8, fH);
            const ra = new THREE.Mesh(raGeo, blueFabric);
            ra.position.set(fW / 2 - 0.3, 0.9, 0);
            fGroup.add(ra);
          }

        } else if (f.type === 'coffee-table' || f.type.startsWith('dining-table') || f.type === 'study-desk') {
          // TABLES: tabletop slab + 4 legs
          const height = f.type === 'coffee-table' ? 1.4 : 2.5;
          
          // Tabletop
          const topGeo = new THREE.BoxGeometry(fW, 0.15, fH);
          const topMat = f.type === 'coffee-table' ? glassMaterial : woodMaterial;
          const tabletop = new THREE.Mesh(topGeo, topMat);
          tabletop.position.y = height - 0.075;
          tabletop.castShadow = true;
          fGroup.add(tabletop);

          // 4 Legs
          const legGeo = new THREE.CylinderGeometry(0.1, 0.1, height - 0.15);
          const legMat = f.type === 'coffee-table' ? chromeMat : woodMaterial;

          const offsets = [
            [-fW / 2 + 0.2, -fH / 2 + 0.2],
            [fW / 2 - 0.2, -fH / 2 + 0.2],
            [-fW / 2 + 0.2, fH / 2 - 0.2],
            [fW / 2 - 0.2, fH / 2 - 0.2]
          ];

          offsets.forEach(([ox, oz]) => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(ox, (height - 0.15) / 2, oz);
            leg.castShadow = true;
            fGroup.add(leg);
          });

          // If dining-table, add chairs
          if (f.type.startsWith('dining-table')) {
            const numChairs = f.type === 'dining-table-4seater' ? 4 : 6;
            const chairGeo = new THREE.BoxGeometry(1.2, 1.4, 1.2);
            
            if (numChairs === 4) {
              const c1 = new THREE.Mesh(chairGeo, woodMaterial); c1.position.set(0, 0.7, -fH/2 - 0.6); fGroup.add(c1);
              const c2 = new THREE.Mesh(chairGeo, woodMaterial); c2.position.set(0, 0.7, fH/2 + 0.6); fGroup.add(c2);
              const c3 = new THREE.Mesh(chairGeo, woodMaterial); c3.position.set(-fW/2 - 0.6, 0.7, 0); fGroup.add(c3);
              const c4 = new THREE.Mesh(chairGeo, woodMaterial); c4.position.set(fW/2 + 0.6, 0.7, 0); fGroup.add(c4);
            } else {
              // 6 chairs
              const c1 = new THREE.Mesh(chairGeo, woodMaterial); c1.position.set(-fW/4, 0.7, -fH/2 - 0.6); fGroup.add(c1);
              const c2 = new THREE.Mesh(chairGeo, woodMaterial); c2.position.set(fW/4, 0.7, -fH/2 - 0.6); fGroup.add(c2);
              const c3 = new THREE.Mesh(chairGeo, woodMaterial); c3.position.set(-fW/4, 0.7, fH/2 + 0.6); fGroup.add(c3);
              const c4 = new THREE.Mesh(chairGeo, woodMaterial); c4.position.set(fW/4, 0.7, fH/2 + 0.6); fGroup.add(c4);
              const c5 = new THREE.Mesh(chairGeo, woodMaterial); c5.position.set(-fW/2 - 0.6, 0.7, 0); fGroup.add(c5);
              const c6 = new THREE.Mesh(chairGeo, woodMaterial); c6.position.set(fW/2 + 0.6, 0.7, 0); fGroup.add(c6);
            }
          }

        } else if (f.type === 'tv-unit') {
          // TV console + screen
          // Stand
          const standGeo = new THREE.BoxGeometry(fW, 1.2, fH);
          const stand = new THREE.Mesh(standGeo, woodMaterial);
          stand.position.y = 0.6;
          fGroup.add(stand);

          // Screen
          const scrGeo = new THREE.BoxGeometry(fW * 0.8, 3, 0.2);
          const screen = new THREE.Mesh(scrGeo, blackGlass);
          screen.position.set(0, 3.2, 0);
          fGroup.add(screen);

          // Stand base for screen
          const baseS = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 0.6), chromeMat);
          baseS.position.set(0, 1.7, 0);
          fGroup.add(baseS);

        } else if (f.type === 'wc') {
          // White ceramic toilet
          // Bowl
          const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.6, 1.4), whiteCeramic);
          bowl.position.set(0, 0.7, 0.3);
          bowl.scale.set(1, 1, 1.3);
          fGroup.add(bowl);

          // Tank
          const tank = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.6), whiteCeramic);
          tank.position.set(0, 1.5, -fH / 2 + 0.3);
          fGroup.add(tank);

        } else if (f.type.startsWith('basin')) {
          // Vanity washbasin
          // Cabinet base
          const cab = new THREE.Mesh(new THREE.BoxGeometry(fW, 2.6, fH), woodMaterial);
          cab.position.y = 1.3;
          fGroup.add(cab);

          // Sink oval cutouts
          const sinks = f.type === 'basin-double' ? 2 : 1;
          if (sinks === 2) {
            const s1 = new THREE.Mesh(new THREE.CylinderGeometry(fW/6, fW/6, 0.1), whiteCeramic);
            s1.position.set(-fW/4, 2.65, 0);
            fGroup.add(s1);

            const s2 = new THREE.Mesh(new THREE.CylinderGeometry(fW/6, fW/6, 0.1), whiteCeramic);
            s2.position.set(fW/4, 2.65, 0);
            fGroup.add(s2);
          } else {
            const s = new THREE.Mesh(new THREE.CylinderGeometry(fW/3.5, fW/3.5, 0.1), whiteCeramic);
            s.position.set(0, 2.65, 0);
            fGroup.add(s);
          }

        } else if (f.type === 'bathtub') {
          // Rounded acrylic bathtub
          const outer = new THREE.Mesh(new THREE.BoxGeometry(fW, 1.8, fH), whiteCeramic);
          outer.position.y = 0.9;
          fGroup.add(outer);

          // Inner cut tub
          const inner = new THREE.Mesh(new THREE.BoxGeometry(fW - 0.4, 1.6, fH - 0.4), blackGlass);
          inner.position.set(0, 1.05, 0);
          fGroup.add(inner);

        } else if (f.type === 'shower-enclosure' || f.type === 'shower') {
          // Glass enclosure
          const tray = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.2, fH), greyMaterial);
          tray.position.y = 0.1;
          fGroup.add(tray);

          // Glass walls
          const w1 = new THREE.Mesh(new THREE.BoxGeometry(fW, 6.5, 0.1), glassMaterial);
          w1.position.set(0, 3.45, -fH/2);
          fGroup.add(w1);

          const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 6.5, fH), glassMaterial);
          w2.position.set(-fW/2, 3.45, 0);
          fGroup.add(w2);

        } else if (f.type.startsWith('car')) {
          // Composite Car Mesh
          const carColor = f.type === 'car-suv' ? '#dc2626' : '#1d4ed8';
          const bodyMat = new THREE.MeshStandardMaterial({ color: carColor, roughness: 0.2, metalness: 0.6 });
          
          // Lower chassis
          const chassis = new THREE.Mesh(new THREE.BoxGeometry(fW, 1.4, fH), bodyMat);
          chassis.position.y = 1.0;
          fGroup.add(chassis);

          // Cabin
          const cabin = new THREE.Mesh(new THREE.BoxGeometry(fW - 0.4, 1.2, fH * 0.5), blackGlass);
          cabin.position.set(0, 2.0, 0);
          fGroup.add(cabin);

          // 4 Wheels
          const whGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.6, 12);
          const whMat = new THREE.MeshStandardMaterial({ color: '#111827' });
          whGeo.rotateZ(Math.PI / 2);

          const wheelOffsets = [
            [-fW / 2 + 1.8, -fH / 2 + 0.3],
            [fW / 2 - 1.8, -fH / 2 + 0.3],
            [-fW / 2 + 1.8, fH / 2 - 0.3],
            [fW / 2 - 1.8, fH / 2 - 0.3]
          ];
          wheelOffsets.forEach(([wx, wz]) => {
            const wheel = new THREE.Mesh(whGeo, whMat);
            wheel.position.set(wx, 0.8, wz);
            fGroup.add(wheel);
          });

        } else if (f.type.startsWith('plant')) {
          // Botanical plant
          // Pot
          const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.4, 1.0), new THREE.MeshStandardMaterial({ color: '#b45309' }));
          pot.position.y = 0.5;
          fGroup.add(pot);

          // Leaves
          const leaves = new THREE.Mesh(new THREE.SphereGeometry(fW / 2, 8, 8), greenMaterial);
          leaves.position.y = 1.5;
          leaves.scale.set(1.0, 1.5, 1.0);
          fGroup.add(leaves);

        } else if (f.type === 'piano') {
          // Piano box
          const body = new THREE.Mesh(new THREE.BoxGeometry(fW, 2.5, fH), blackGlass);
          body.position.y = 1.25;
          fGroup.add(body);
          
          // Keyboard keys
          const keys = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.3, 0.8), whiteCeramic);
          keys.position.set(0, 1.5, fH / 2 - 0.4);
          fGroup.add(keys);

        } else if (f.type === 'pool-table') {
          // Billiards table
          const frame = new THREE.Mesh(new THREE.BoxGeometry(fW, 2.5, fH), woodMaterial);
          frame.position.y = 1.25;
          fGroup.add(frame);

          const felt = new THREE.Mesh(new THREE.BoxGeometry(fW - 0.5, 0.1, fH - 0.5), greenFelt);
          felt.position.set(0, 2.5, 0);
          fGroup.add(felt);

        } else if (f.type === 'gym-treadmill') {
          // Treadmill
          const deck = new THREE.Mesh(new THREE.BoxGeometry(fW * 0.8, 0.4, fH * 0.8), greyMaterial);
          deck.position.set(0, 0.2, -fH * 0.1);
          fGroup.add(deck);

          const mast = new THREE.Mesh(new THREE.BoxGeometry(fW, 2.8, 0.2), chromeMat);
          mast.position.set(0, 1.6, fH * 0.35);
          fGroup.add(mast);

        } else if (f.type === 'washing-machine') {
          // Washer
          const body = new THREE.Mesh(new THREE.BoxGeometry(fW, 2.8, fH), whiteCeramic);
          body.position.y = 1.4;
          fGroup.add(body);

          // Drum glass door
          const door = new THREE.Mesh(new THREE.CylinderGeometry(fW * 0.3, fW * 0.3, 0.1, 16), glassMaterial);
          door.rotateX(Math.PI / 2);
          door.position.set(0, 1.4, fH / 2);
          fGroup.add(door);

        } else if (f.type === 'refrigerator') {
          // Steel double door fridge
          const fridge = new THREE.Mesh(new THREE.BoxGeometry(fW, 5.5, fH), chromeMat);
          fridge.position.y = 2.75;
          fGroup.add(fridge);

        } else if (f.type === 'jacuzzi') {
          // Jacuzzi tub with glowing water
          const outerTub = new THREE.Mesh(new THREE.BoxGeometry(fW, 2.0, fH), whiteCeramic);
          outerTub.position.y = 1.0;
          fGroup.add(outerTub);
          const innerWater = new THREE.Mesh(new THREE.BoxGeometry(fW - 0.6, 1.8, fH - 0.6), new THREE.MeshStandardMaterial({ color: '#00ffff', transparent: true, opacity: 0.7, roughness: 0.1 }));
          innerWater.position.y = 1.05;
          fGroup.add(innerWater);

        } else if (f.type === 'bbq-grill') {
          // BBQ Grill drum
          const baseGrill = new THREE.Mesh(new THREE.CylinderGeometry(fW / 3, fW / 3, 1.8), new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.8 }));
          baseGrill.position.y = 1.4;
          fGroup.add(baseGrill);
          const coals = new THREE.Mesh(new THREE.CylinderGeometry(fW / 3 - 0.1, fW / 3 - 0.1, 0.1), new THREE.MeshStandardMaterial({ color: '#ea580c', emissive: '#ea580c' }));
          coals.position.y = 2.35;
          fGroup.add(coals);
          // Legs
          const legG = new THREE.CylinderGeometry(0.06, 0.06, 1.4);
          const l1 = new THREE.Mesh(legG, chromeMat); l1.position.set(-fW / 4, 0.7, 0); fGroup.add(l1);
          const l2 = new THREE.Mesh(legG, chromeMat); l2.position.set(fW / 4, 0.7, 0); fGroup.add(l2);

        } else if (f.type === 'outdoor-umbrella') {
          // Patio umbrella
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6.5), chromeMat);
          pole.position.y = 3.25;
          fGroup.add(pole);
          const umbrella = new THREE.Mesh(new THREE.CylinderGeometry(0, fW / 2, 1.2, 16), new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.8 }));
          umbrella.position.y = 5.9;
          fGroup.add(umbrella);

        } else if (f.type === 'gaming-desk') {
          // L-shaped gaming desk + monitors + neon LEDs
          const desktop = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.15, fH), new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.3 }));
          desktop.position.y = 2.4;
          fGroup.add(desktop);
          const baseL1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, fH - 0.4), greyMaterial);
          baseL1.position.set(-fW / 2 + 0.2, 1.2, 0); fGroup.add(baseL1);
          const baseL2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, fH - 0.4), greyMaterial);
          baseL2.position.set(fW / 2 - 0.2, 1.2, 0); fGroup.add(baseL2);
          // Dual monitors
          const mon1 = new THREE.Mesh(new THREE.BoxGeometry(fW * 0.35, 1.4, 0.15), blackGlass);
          mon1.position.set(-fW * 0.18, 3.4, -0.4); fGroup.add(mon1);
          const mon2 = new THREE.Mesh(new THREE.BoxGeometry(fW * 0.35, 1.4, 0.15), blackGlass);
          mon2.position.set(fW * 0.18, 3.4, -0.4); fGroup.add(mon2);
          // Neon glow line underneath
          const neon = new THREE.Mesh(new THREE.BoxGeometry(fW - 0.4, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: '#00ffff', emissive: '#00ffff' }));
          neon.position.set(0, 2.3, -fH / 2 + 0.1); fGroup.add(neon);

        } else if (f.type === 'gaming-chair') {
          // Racer gaming chair
          const chairColor = new THREE.MeshStandardMaterial({ color: '#ff0055', roughness: 0.6 });
          const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 1.4), chairColor);
          seat.position.y = 1.2;
          fGroup.add(seat);
          const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.0, 0.25), chairColor);
          back.position.set(0, 2.2, -0.6);
          fGroup.add(back);
          const baseStem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0), chromeMat);
          baseStem.position.y = 0.5;
          fGroup.add(baseStem);

        } else if (f.type === 'aquarium') {
          // Aquarium on stand
          const cabinet = new THREE.Mesh(new THREE.BoxGeometry(fW, 2.0, fH), woodMaterial);
          cabinet.position.y = 1.0; fGroup.add(cabinet);
          const tank = new THREE.Mesh(new THREE.BoxGeometry(fW - 0.2, 2.2, fH - 0.2), glassMaterial);
          tank.position.y = 3.1; fGroup.add(tank);
          const water = new THREE.Mesh(new THREE.BoxGeometry(fW - 0.3, 2.0, fH - 0.3), new THREE.MeshStandardMaterial({ color: '#0284c7', transparent: true, opacity: 0.6 }));
          water.position.y = 3.0; fGroup.add(water);

        } else if (f.type === 'bar-counter') {
          // High bar counter
          const counter = new THREE.Mesh(new THREE.BoxGeometry(fW, 3.8, fH), woodMaterial);
          counter.position.y = 1.9;
          fGroup.add(counter);

        } else if (f.type === 'bar-stool') {
          // High bar stool
          const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 16), chromeMat);
          seat.position.y = 2.8; fGroup.add(seat);
          const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6), chromeMat);
          stand.position.y = 1.3; fGroup.add(stand);

        } else if (f.type === 'credenza') {
          // Dining sideboard
          const cred = new THREE.Mesh(new THREE.BoxGeometry(fW, 2.8, fH), woodMaterial);
          cred.position.y = 1.4;
          fGroup.add(cred);

        } else if (f.type === 'vanity-makeup') {
          // Makeup vanity table
          const desk = new THREE.Mesh(new THREE.BoxGeometry(fW, 2.4, fH), whiteCeramic);
          desk.position.y = 1.2; fGroup.add(desk);
          const mirror = new THREE.Mesh(new THREE.BoxGeometry(fW * 0.8, 2.2, 0.1), glassMaterial);
          mirror.position.set(0, 3.5, -fH / 2 + 0.1); fGroup.add(mirror);

        } else if (f.type === 'gym-bench') {
          // Workout bench
          const frameB = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.2, fH), greyMaterial);
          frameB.position.y = 1.2; fGroup.add(frameB);
          const pad = new THREE.Mesh(new THREE.BoxGeometry(fW - 0.2, 0.2, fH), new THREE.MeshStandardMaterial({ color: '#111827' }));
          pad.position.y = 1.3; fGroup.add(pad);
          // Legs
          const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2);
          const l1 = new THREE.Mesh(legGeo, greyMaterial); l1.position.set(-fW / 2.2, 0.6, 0); fGroup.add(l1);
          const l2 = new THREE.Mesh(legGeo, greyMaterial); l2.position.set(fW / 2.2, 0.6, 0); fGroup.add(l2);

        } else if (f.type === 'pet-bed') {
          // Small pet bed
          const outerRing = new THREE.Mesh(new THREE.CylinderGeometry(fW / 2, fW / 2, 0.4, 16), new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.9 }));
          outerRing.position.y = 0.2; fGroup.add(outerRing);
          const pillow = new THREE.Mesh(new THREE.CylinderGeometry(fW / 2 - 0.2, fW / 2 - 0.2, 0.35, 16), pillowMat);
          pillow.position.y = 0.22; fGroup.add(pillow);

        } else {
          // Default wood bounding box
          const boxGeo = new THREE.BoxGeometry(fW, 2.5, fH);
          const box = new THREE.Mesh(boxGeo, woodMaterial);
          box.position.y = 1.25;
          box.castShadow = true;
          fGroup.add(box);
        }

        scene.add(fGroup);
      });
    });

    // 5. Animation loop
    let reqId: number;
    const animate = () => {
      reqId = requestAnimationFrame(animate);

      if (viewMode === 'orbit') {
        controls.update();
      } else if (viewMode === 'walkthrough') {
        // Walkthrough Mode Camera controls
        camera.position.set(walkPos.current.x, walkPos.current.y, walkPos.current.z);
        const lookTarget = new THREE.Vector3(
          walkPos.current.x + Math.sin(walkRotation.current),
          walkPos.current.y,
          walkPos.current.z + Math.cos(walkRotation.current)
        );
        camera.lookAt(lookTarget);
      } else if (viewMode === 'video') {
        if (videoPlayingRef.current) {
          const delta = (1 / 60) * videoSpeedRef.current;
          videoTimeRef.current += delta;
        }

        const path = tourPathRef.current;
        if (path.length > 1) {
          const durationPerSegment = 4.0; // seconds
          const totalDuration = (path.length - 1) * durationPerSegment;
          const t = videoTimeRef.current % totalDuration;

          const segmentIndex = Math.min(path.length - 2, Math.floor(t / durationPerSegment));
          const p = (t % durationPerSegment) / durationPerSegment;

          const k1 = path[segmentIndex];
          const k2 = path[segmentIndex + 1];

          if (k1 && k2) {
            const currentPos = k1.pos.clone().lerp(k2.pos, p);
            const currentLook = k1.look.clone().lerp(k2.look, p);

            camera.position.copy(currentPos);
            camera.lookAt(currentLook);

            const activeRoomName = k1.roomName;
            if (activeRoomName !== currentRoomNameRef.current) {
              currentRoomNameRef.current = activeRoomName;
              setRoomNameDisplay(activeRoomName);
            }

            if (Math.floor(videoTimeRef.current) !== Math.floor(lastSyncTimeRef.current)) {
              lastSyncTimeRef.current = videoTimeRef.current;
              setVideoTimeDisplay(Math.floor(videoTimeRef.current));
            }
          }
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // 6. Handle resize
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', handleResize);
    };
  }, [rooms, settings, viewMode, activeFloorView]);

  // WASD controls for Walkthrough
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'walkthrough') return;

      const speed = 1.0;
      const rotSpeed = 0.05;

      const keys = e.key.toLowerCase();
      if (keys === 'w' || e.key === 'ArrowUp') {
        walkPos.current.x += Math.sin(walkRotation.current) * speed;
        walkPos.current.z += Math.cos(walkRotation.current) * speed;
      } else if (keys === 's' || e.key === 'ArrowDown') {
        walkPos.current.x -= Math.sin(walkRotation.current) * speed;
        walkPos.current.z -= Math.cos(walkRotation.current) * speed;
      } else if (keys === 'a' || e.key === 'ArrowLeft') {
        walkRotation.current += rotSpeed;
      } else if (keys === 'd' || e.key === 'ArrowRight') {
        walkRotation.current -= rotSpeed;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `00:${m}:${s}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#040811] border border-slate-800 rounded-xl overflow-hidden relative shadow-2xl">
      {/* 3D Viewport Controls */}
      <div className="glass-panel px-4 py-3 flex items-center justify-between border-b border-slate-800 z-10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs text-slate-300 font-mono font-bold">3D VISUALIZATION ENGINE</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Floor selection */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5 text-[10px]">
            <button
              onClick={() => setActiveFloorView('all')}
              className={`px-2 py-0.5 rounded transition ${activeFloorView === 'all' ? 'bg-emerald-500 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              All Floors
            </button>
            <button
              onClick={() => setActiveFloorView('0')}
              className={`px-2 py-0.5 rounded transition ${activeFloorView === '0' ? 'bg-emerald-500 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Ground
            </button>
            <button
              onClick={() => setActiveFloorView('1')}
              className={`px-2 py-0.5 rounded transition ${activeFloorView === '1' ? 'bg-emerald-500 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              First
            </button>
            {settings.floors >= 3 && (
              <button
                onClick={() => setActiveFloorView('2')}
                className={`px-2 py-0.5 rounded transition ${activeFloorView === '2' ? 'bg-emerald-500 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                Second
              </button>
            )}
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5 text-[10px]">
            <button
              onClick={() => {
                setViewMode('orbit');
                if (controlsRef.current) controlsRef.current.enabled = true;
              }}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded transition ${viewMode === 'orbit' ? 'bg-cyan-500 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              <RotateCcw size={10} /> Orbit View
            </button>
            <button
              onClick={() => {
                setViewMode('walkthrough');
                if (controlsRef.current) controlsRef.current.enabled = false;
                walkPos.current = { x: 20, y: 5.5, z: 20 };
                walkRotation.current = 0;
              }}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded transition ${viewMode === 'walkthrough' ? 'bg-cyan-500 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              <Move size={10} /> First-Person Walk
            </button>
            <button
              onClick={() => {
                setViewMode('video');
                if (controlsRef.current) controlsRef.current.enabled = false;
                videoTimeRef.current = 0;
                setVideoTimeDisplay(0);
                setVideoPlaying(true);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded transition ${viewMode === 'video' ? 'bg-red-500 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              <Video size={10} /> Cinematic Tour
            </button>
          </div>
        </div>
      </div>

      {/* Main 3D canvas container */}
      <div ref={containerRef} className="flex-1 w-full h-full relative" />

      {/* Cinematic Walkthrough HUD Overlay */}
      {viewMode === 'video' && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between font-mono">
          {/* Top Cinema Bar */}
          <div className="bg-[#020617] h-[12%] w-full flex items-center justify-between px-6 border-b border-slate-900 pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping absolute"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
              </div>
              <span className="text-[10px] font-bold text-white tracking-widest uppercase">REC</span>
              <span className="text-slate-500">|</span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">{currentRoomName}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-bold tracking-wider">
              {formatTime(videoTimeDisplay)}
            </div>
            <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
              <span>RAW 4K HDR</span>
              <span className="text-red-500 font-black">● LIVE</span>
            </div>
          </div>

          {/* Center Crosshair view */}
          <div className="flex-1 flex items-center justify-center relative opacity-20 pointer-events-none">
            <div className="w-8 h-8 rounded-full border border-white flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
            </div>
            <div className="absolute top-8 left-8 w-6 h-6 border-t-2 border-l-2 border-white"></div>
            <div className="absolute top-8 right-8 w-6 h-6 border-t-2 border-r-2 border-white"></div>
            <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-white"></div>
            <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-white"></div>
          </div>

          {/* Bottom Cinema Bar */}
          <div className="bg-[#020617] h-[12%] w-full flex items-center justify-between px-6 border-t border-slate-900 pointer-events-auto">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVideoPlaying(!videoPlaying)}
                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-[10px] text-white border border-slate-800 rounded font-bold transition cursor-pointer"
              >
                {videoPlaying ? 'PAUSE' : 'PLAY'}
              </button>
              <button
                type="button"
                onClick={() => { videoTimeRef.current = 0; setVideoTimeDisplay(0); }}
                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-[10px] text-white border border-slate-800 rounded font-bold transition cursor-pointer"
              >
                RESTART
              </button>
            </div>

            <div className="text-center">
              <span className="text-[11px] font-bold text-slate-200 uppercase tracking-widest animate-pulse">
                {currentRoomName}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-slate-400">Speed:</span>
              <select
                value={videoSpeed}
                onChange={(e) => setVideoSpeed(parseFloat(e.target.value))}
                className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-white font-mono focus:outline-none"
              >
                <option value="0.5">0.5x</option>
                <option value="1">1.0x (Normal)</option>
                <option value="1.5">1.5x</option>
                <option value="2">2.0x</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setViewMode('orbit');
                  if (controlsRef.current) controlsRef.current.enabled = true;
                }}
                className="ml-4 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-[10px] text-white rounded font-extrabold transition cursor-pointer"
              >
                EXIT TOUR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Helper overlay for First Person Walk */}
      {viewMode === 'walkthrough' && (
        <div className="absolute bottom-4 left-4 z-10 glass-panel p-3 rounded-lg border border-slate-800 text-[10px] text-slate-300 max-w-xs font-mono shadow-xl glow-cyan animate-fade-in">
          <div className="flex items-center gap-2 text-cyan-400 font-bold mb-1">
            <Video size={14} /> WALKTHROUGH MODE ACTIVE
          </div>
          <p className="leading-relaxed mb-2 text-[9px] text-slate-400">
            Use the <strong className="text-white">WASD</strong> keys or <strong className="text-white">Arrow Keys</strong> to walk around and navigate inside the rooms.
          </p>
          <div className="flex justify-center gap-1.5 mt-2">
            <button
              type="button"
              onClick={() => { walkPos.current.x += Math.sin(walkRotation.current) * 2; }}
              className="px-2 py-1 bg-slate-800 hover:bg-cyan-500 rounded hover:text-white transition font-bold"
            >
              ▲ Forward
            </button>
            <button
              type="button"
              onClick={() => { walkRotation.current += 0.3; }}
              className="px-2 py-1 bg-slate-800 hover:bg-cyan-500 rounded hover:text-white transition font-bold"
            >
              ◀ Turn L
            </button>
            <button
              type="button"
              onClick={() => { walkRotation.current -= 0.3; }}
              className="px-2 py-1 bg-slate-800 hover:bg-cyan-500 rounded hover:text-white transition font-bold"
            >
              Turn R ▶
            </button>
            <button
              type="button"
              onClick={() => { walkPos.current.x -= Math.sin(walkRotation.current) * 2; }}
              className="px-2 py-1 bg-slate-800 hover:bg-cyan-500 rounded hover:text-white transition font-bold"
            >
              ▼ Backward
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
