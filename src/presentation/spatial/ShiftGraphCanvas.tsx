import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ShiftGraphSceneModel } from '../types/sceneTypes';
import {
  DEFAULT_CAMERA_POS,
  DEFAULT_LOOK_AT,
  computeTargetCameraPosition,
  type CameraPreset,
} from './camera/CameraController';

export interface OverlaysState {
  baseline: boolean;
  context: boolean;
  resources: boolean;
  devices: boolean;
  labels: boolean;
}

interface ShiftGraphCanvasProps {
  readonly scene: ShiftGraphSceneModel;
  readonly selectedObservationId: string | null;
  readonly focusedEntityId: string | null;
  readonly cameraPreset: CameraPreset;
  readonly overlays: OverlaysState;
  readonly onSelectObservation: (id: string) => void;
  readonly onSelectEntity: (id: string) => void;
  readonly reducedMotion?: boolean;
}

interface ProjectedTag {
  id: string;
  label: string;
  subLabel: string;
  type: 'selected-actor' | 'resource' | 'device' | 'context';
  x: number;
  y: number;
  visible: boolean;
}

const isWebGLAvailable = (): boolean => {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    );
  } catch {
    return false;
  }
};

export function ShiftGraphCanvas({
  scene,
  selectedObservationId,
  focusedEntityId,
  cameraPreset,
  overlays,
  onSelectObservation,
  onSelectEntity,
  reducedMotion = false,
}: ShiftGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);
  const [hoveredItem, setHoveredItem] = useState<{
    type: string;
    id: string;
    screenX: number;
    screenY: number;
    data: any;
  } | null>(null);

  const [projectedTags, setProjectedTags] = useState<ProjectedTag[]>([]);

  // Three.js instance state ref
  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    raycaster: THREE.Raycaster;
    mouse: THREE.Vector2;
    interactiveMeshes: THREE.Mesh[];
    dynamicGroup: THREE.Group;
    targetCameraPos: THREE.Vector3;
    targetLookAt: THREE.Vector3;
    animFrameId: number | null;
    width: number;
    height: number;
    haloMesh: THREE.Mesh | null;
    focalPointLight: THREE.PointLight | null;
  } | null>(null);

  useEffect(() => {
    setWebglSupported(isWebGLAvailable());
  }, []);

  // Smooth camera position tracking based on preset and selected observation
  useEffect(() => {
    if (!threeRef.current) return;
    const { targetCameraPos, targetLookAt, camera, controls } = threeRef.current;
    const selectedObs = scene.observations.find((o) => o.id === selectedObservationId);
    const targetPos = selectedObs?.position;

    const targets = computeTargetCameraPosition(cameraPreset, targetPos);
    targetCameraPos.copy(targets.pos);
    targetLookAt.copy(targets.lookAt);

    if (reducedMotion) {
      camera.position.copy(targetCameraPos);
      controls.target.copy(targetLookAt);
      controls.update();
    }
  }, [cameraPreset, selectedObservationId, scene.observations, reducedMotion]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!webglSupported || !containerRef.current || !canvasRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    const width = container.clientWidth || 1200;
    const height = container.clientHeight || 800;

    // 1. Renderer: high precision, deep graphite foundation
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x070b12, 1.0);

    // 2. Scene with deep atmospheric perspective
    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x070b12);
    threeScene.fog = new THREE.FogExp2(0x070b12, 0.022);

    // 3. Immersive Camera (45 deg FOV, inside the analytical environment)
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.copy(DEFAULT_CAMERA_POS);

    // 4. OrbitControls with smooth damping
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 4;
    controls.maxDistance = 35;
    controls.minPolarAngle = Math.PI / 6;
    controls.maxPolarAngle = Math.PI / 2 + 0.04;
    controls.target.copy(DEFAULT_LOOK_AT);
    controls.update();

    // 5. Lighting: deliberate luminous hierarchy
    const ambientLight = new THREE.AmbientLight(0x1e293b, 0.35);
    threeScene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xf8fafc, 1.1);
    keyLight.position.set(12, 18, 16);
    threeScene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x0284c7, 0.6);
    rimLight.position.set(-14, -6, -10);
    threeScene.add(rimLight);

    // Local warm amber light near resources
    const fillWarm = new THREE.PointLight(0xf59e0b, 0.65, 25);
    fillWarm.position.set(6.5, 2.0, 3.5);
    threeScene.add(fillWarm);

    // Local violet light near devices
    const fillViolet = new THREE.PointLight(0x8b5cf6, 0.55, 25);
    fillViolet.position.set(7.5, -0.5, -2.5);
    threeScene.add(fillViolet);

    // Dynamic focal point light at selected observation
    const focalPointLight = new THREE.PointLight(0x38bdf8, 1.3, 16);
    focalPointLight.position.set(0, 1.5, 0);
    threeScene.add(focalPointLight);

    // Dynamic objects group
    const dynamicGroup = new THREE.Group();
    threeScene.add(dynamicGroup);

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 0.25 };
    const mouse = new THREE.Vector2(-999, -999);

    const targetCameraPos = DEFAULT_CAMERA_POS.clone();
    const targetLookAt = DEFAULT_LOOK_AT.clone();

    threeRef.current = {
      renderer,
      scene: threeScene,
      camera,
      controls,
      raycaster,
      mouse,
      interactiveMeshes: [],
      dynamicGroup,
      targetCameraPos,
      targetLookAt,
      animFrameId: null,
      width,
      height,
      haloMesh: null,
      focalPointLight,
    };

    // Render loop
    let lastTime = performance.now();
    const tempVec = new THREE.Vector3();

    const animate = () => {
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (!reducedMotion) {
        const lerpFactor = Math.min(1.0, delta * 3.8);
        camera.position.lerp(targetCameraPos, lerpFactor);
        controls.target.lerp(targetLookAt, lerpFactor);
      }

      // Orient halo ring toward camera
      if (threeRef.current?.haloMesh) {
        threeRef.current.haloMesh.quaternion.copy(camera.quaternion);
      }

      controls.update();
      renderer.render(threeScene, camera);

      // Compute 2D projected tag positions for screen HUD callouts
      if (threeRef.current && overlays.labels) {
        const currentWidth = threeRef.current.width;
        const currentHeight = threeRef.current.height;
        const tags: ProjectedTag[] = [];

        // 1. Tag for Selected Observation Actor
        const selectedObs = scene.observations.find((o) => o.id === selectedObservationId);
        if (selectedObs) {
          tempVec.set(selectedObs.position[0], selectedObs.position[1] + 0.55, selectedObs.position[2]);
          tempVec.project(camera);
          if (tempVec.z <= 1) {
            tags.push({
              id: selectedObs.id,
              label: selectedObs.id,
              subLabel: 'ACTOR',
              type: 'selected-actor',
              x: (tempVec.x * 0.5 + 0.5) * currentWidth,
              y: (-(tempVec.y * 0.5) + 0.5) * currentHeight,
              visible: true,
            });
          }
        }

        // 2. Tags for Primary Resource
        if (overlays.resources) {
          for (const res of scene.resources) {
            const isConnected = selectedObs && selectedObs.resourceIds.includes(res.id);
            const isFocused = focusedEntityId === res.id;
            if (isConnected || isFocused || res.id === 'RES-CUST-DB-01') {
              tempVec.set(res.position[0], res.position[1] + 0.48, res.position[2]);
              tempVec.project(camera);
              if (tempVec.z <= 1) {
                tags.push({
                  id: res.id,
                  label: res.displayName,
                  subLabel: 'RESOURCE',
                  type: 'resource',
                  x: (tempVec.x * 0.5 + 0.5) * currentWidth,
                  y: (-(tempVec.y * 0.5) + 0.5) * currentHeight,
                  visible: true,
                });
              }
            }
          }
        }

        // 3. Tags for Device
        if (overlays.devices) {
          for (const dev of scene.devices) {
            const isConnected = selectedObs && selectedObs.deviceIds.includes(dev.id);
            const isFocused = focusedEntityId === dev.id;
            if (isConnected || isFocused || dev.id === 'DEV-LINUX-WS01') {
              tempVec.set(dev.position[0], dev.position[1] + 0.48, dev.position[2]);
              tempVec.project(camera);
              if (tempVec.z <= 1) {
                tags.push({
                  id: dev.id,
                  label: dev.displayName,
                  subLabel: 'DEVICE',
                  type: 'device',
                  x: (tempVec.x * 0.5 + 0.5) * currentWidth,
                  y: (-(tempVec.y * 0.5) + 0.5) * currentHeight,
                  visible: true,
                });
              }
            }
          }
        }

        // 4. Tag for Context Grant
        if (overlays.context && scene.contexts.length > 0) {
          const ctx = scene.contexts[0];
          const xMid = (ctx.xStart + ctx.xEnd) / 2;
          tempVec.set(xMid, ctx.yMax + 0.4, ctx.zCenter);
          tempVec.project(camera);
          if (tempVec.z <= 1) {
            tags.push({
              id: ctx.grantId,
              label: ctx.rationale,
              subLabel: 'CONTEXT GRANT',
              type: 'context',
              x: (tempVec.x * 0.5 + 0.5) * currentWidth,
              y: (-(tempVec.y * 0.5) + 0.5) * currentHeight,
              visible: true,
            });
          }
        }

        setProjectedTags(tags);
      } else {
        setProjectedTags([]);
      }

      if (threeRef.current) {
        threeRef.current.animFrameId = requestAnimationFrame(animate);
      }
    };

    threeRef.current.animFrameId = requestAnimationFrame(animate);

    // Dynamic resize handler using ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        const h = Math.floor(entry.contentRect.height);
        if (w > 0 && h > 0 && threeRef.current) {
          threeRef.current.width = w;
          threeRef.current.height = h;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (threeRef.current?.animFrameId) {
        cancelAnimationFrame(threeRef.current.animFrameId);
      }
      controls.dispose();
      renderer.dispose();
      threeRef.current = null;
    };
  }, [webglSupported, reducedMotion, scene, selectedObservationId, focusedEntityId, overlays]);

  // Rebuild 3D spatial scene objects when scene, selection, or overlays change
  useEffect(() => {
    if (!threeRef.current) return;
    const { dynamicGroup, focalPointLight } = threeRef.current;

    // Clean previous objects
    while (dynamicGroup.children.length > 0) {
      const child = dynamicGroup.children[0] as any;
      dynamicGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m: any) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }

    const interactiveMeshes: THREE.Mesh[] = [];
    const { xStart, xEnd } = scene.baseline;

    // =========================================================================
    // 1. ANALYTICAL BACKGROUND (Sparse 3D coordinate field, NO chart scaffolding)
    // =========================================================================
    const floorY = -3.2;

    // Subtle curved flow isolines in the deep distance / floor (evoking atmospheric flow)
    const isolinesCount = 5;
    for (let j = 0; j < isolinesCount; j++) {
      const radius = 18 + j * 4;
      const arcPoints: THREE.Vector3[] = [];
      const segments = 48;
      for (let s = 0; s <= segments; s++) {
        const angle = (s / segments - 0.5) * Math.PI * 0.75;
        const x = Math.sin(angle) * radius * 0.85;
        const z = -Math.cos(angle) * radius * 0.45 + (j - 2) * 2.5;
        arcPoints.push(new THREE.Vector3(x, floorY, z));
      }
      const arcGeom = new THREE.BufferGeometry().setFromPoints(arcPoints);
      const arcMat = new THREE.LineBasicMaterial({
        color: 0x111c2e,
        transparent: true,
        opacity: 0.28 - j * 0.04,
      });
      dynamicGroup.add(new THREE.Line(arcGeom, arcMat));
    }

    // Discrete coordinate tick crosses (+) at ground intersections
    const crossPoints: number[] = [];
    const crossSize = 0.14;
    for (let x = -15; x <= 15; x += 3.5) {
      for (let z = -10; z <= 10; z += 3.5) {
        crossPoints.push(x - crossSize, floorY, z, x + crossSize, floorY, z);
        crossPoints.push(x, floorY, z - crossSize, x, floorY, z + crossSize);
      }
    }
    const crossGeom = new THREE.BufferGeometry();
    crossGeom.setAttribute('position', new THREE.Float32BufferAttribute(crossPoints, 3));
    const crossMat = new THREE.LineBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.28,
    });
    dynamicGroup.add(new THREE.LineSegments(crossGeom, crossMat));

    // Distant sheer vertical temporal slice guides
    const temporalSlicePoints: number[] = [];
    for (let x = -10; x <= 10; x += 5.0) {
      temporalSlicePoints.push(x, floorY, -6, x, 3.5, -6);
    }
    const temporalSliceGeom = new THREE.BufferGeometry();
    temporalSliceGeom.setAttribute('position', new THREE.Float32BufferAttribute(temporalSlicePoints, 3));
    const temporalSliceMat = new THREE.LineBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.16,
    });
    dynamicGroup.add(new THREE.LineSegments(temporalSliceGeom, temporalSliceMat));

    // Foreground Frosted Glass Cube (creating immediate foreground perspective depth)
    const glassCubeGeom = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    const glassCubeMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.12,
      roughness: 0.15,
      metalness: 0.1,
      transmission: 0.8,
      ior: 1.4,
    });
    const glassCube = new THREE.Mesh(glassCubeGeom, glassCubeMat);
    glassCube.position.set(-6.5, -0.6, 2.8);
    glassCube.rotation.set(0.3, 0.5, 0.2);
    dynamicGroup.add(glassCube);

    const glassEdges = new THREE.EdgesGeometry(glassCubeGeom);
    const glassEdgesMat = new THREE.LineBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.45,
    });
    const glassEdgesLine = new THREE.LineSegments(glassEdges, glassEdgesMat);
    glassCube.add(glassEdgesLine);

    // =========================================================================
    // 2. BEHAVIORAL TRAJECTORY (Multi-filament analytical path through space)
    // =========================================================================
    if (scene.trajectory.points.length >= 2) {
      const vPoints = scene.trajectory.points.map(
        (p) => new THREE.Vector3(p[0], p[1], p[2]),
      );
      const spline = new THREE.CatmullRomCurve3(vPoints, false, 'centripetal', 0.45);
      const sampleCount = Math.max(140, vPoints.length * 24);
      const splinePoints = spline.getPoints(sampleCount);

      // Primary Luminous Filament (Thin, crisp, 1-3px visual line)
      const primaryGeom = new THREE.BufferGeometry().setFromPoints(splinePoints);
      const primaryMat = new THREE.LineBasicMaterial({
        color: 0xf8fafc,
        linewidth: 2,
        transparent: true,
        opacity: 0.95,
      });
      dynamicGroup.add(new THREE.Line(primaryGeom, primaryMat));

      // Electric Cyan Core Glow Line
      const cyanCoreMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.75,
      });
      dynamicGroup.add(new THREE.Line(primaryGeom, cyanCoreMat));

      // Secondary Filament Strands (Weaving gently along the path)
      const strand1Points: THREE.Vector3[] = [];
      const strand2Points: THREE.Vector3[] = [];
      for (let i = 0; i <= sampleCount; i++) {
        const pt = splinePoints[i];
        const t = i / sampleCount;
        const wave1 = Math.sin(t * Math.PI * 6.5) * 0.07;
        const wave2 = Math.cos(t * Math.PI * 5.0) * 0.06;
        strand1Points.push(new THREE.Vector3(pt.x, pt.y + wave1, pt.z - 0.14));
        strand2Points.push(new THREE.Vector3(pt.x, pt.y - wave2, pt.z + 0.12));
      }
      const strand1Geom = new THREE.BufferGeometry().setFromPoints(strand1Points);
      const strand1Mat = new THREE.LineBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.4,
      });
      dynamicGroup.add(new THREE.Line(strand1Geom, strand1Mat));

      const strand2Geom = new THREE.BufferGeometry().setFromPoints(strand2Points);
      const strand2Mat = new THREE.LineBasicMaterial({
        color: 0x6366f1,
        transparent: true,
        opacity: 0.3,
      });
      dynamicGroup.add(new THREE.Line(strand2Geom, strand2Mat));

      // =======================================================================
      // 3. BASELINE CORRIDOR (Local flowing reference ribbon along the path)
      // =======================================================================
      if (overlays.baseline && scene.baseline.available) {
        const { madUpperY, madLowerY, rawMedian } = scene.baseline;
        const ribbonVerts: number[] = [];
        const upperContourPoints: THREE.Vector3[] = [];
        const lowerContourPoints: THREE.Vector3[] = [];
        const medianContourPoints: THREE.Vector3[] = [];
        const ribPoints: number[] = [];

        for (let i = 0; i <= sampleCount; i++) {
          const pt = splinePoints[i];
          const t = i / sampleCount;
          // Interpolate local reference envelope following the trajectory flow
          const localMedianY = (rawMedian ?? 0) * 0.35;
          const deltaY = (madUpperY - madLowerY) * 0.5;
          const upY = pt.y + (localMedianY - pt.y) * 0.35 + deltaY;
          const lowY = pt.y + (localMedianY - pt.y) * 0.35 - deltaY;
          const midY = (upY + lowY) / 2;

          upperContourPoints.push(new THREE.Vector3(pt.x, upY, pt.z));
          lowerContourPoints.push(new THREE.Vector3(pt.x, lowY, pt.z));
          medianContourPoints.push(new THREE.Vector3(pt.x, midY, pt.z));

          // Transverse volumetric ribs
          if (i % 12 === 0) {
            ribPoints.push(pt.x, lowY, pt.z, pt.x, upY, pt.z);
          }

          if (i < sampleCount) {
            const nextPt = splinePoints[i + 1];
            const nextUpY = nextPt.y + (localMedianY - nextPt.y) * 0.35 + deltaY;
            const nextLowY = nextPt.y + (localMedianY - nextPt.y) * 0.35 - deltaY;

            ribbonVerts.push(
              pt.x, upY, pt.z,
              nextPt.x, nextUpY, nextPt.z,
              pt.x, lowY, pt.z,

              pt.x, lowY, pt.z,
              nextPt.x, nextUpY, nextPt.z,
              nextPt.x, nextLowY, nextPt.z,
            );
          }
        }

        // Translucent flowing reference ribbon surface
        const ribbonGeom = new THREE.BufferGeometry();
        ribbonGeom.setAttribute('position', new THREE.Float32BufferAttribute(ribbonVerts, 3));
        const ribbonMat = new THREE.MeshBasicMaterial({
          color: 0x1e1b4b,
          transparent: true,
          opacity: 0.08,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        dynamicGroup.add(new THREE.Mesh(ribbonGeom, ribbonMat));

        // Upper & Lower fine contour strands
        const upGeom = new THREE.BufferGeometry().setFromPoints(upperContourPoints);
        const upMat = new THREE.LineBasicMaterial({
          color: 0x6366f1,
          transparent: true,
          opacity: 0.45,
        });
        dynamicGroup.add(new THREE.Line(upGeom, upMat));

        const lowGeom = new THREE.BufferGeometry().setFromPoints(lowerContourPoints);
        const lowMat = new THREE.LineBasicMaterial({
          color: 0x4f46e5,
          transparent: true,
          opacity: 0.4,
        });
        dynamicGroup.add(new THREE.Line(lowGeom, lowMat));

        const midGeom = new THREE.BufferGeometry().setFromPoints(medianContourPoints);
        const midMat = new THREE.LineBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.3,
        });
        dynamicGroup.add(new THREE.Line(midGeom, midMat));

        // Transverse rib lines
        const ribGeom = new THREE.BufferGeometry();
        ribGeom.setAttribute('position', new THREE.Float32BufferAttribute(ribPoints, 3));
        const ribMat = new THREE.LineBasicMaterial({
          color: 0x4338ca,
          transparent: true,
          opacity: 0.22,
        });
        dynamicGroup.add(new THREE.LineSegments(ribGeom, ribMat));
      }
    }

    // =========================================================================
    // 4. CONTEXT FIELD (Translucent tilted cyan veil / holographic envelope)
    // =========================================================================
    if (overlays.context) {
      for (const ctx of scene.contexts) {
        const xStartCtx = ctx.xStart;
        const xEndCtx = ctx.xEnd;
        const yMinCtx = ctx.yMin;
        const yMaxCtx = ctx.yMax;
        const zCtx = ctx.zCenter;

        // Curved / tilted 3D planar veil intersecting the relevant temporal span
        const segmentsX = 20;
        const segmentsY = 10;
        const veilVerts: number[] = [];
        const veilLines: number[] = [];

        for (let ix = 0; ix < segmentsX; ix++) {
          for (let iy = 0; iy < segmentsY; iy++) {
            const u1 = ix / segmentsX;
            const u2 = (ix + 1) / segmentsX;
            const v1 = iy / segmentsY;
            const v2 = (iy + 1) / segmentsY;

            const x1 = xStartCtx + (xEndCtx - xStartCtx) * u1;
            const x2 = xStartCtx + (xEndCtx - xStartCtx) * u2;
            const y1 = yMinCtx + (yMaxCtx - yMinCtx) * v1;
            const y2 = yMinCtx + (yMaxCtx - yMinCtx) * v2;

            // Subtle depth tilt and curvature
            const z1 = zCtx + (u1 - 0.5) * 0.8 + Math.sin(v1 * Math.PI) * 0.25;
            const z2 = zCtx + (u2 - 0.5) * 0.8 + Math.sin(v1 * Math.PI) * 0.25;
            const z3 = zCtx + (u1 - 0.5) * 0.8 + Math.sin(v2 * Math.PI) * 0.25;
            const z4 = zCtx + (u2 - 0.5) * 0.8 + Math.sin(v2 * Math.PI) * 0.25;

            // Two triangles
            veilVerts.push(
              x1, y1, z1,  x2, y1, z2,  x1, y2, z3,
              x1, y2, z3,  x2, y1, z2,  x2, y2, z4,
            );

            // Internal etched grid
            if (iy === 0 || iy === Math.floor(segmentsY / 2) || iy === segmentsY - 1) {
              veilLines.push(x1, y1, z1, x2, y1, z2);
            }
            if (ix === 0 || ix === Math.floor(segmentsX / 2) || ix === segmentsX - 1) {
              veilLines.push(x1, y1, z1, x1, y2, z3);
            }
          }
        }

        const veilGeom = new THREE.BufferGeometry();
        veilGeom.setAttribute('position', new THREE.Float32BufferAttribute(veilVerts, 3));
        const veilMat = new THREE.MeshBasicMaterial({
          color: 0x06b6d4,
          transparent: true,
          opacity: 0.08,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        dynamicGroup.add(new THREE.Mesh(veilGeom, veilMat));

        // Precision cyan boundary & etched lines
        const lineGeom = new THREE.BufferGeometry();
        lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(veilLines, 3));
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x22d3ee,
          transparent: true,
          opacity: 0.5,
        });
        dynamicGroup.add(new THREE.LineSegments(lineGeom, lineMat));
      }
    }

    // =========================================================================
    // 5. OBSERVATIONS & EVIDENCE TOPOLOGY
    // =========================================================================
    for (const obs of scene.observations) {
      const isSelected = obs.id === selectedObservationId;
      const isDimmed = Boolean(selectedObservationId) && !isSelected;

      let radius = 0.09;
      let colorHex = 0x0f172a;
      let emissiveHex = 0x0ea5e9;
      let emissiveIntensity = 0.4;

      if (isSelected) {
        radius = 0.25;
        colorHex = 0xffffff;
        emissiveHex = 0x38bdf8;
        emissiveIntensity = 1.4;

        if (focalPointLight) {
          focalPointLight.position.set(obs.position[0], obs.position[1], obs.position[2]);
        }
      } else if (obs.presentationDeviation > 2.5) {
        radius = 0.13;
        colorHex = 0x7c2d12;
        emissiveHex = 0xf59e0b;
        emissiveIntensity = 0.8;
      }

      const sphereGeom = new THREE.SphereGeometry(radius, 24, 24);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: emissiveHex,
        emissiveIntensity,
        roughness: isSelected ? 0.05 : 0.3,
        metalness: 0.75,
        transparent: isDimmed,
        opacity: isDimmed ? 0.35 : 1.0,
      });

      const sphereMesh = new THREE.Mesh(sphereGeom, sphereMat);
      sphereMesh.position.set(obs.position[0], obs.position[1], obs.position[2]);
      sphereMesh.userData = { type: 'observation', id: obs.id, data: obs };
      dynamicGroup.add(sphereMesh);
      interactiveMeshes.push(sphereMesh);

      // Selected Observation Focal Hero Rings & Crosshair Ticks
      if (isSelected) {
        // Inner glowing halo ring
        const ringGeom = new THREE.RingGeometry(0.38, 0.5, 36);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.position.set(obs.position[0], obs.position[1], obs.position[2]);
        dynamicGroup.add(ringMesh);

        // Outer fine orbital ring with 4 precision crosshair ticks
        const outerRingGeom = new THREE.RingGeometry(0.72, 0.76, 48);
        const outerRingMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
        });
        const outerRingMesh = new THREE.Mesh(outerRingGeom, outerRingMat);
        outerRingMesh.position.set(obs.position[0], obs.position[1], obs.position[2]);
        dynamicGroup.add(outerRingMesh);

        const tickLen = 0.12;
        const tickPoints: number[] = [
          0.76, 0, 0, 0.76 + tickLen, 0, 0,
          -0.76, 0, 0, -(0.76 + tickLen), 0, 0,
          0, 0.76, 0, 0, 0.76 + tickLen, 0,
          0, -0.76, 0, 0, -(0.76 + tickLen), 0,
        ];
        const tickGeom = new THREE.BufferGeometry();
        tickGeom.setAttribute('position', new THREE.Float32BufferAttribute(tickPoints, 3));
        const tickMat = new THREE.LineBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.8,
        });
        const tickLines = new THREE.LineSegments(tickGeom, tickMat);
        tickLines.position.set(obs.position[0], obs.position[1], obs.position[2]);
        dynamicGroup.add(tickLines);

        if (threeRef.current) {
          threeRef.current.haloMesh = ringMesh;
        }
      }
    }

    // =========================================================================
    // 6. RESOURCE ANCHORS (Warm Amber Polyhedrons + Rings)
    // =========================================================================
    if (overlays.resources) {
      for (const res of scene.resources) {
        const isFocused = res.id === focusedEntityId;
        const isPrimary = res.id === 'RES-CUST-DB-01';
        const resGroup = new THREE.Group();
        resGroup.position.set(res.position[0], res.position[1], res.position[2]);

        // Faceted icosahedron core
        const coreSize = isPrimary ? 0.22 : 0.14;
        const coreGeom = new THREE.IcosahedronGeometry(coreSize, 0);
        const coreMat = new THREE.MeshStandardMaterial({
          color: 0xd97706,
          emissive: 0xf59e0b,
          emissiveIntensity: isFocused || isPrimary ? 0.95 : 0.6,
          roughness: 0.15,
          metalness: 0.85,
        });
        const coreMesh = new THREE.Mesh(coreGeom, coreMat);
        coreMesh.userData = { type: 'resource', id: res.id, data: res };
        resGroup.add(coreMesh);
        interactiveMeshes.push(coreMesh);

        // Outer orbital ring
        const ringRadius = isPrimary ? 0.38 : 0.25;
        const ringGeom = new THREE.RingGeometry(ringRadius, ringRadius + 0.03, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: isPrimary ? 0.75 : 0.45,
          side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        resGroup.add(ringMesh);

        dynamicGroup.add(resGroup);
      }
    }

    // =========================================================================
    // 7. DEVICE ANCHORS (Violet Crystalline Prisms)
    // =========================================================================
    if (overlays.devices) {
      for (const dev of scene.devices) {
        const isFocused = dev.id === focusedEntityId;
        const devGroup = new THREE.Group();
        devGroup.position.set(dev.position[0], dev.position[1], dev.position[2]);

        // Dimensional beveled cube core
        const coreGeom = new THREE.BoxGeometry(0.22, 0.22, 0.22);
        const coreMat = new THREE.MeshStandardMaterial({
          color: 0x7c3aed,
          emissive: 0x8b5cf6,
          emissiveIntensity: isFocused ? 0.95 : 0.65,
          roughness: 0.2,
          metalness: 0.8,
        });
        const coreMesh = new THREE.Mesh(coreGeom, coreMat);
        coreMesh.userData = { type: 'device', id: dev.id, data: dev };
        devGroup.add(coreMesh);
        interactiveMeshes.push(coreMesh);

        // Edge highlights
        const edgeGeom = new THREE.EdgesGeometry(coreGeom);
        const edgeMat = new THREE.LineBasicMaterial({
          color: 0xc084fc,
          transparent: true,
          opacity: 0.75,
        });
        const edgeLines = new THREE.LineSegments(edgeGeom, edgeMat);
        devGroup.add(edgeLines);

        // Outer orbital ring
        const ringGeom = new THREE.RingGeometry(0.36, 0.39, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xa855f7,
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        devGroup.add(ringMesh);

        dynamicGroup.add(devGroup);
      }
    }

    // =========================================================================
    // 8. EVIDENCE FILAMENTS & SUBORDINATE CONTRIBUTING EVENTS
    // =========================================================================
    if (overlays.resources || overlays.devices) {
      for (const conn of scene.connections) {
        if (
          (!overlays.resources && conn.connectionType === 'OBSERVATION_TO_RESOURCE') ||
          (!overlays.devices && conn.connectionType === 'OBSERVATION_TO_DEVICE')
        ) {
          continue;
        }

        const isHighlighted =
          selectedObservationId === conn.sourceId || focusedEntityId === conn.targetId;
        const isResource = conn.connectionType === 'OBSERVATION_TO_RESOURCE';
        const color = isResource ? 0xf59e0b : 0x8b5cf6;

        // Curved arc filament between source observation and target entity
        const p1 = new THREE.Vector3(...conn.sourcePosition);
        const p2 = new THREE.Vector3(...conn.targetPosition);
        const midPoint = new THREE.Vector3()
          .addVectors(p1, p2)
          .multiplyScalar(0.5)
          .add(new THREE.Vector3(0, 0.4, (isResource ? 0.3 : -0.3)));

        const curve = new THREE.QuadraticBezierCurve3(p1, midPoint, p2);
        const curvePoints = curve.getPoints(24);
        const connGeom = new THREE.BufferGeometry().setFromPoints(curvePoints);

        if (isHighlighted) {
          const connMat = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0.88,
          });
          dynamicGroup.add(new THREE.Line(connGeom, connMat));

          // Subordinate Contributing Event Beads along the connection arc
          const obs = scene.observations.find((o) => o.id === conn.sourceId);
          const eventCount = obs?.contributingEventIds.length || 2;
          for (let e = 1; e <= eventCount; e++) {
            const t = e / (eventCount + 1);
            const beadPos = curve.getPoint(t);
            const beadGeom = new THREE.SphereGeometry(0.045, 12, 12);
            const beadMat = new THREE.MeshStandardMaterial({
              color: isResource ? 0xfde68a : 0xe9d5ff,
              emissive: color,
              emissiveIntensity: 0.9,
            });
            const beadMesh = new THREE.Mesh(beadGeom, beadMat);
            beadMesh.position.copy(beadPos);
            dynamicGroup.add(beadMesh);
          }
        } else {
          const connMat = new THREE.LineDashedMaterial({
            color,
            dashSize: 0.3,
            gapSize: 0.25,
            transparent: true,
            opacity: 0.16,
          });
          const connLine = new THREE.Line(connGeom, connMat);
          connLine.computeLineDistances();
          dynamicGroup.add(connLine);
        }
      }
    }

    threeRef.current.interactiveMeshes = interactiveMeshes;
  }, [scene, selectedObservationId, focusedEntityId, overlays]);

  // Pointer move & click handlers
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!threeRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const { raycaster, camera, interactiveMeshes } = threeRef.current;
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    const intersects = raycaster.intersectObjects(interactiveMeshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const itemData = hit.userData;
      canvasRef.current.style.cursor = 'pointer';
      setHoveredItem({
        type: itemData.type,
        id: itemData.id,
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
        data: itemData.data,
      });
    } else {
      canvasRef.current.style.cursor = 'default';
      setHoveredItem(null);
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (canvasRef.current) canvasRef.current.style.cursor = 'default';
    setHoveredItem(null);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!threeRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const { raycaster, camera, interactiveMeshes } = threeRef.current;
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    const intersects = raycaster.intersectObjects(interactiveMeshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const { type, id } = hit.userData;
      if (type === 'observation') {
        onSelectObservation(id);
      } else if (type === 'resource' || type === 'device') {
        onSelectEntity(id);
      }
    }
  }, [onSelectObservation, onSelectEntity]);

  if (!webglSupported) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#070b12] text-slate-400 p-8 text-center">
        <div className="text-amber-400 font-mono text-sm font-semibold mb-2">
          WEBGL ACCELERATION UNAVAILABLE
        </div>
        <p className="text-xs text-slate-400 max-w-md">
          Spatial forensics canvas requires WebGL. Evidence inspector and timeline remain operational.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full absolute inset-0 select-none bg-[#070b12] overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
        className="w-full h-full block"
      />

      {/* Floating Projected HUD Callout Tags in 3D Space */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {projectedTags.map((tag) => (
          <div
            key={tag.id}
            style={{
              transform: `translate(-50%, -100%) translate(${tag.x}px, ${tag.y}px)`,
            }}
            className="absolute transition-transform duration-75"
          >
            {tag.type === 'selected-actor' && (
              <div className="flex flex-col items-center gap-0.5 animate-fadeIn">
                <span className="text-[9px] font-sans font-semibold tracking-wider text-sky-400 uppercase flex items-center gap-1">
                  <span>◆</span> {tag.subLabel}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#070b12]/90 border border-sky-400/60 text-white shadow-[0_0_15px_rgba(56,189,248,0.4)]">
                  {tag.label}
                </span>
              </div>
            )}

            {tag.type === 'resource' && (
              <div className="flex flex-col items-center gap-0.5 animate-fadeIn">
                <span className="text-[8px] font-sans font-semibold tracking-wider text-amber-400 uppercase flex items-center gap-1">
                  <span>●</span> {tag.subLabel}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#070b12]/90 border border-amber-500/40 text-amber-300 shadow-md">
                  {tag.label}
                </span>
              </div>
            )}

            {tag.type === 'device' && (
              <div className="flex flex-col items-center gap-0.5 animate-fadeIn">
                <span className="text-[8px] font-sans font-semibold tracking-wider text-purple-400 uppercase flex items-center gap-1">
                  <span>●</span> {tag.subLabel}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#070b12]/90 border border-purple-500/40 text-purple-300 shadow-md">
                  {tag.label}
                </span>
              </div>
            )}

            {tag.type === 'context' && (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] font-sans font-bold tracking-wider text-cyan-400 uppercase">
                  {tag.subLabel}
                </span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-sans text-cyan-200 bg-[#070b12]/85 border border-cyan-500/30">
                  {tag.label} (Oct 10 – Oct 14)
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Minimalist Scene Spatial Legend */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-10">
        <div className="flex items-center gap-4 px-3.5 py-1.5 rounded-full bg-[#070b12]/85 border border-white/10 backdrop-blur-md text-[11px] font-sans text-slate-300 shadow-xl">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span>Observations</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="text-slate-500 text-xs">◇</span>
            <span>Change Point (N/A)</span>
          </div>
          <div className="flex items-center gap-1.5 text-cyan-300">
            <span className="w-2 h-2 rounded-sm border border-cyan-400 bg-cyan-500/20" />
            <span>Context</span>
          </div>
          <div className="flex items-center gap-1.5 text-white">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-white bg-sky-400" />
            <span>Selected</span>
          </div>
        </div>
      </div>

      {/* Interactive Tooltip on Hover */}
      {hoveredItem && (
        <div
          style={{
            position: 'absolute',
            left: `${hoveredItem.screenX}px`,
            top: `${hoveredItem.screenY - 14}px`,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
          }}
          className="z-50 px-3.5 py-2.5 rounded-xl bg-[#0b111a]/95 border border-white/20 text-[11px] text-slate-200 shadow-2xl backdrop-blur-md whitespace-nowrap animate-fadeIn"
        >
          {hoveredItem.type === 'observation' && (
            <div>
              <div className="font-semibold text-sky-400 mb-1 flex items-center justify-between gap-4 font-mono">
                <span>{hoveredItem.id}</span>
                <span className="text-slate-400 text-[10px]">
                  {hoveredItem.data.timestamp.slice(11, 16)} UTC
                </span>
              </div>
              <div className="text-slate-300 flex items-center gap-2 font-mono">
                <span className="text-slate-400 font-sans">Feature:</span>
                <span className="text-white font-bold">{hoveredItem.data.featureValue}</span>
                {hoveredItem.data.isBaselineAvailable ? (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400 font-sans">Dev:</span>
                    <span
                      className={`font-bold ${
                        hoveredItem.data.presentationDeviation > 2.5
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {hoveredItem.data.presentationDeviation.toFixed(2)}σ
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400 font-sans">(insufficient baseline)</span>
                )}
              </div>
            </div>
          )}

          {hoveredItem.type === 'resource' && (
            <div>
              <div className="font-semibold text-amber-400 mb-0.5 font-mono">
                {hoveredItem.data.displayName}
              </div>
              <div className="text-[10px] text-slate-400 font-sans">
                Type: {hoveredItem.data.resourceType} · Category: {hoveredItem.data.category}
              </div>
            </div>
          )}

          {hoveredItem.type === 'device' && (
            <div>
              <div className="font-semibold text-purple-400 mb-0.5 font-mono">
                {hoveredItem.data.displayName}
              </div>
              <div className="text-[10px] text-slate-400 font-sans">
                Device ID: {hoveredItem.id}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
