import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { SVGRenderer } from 'three/examples/jsm/renderers/SVGRenderer.js';
import { CHART_FOCUS, chartHaloOpacity } from '../services/chartFocusVisuals';
import { bindTorusTouch, getTorusZoomDistance } from '../services/torusGestures';
import { placeChartCallout } from './chartCalloutPlacement';
import { NatalChartResult, ZODIAC_SIGNS } from '../services/ephemeris';
import { beginInteractionEpisode, chartAnalyticsTarget, trackInteraction } from '../services/interactionAnalytics';

type AstrolabeRenderer = THREE.WebGLRenderer | SVGRenderer;

const hideTier3Sprites = (scene: THREE.Scene) => {
  scene.traverse(object => {
    if ((object as THREE.Sprite).isSprite) object.visible = false;
  });
};

const createAstrolabeRenderer = (forceSoftware: boolean): { renderer: AstrolabeRenderer; tier: 1 | 2 | 3 } => {
  let renderer: AstrolabeRenderer;
  let tier: 1 | 2 | 3;
  if (forceSoftware) {
    renderer = new SVGRenderer();
    tier = 3;
  } else {
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      tier = 1;
    } catch {
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false, precision: 'mediump' });
        tier = 2;
      } catch {
        renderer = new SVGRenderer();
        tier = 3;
      }
    }
  }
  console.info('[astrolabe] renderer tier', tier);
  return { renderer, tier };
};

interface Astrolabe3DProps {
  chart: NatalChartResult;
  isSpinning: boolean;
  resetTrigger: number;
  selectedComponents?: string[];
  highlightedComponents?: string[];
  focusSequence?: number;
  reducedMotion?: boolean;
  motionPaused?: boolean;
  visible?: boolean;
  layoutKey?: string;
  showAnnotations?: boolean;
  onActivate?: () => void;
  onToggleComponent?: (id: string, isMulti: boolean) => void;
  selectedPlanetName?: string | null;
  onSelectPlanet?: (name: string | null) => void;
}

export const Astrolabe3D: React.FC<Astrolabe3DProps> = ({
  chart,
  isSpinning,
  resetTrigger,
  selectedComponents = [],
  highlightedComponents = [],
  focusSequence = 0,
  reducedMotion = false,
  motionPaused = false,
  visible = true,
  layoutKey,
  showAnnotations = true,
  onActivate,
  onToggleComponent,
  selectedPlanetName,
  onSelectPlanet,
}) => {
  const [forceSoftware, setForceSoftware] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<AstrolabeRenderer | null>(null);
  const rendererTierRef = useRef<1 | 2 | 3>(1);
  const wheelGroupRef = useRef<THREE.Group | null>(null);
  const dynamicGroupRef = useRef<THREE.Group | null>(null);
  const interactiveObjectsRef = useRef<THREE.Object3D[]>([]);
  const isSpinningRef = useRef(isSpinning);
  const showAnnotationsRef = useRef(showAnnotations);
  showAnnotationsRef.current = showAnnotations;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const reducedMotionRef = useRef(reducedMotion || motionPaused);
  reducedMotionRef.current = reducedMotion || motionPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const focusStartRef = useRef(0);
  const haloMaterialsRef = useRef<THREE.SpriteMaterial[]>([]);
  const endpointLabelsRef = useRef<Array<{ element: HTMLDivElement; leader: HTMLDivElement; point: THREE.Vector3; target: string; persistent: boolean }>>([]);
  const glyphLabelsRef = useRef<Array<{ element: HTMLDivElement; point: THREE.Vector3 }>>([]);
  const setAspectHoverRef = useRef<(name: string | null) => void>(() => {});
  const wakeRendererRef = useRef<() => void>(() => {});
  const resizeRendererRef = useRef<() => void>(() => {});
  const dismissHoverRef = useRef<() => void>(() => {});
  // An inset object click first swaps the panes; the selection it chose waits
  // here until the pane swap's CSS transition ends (or fires at once under
  // reduced motion). It never fires stale: cleared on unmount, drag start,
  // chart rebuild and every new pointerdown.
  const pendingInsetSelectionRef = useRef<(() => void) | null>(null);
  const chartEpochRef = useRef<NatalChartResult | null>(null);
  const queueInsetSelection = (fire: () => void) => {
    if (reducedMotionRef.current) { pendingInsetSelectionRef.current = null; fire(); return; }
    pendingInsetSelectionRef.current = fire;
  };
  const hoverEpisodeRef = useRef<{ key: string; end: (outcome?: 'completed' | 'cancelled') => void } | null>(null);
  const endChartHover = (outcome: 'completed' | 'cancelled' = 'completed') => {
    const episode = hoverEpisodeRef.current;
    hoverEpisodeRef.current = null;
    episode?.end(outcome);
  };
  const observeChartHover = (rawId: unknown) => {
    const target = chartAnalyticsTarget(typeof rawId === 'string' ? rawId : '');
    if (!target || !visibleRef.current || document.visibilityState === 'hidden') { endChartHover(); return; }
    const key = `${target.target_kind}:${target.target_id}`;
    if (hoverEpisodeRef.current?.key === key) return;
    endChartHover();
    hoverEpisodeRef.current = { key, end: beginInteractionEpisode('chart_item_hover', {
      ...target, activity_kind: 'education', response_mode: 'no_response', entry_point: 'chart_object', input_method: 'pointer',
    }) };
  };

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reducedMotionRef.current = reducedMotion || motionPaused || media.matches;wakeRendererRef.current(); };
    update();media.addEventListener('change',update);
    return () => media.removeEventListener('change',update);
  }, [reducedMotion,motionPaused]);

  useEffect(() => {
    focusStartRef.current = performance.now();
    wakeRendererRef.current();
  }, [focusSequence, highlightedComponents.join('\0'), selectedComponents.join('\0')]);
  useEffect(() => { if (!visible) dismissHoverRef.current(); wakeRendererRef.current(); }, [visible, reducedMotion, motionPaused]);
  useEffect(() => {
    // A CSS transform changes the visual viewport without notifying ResizeObserver.
    // Redraw on both the view change and its completed transition. That completed
    // transition also releases an inset object selection that was held for the
    // pane swap: the swap-zoom completes first, then the selection fires.
    dismissHoverRef.current();
    const pane = containerRef.current?.closest('[data-chart-callout-boundary]');
    const redraw = () => resizeRendererRef.current();
    const settle = () => {
      const fire = pendingInsetSelectionRef.current;
      pendingInsetSelectionRef.current = null;
      fire?.();
      redraw();
    };
    const frame = requestAnimationFrame(redraw);
    pane?.addEventListener('transitionend', settle);
    return () => { cancelAnimationFrame(frame); pane?.removeEventListener('transitionend', settle); };
  }, [layoutKey]);

  // Expand exact, calculated relationships for manual selections and spoken cues alike.
  // A lone planet does not imply every aspect touching it is the current subject.
  const activeSelections = useMemo(() => {
    const seeds = highlightedComponents.length ? highlightedComponents : [
      ...selectedComponents, ...(selectedPlanetName ? [selectedPlanetName] : []),
    ];
    const selected = new Set(seeds);
    if (!chart.input.birthTimeUnknown) {
      chart.natalBodies.forEach(body => { if (selected.has(`House ${body.house}`)) selected.add(body.name); });
    }
    const aspects = [
      ...chart.aspectChords.filter(a => !chart.input.birthTimeUnknown || (a.from !== 'Moon' && a.to !== 'Moon')),
      ...(chart.currentSky?.aspects || []),
    ];
    aspects.forEach(a => { if (selected.has(a.name)) { selected.add(a.from); selected.add(a.to); } });
    aspects.forEach(a => { if (selected.has(a.from) && selected.has(a.to)) selected.add(a.name); });
    return Array.from(selected);
  }, [chart, selectedComponents.join('\0'), selectedPlanetName, highlightedComponents.join('\0')]);
  const activeSelectionsRef = useRef(activeSelections);
  activeSelectionsRef.current = activeSelections;
  const toggleComponentRef = useRef(onToggleComponent);
  toggleComponentRef.current = onToggleComponent;
  const selectPlanetRef = useRef(onSelectPlanet);
  selectPlanetRef.current = onSelectPlanet;
  const activateRef = useRef(onActivate);
  activateRef.current = onActivate;

  // Realistic Momentum Physics Variables
  const velocityYRef = useRef(0.00022);
  const velocityXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const prevPointerXRef = useRef(0);
  const prevPointerYRef = useRef(0);
  const lastDeltaXRef = useRef(0);
  const lastDeltaYRef = useRef(0);
  const lastMoveTimeRef = useRef(0);

  useEffect(() => {
    dismissHoverRef.current();
    if (!showAnnotations) {
      endpointLabelsRef.current.forEach(({element,leader}) => { element.style.display = leader.style.display = 'none'; });
    }
    wakeRendererRef.current();
  }, [showAnnotations]);

  useEffect(() => {
    isSpinningRef.current = isSpinning;
  }, [isSpinning]);

  useEffect(() => {
    if (resetTrigger > 0 && wheelGroupRef.current && cameraRef.current) {
      dismissHoverRef.current();
      wheelGroupRef.current.rotation.set(0.38, 0, -0.02);
      cameraRef.current.position.set(0, 6.8, 6.2);
      cameraRef.current.lookAt(0, -0.15, 0);
      velocityYRef.current = 0.00022;
      velocityXRef.current = 0;
    }
  }, [resetTrigger]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth || 1200;
    const height = container.clientHeight || window.innerHeight || 800;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 6.8, 6.2);
    camera.lookAt(0, -0.15, 0);
    cameraRef.current = camera;

    const { renderer, tier } = createAstrolabeRenderer(forceSoftware);
    const webglRenderer = tier === 3 ? null : (renderer as THREE.WebGLRenderer);
    if (webglRenderer) webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (webglRenderer) webglRenderer.setSize(width, height, false);
    else renderer.setSize(width, height);
    Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' });
    if (webglRenderer) {
      webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      webglRenderer.toneMappingExposure = 1.15;
    }
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    // Pinch belongs to the torus, not the page: without touch-action:none
    // Android Chrome hijacks the pinch for whole-screen zoom.
    renderer.domElement.style.touchAction = 'none';
    rendererRef.current = renderer;
    rendererTierRef.current = tier;
    if (tier === 3) hideTier3Sprites(scene);

    const tooltipEl = document.createElement('div');
    {
      tooltipEl.className = 'astrolabe-tooltip';
      tooltipEl.setAttribute('role', 'tooltip');
      tooltipEl.style.position = 'fixed';
      tooltipEl.style.pointerEvents = 'none';
      tooltipEl.style.zIndex = '9999';
      tooltipEl.style.opacity = '0';
      tooltipEl.style.visibility = 'hidden';
      tooltipEl.style.backgroundColor = 'rgba(20, 13, 33, 0.94)';
      tooltipEl.style.backdropFilter = 'blur(16px)';
      tooltipEl.style.border = '1px solid rgba(212, 175, 55, 0.7)';
      tooltipEl.style.boxShadow =
        '0 16px 36px -5px rgba(0, 0, 0, 0.8), 0 0 24px rgba(212, 175, 55, 0.35)';
      tooltipEl.style.borderRadius = '12px';
      tooltipEl.style.padding = '12px 16px';
      tooltipEl.style.color = '#f5eedc';
      tooltipEl.style.fontFamily = '"IBM Plex Mono", monospace';
      tooltipEl.style.fontSize = '12px';
      tooltipEl.style.boxSizing = 'border-box';
      tooltipEl.style.overflowWrap = 'anywhere';
      tooltipEl.style.lineHeight = '1.45';
      document.body.appendChild(tooltipEl);
    }

    // Warm specular multi-point lighting
    const ambientLight = new THREE.AmbientLight(0xfff3d6, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffe6a3, 3.4);
    keyLight.position.set(6, 10, 7);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x9fc0ff, 2.0);
    fillLight.position.set(-6, 5, -5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xf2a38c, 2.2);
    rimLight.position.set(0, -7, 5);
    scene.add(rimLight);

    const glintPoint1 = new THREE.PointLight(0xffe38f, 2.8, 30);
    glintPoint1.position.set(2, 6, 4);
    scene.add(glintPoint1);

    const glintPoint2 = new THREE.PointLight(0x67e8f9, 1.6, 25);
    glintPoint2.position.set(-4, 3, 2);
    scene.add(glintPoint2);

    const wheelGroup = new THREE.Group();
    wheelGroup.rotation.x = 0.38;
    wheelGroup.rotation.z = -0.02;
    scene.add(wheelGroup);
    wheelGroupRef.current = wheelGroup;

    // Google Stitch Thick Doughnut Torus System
    const R_TORUS_TRACK = 2.05;
    const R_TORUS_TUBE = 0.38;
    const R_HOUSE_INNER = 1.08;
    const R_CENTER_RETICLE = 0.18;

    const torusGeo = new THREE.TorusGeometry(R_TORUS_TRACK, R_TORUS_TUBE, 48, 160);
    const torusMat = new THREE.MeshPhysicalMaterial({
      color: 0x1f1430,
      emissive: 0x11071c,
      roughness: 0.16,
      metalness: 0.88,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      reflectivity: 0.95,
      ior: 1.55,
    });
    const torusMesh = new THREE.Mesh(torusGeo, torusMat);
    torusMesh.rotation.x = Math.PI / 2;
    torusMesh.position.y = 0;
    torusMesh.userData.structureFrame = true;
    wheelGroup.add(torusMesh);

    // Beveled brass rims
    const outerBezelGeo = new THREE.TorusGeometry(R_TORUS_TRACK + R_TORUS_TUBE, 0.032, 24, 160);
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xdfb43a,
      roughness: 0.22,
      metalness: 0.92,
    });
    const outerBezel = new THREE.Mesh(outerBezelGeo, brassMat);
    outerBezel.rotation.x = Math.PI / 2;
    outerBezel.position.y = 0.02;
    outerBezel.userData.structureFrame = true;
    wheelGroup.add(outerBezel);

    const innerBezelGeo = new THREE.TorusGeometry(R_TORUS_TRACK - R_TORUS_TUBE, 0.032, 24, 160);
    const innerBezel = new THREE.Mesh(innerBezelGeo, brassMat);
    innerBezel.rotation.x = Math.PI / 2;
    innerBezel.position.y = 0.02;
    innerBezel.userData.structureFrame = true;
    wheelGroup.add(innerBezel);

    // Inner Sanctuary Floor Disc
    const discGeo = new THREE.CircleGeometry(R_TORUS_TRACK - R_TORUS_TUBE - 0.01, 80);
    const discMat = new THREE.MeshPhysicalMaterial({
      color: 0x140a22,
      roughness: 0.2,
      metalness: 0.3,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    });
    const discMesh = new THREE.Mesh(discGeo, discMat);
    discMesh.rotation.x = Math.PI / 2;
    discMesh.position.y = 0.01;
    discMesh.userData.structureFrame = true;
    wheelGroup.add(discMesh);

    // Concentric Guide Rings
    [R_HOUSE_INNER, 1.48, 0.65].forEach((radius) => {
      const ringGeo = new THREE.RingGeometry(radius - 0.006, radius + 0.006, 120);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xd4af37,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = 0.02;
      ringMesh.userData.structureFrame = true;
      wheelGroup.add(ringMesh);
    });

    const dynamicGroup = new THREE.Group();
    wheelGroup.add(dynamicGroup);
    dynamicGroupRef.current = dynamicGroup;

    const raycaster = new THREE.Raycaster();
    raycaster.params.Line = { threshold: 0.045 };
    const mouse = new THREE.Vector2();
    let isHovered = false;
    let mouseGesture: { x: number; y: number; moved: boolean } | null = null;
    let suppressDragClick = false;
    let activatedTouchUntil = 0;
    let clickInput: 'pointer' | 'touch' | 'unknown' = 'unknown';
    let hoverTarget: THREE.Object3D | null = null;
    let hoverPointer: { x: number; y: number } | null = null;
    const boundary = container.closest<HTMLElement>('[data-chart-callout-boundary]');
    const isInset = () => boundary?.dataset.chartInset === 'true';
    const dismissHover = () => {
      hoverTarget = null;hoverPointer = null;isHovered = false;
      setAspectHoverRef.current(null);endChartHover('cancelled');
      tooltipEl.style.opacity = '0';tooltipEl.style.visibility = 'hidden';
      renderer.domElement.style.cursor = 'default';
    };
    dismissHoverRef.current = dismissHover;
    const pointerCanHover = (x: number, y: number) => {
      if (!visibleRef.current || document.hidden || !container.isConnected || container.closest('[hidden], [inert], [data-dragging="true"]')) return false;
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return false;
      const top = document.elementFromPoint(x, y);
      return top === renderer.domElement || top === container;
    };

    // Momentum interaction handlers
    const startDrag = (clientX: number, clientY: number) => {
      pendingInsetSelectionRef.current = null;
      dismissHover();
      isDraggingRef.current = true;
      prevPointerXRef.current = clientX;
      prevPointerYRef.current = clientY;
      lastDeltaXRef.current = 0;
      lastDeltaYRef.current = 0;
      lastMoveTimeRef.current = performance.now();
    };

    const updateDrag = (clientX: number, clientY: number) => {
      const now = performance.now();
      if (isDraggingRef.current && wheelGroupRef.current) {
        const dx = clientX - prevPointerXRef.current;
        const dy = clientY - prevPointerYRef.current;
        const dt = Math.max(1, now - lastMoveTimeRef.current);

        wheelGroupRef.current.rotation.y += dx * 0.0065;
        wheelGroupRef.current.rotation.x = Math.max(
          -0.55,
          Math.min(1.15, wheelGroupRef.current.rotation.x + dy * 0.0055)
        );

        const instVelX = (dx / dt) * 16;
        const instVelY = (dy / dt) * 16;
        lastDeltaXRef.current = lastDeltaXRef.current * 0.4 + instVelX * 0.6;
        lastDeltaYRef.current = lastDeltaYRef.current * 0.4 + instVelY * 0.6;

        prevPointerXRef.current = clientX;
        prevPointerYRef.current = clientY;
        lastMoveTimeRef.current = now;
      }
    };

    const endDrag = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        velocityYRef.current = Math.max(-0.06, Math.min(0.06, lastDeltaXRef.current * 0.0035));
        velocityXRef.current = Math.max(-0.04, Math.min(0.04, lastDeltaYRef.current * 0.0025));
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (touchBinding.suppressMouse()) return;
      const elementUnderPointer = document.elementFromPoint(e.clientX, e.clientY);
      if (
        elementUnderPointer &&
        elementUnderPointer !== renderer.domElement &&
        elementUnderPointer !== containerRef.current &&
        !renderer.domElement.contains(elementUnderPointer)
      ) {
        return;
      }
      if (e.isTrusted) clickInput = 'pointer';
      mouseGesture = { x: e.clientX, y: e.clientY, moved: false };
      suppressDragClick = false;
      startDrag(e.clientX, e.clientY);
    };

    const onMouseUp = (event: MouseEvent) => {
      if (touchBinding.suppressMouse()) return;
      if (mouseGesture) {
        suppressDragClick = mouseGesture.moved || Math.hypot(event.clientX - mouseGesture.x,event.clientY - mouseGesture.y) > 4;
        mouseGesture = null;
      }
      endDrag();
    };

    const pickChartTargets = () => {
      const hits = raycaster.intersectObjects(interactiveObjectsRef.current, false);
      // The visible badge wins inside its painted circle, even over a planet hit sphere.
      const badge = hits.find(hit => hit.object.userData.orientationAnchor && hit.uv && Math.hypot(hit.uv.x - 0.5, hit.uv.y - 0.5) <= 51 / 128);
      if (badge) return [badge, ...hits.filter(hit => hit !== badge)];
      // Planet glyphs retain priority at endpoints. Else match the visible line
      // closest to the pointer, rather than a hidden house sphere below it.
      if (hits[0]?.object.userData.planetName) return hits;
      const lines = hits.filter(hit => hit.object.userData.aspectName);
      if (!lines.length) return hits;
      const rect = renderer.domElement.getBoundingClientRect();
      const distance = (hit: THREE.Intersection) => {
        const point = hit.point.clone().project(camera);
        return Math.hypot((point.x - mouse.x) * rect.width, (point.y - mouse.y) * rect.height);
      };
      lines.sort((left, right) => distance(left) - distance(right));
      return [lines[0], ...hits.filter(hit => hit !== lines[0])];
    };

    // Inset object picks run two paths: the pane swap that brings the chart
    // forward starts immediately, while the object's own selection resolves
    // exactly as the foreground path does and then waits for the pane's CSS
    // transition to end (or fires at once under reduced motion).
    const queueInsetObjectSelection = (
      data: THREE.Object3D['userData'],
      isMulti: boolean,
      reportSelection: () => void
    ) => {
      const componentId =
        data.componentId || data.planetName || data.houseName || data.aspectName || data.title;
      activateRef.current?.();
      queueInsetSelection(() => {
        if (toggleComponentRef.current && componentId) {
          toggleComponentRef.current(componentId, isMulti);
          reportSelection();
        } else if (selectPlanetRef.current && data.planetName) {
          selectPlanetRef.current(data.planetName);
          reportSelection();
        }
      });
    };

    const refreshCallout = () => {
      if (!hoverTarget || !hoverPointer) return;
      if (isDraggingRef.current || !pointerCanHover(hoverPointer.x, hoverPointer.y)) { dismissHover();return; }
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((hoverPointer.x - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((hoverPointer.y - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      if (pickChartTargets()[0]?.object !== hoverTarget) { dismissHover();return; }
      tooltipEl.style.transition = reducedMotionRef.current ? 'none' : 'opacity 0.15s ease';
      if (!placeChartCallout(tooltipEl, hoverPointer, isInset() && boundary ? boundary.getBoundingClientRect() : null)) dismissHover();
    };

    const onMouseMove = (event: MouseEvent) => {
      if (touchBinding.suppressMouse()) return;
      if (mouseGesture && Math.hypot(event.clientX - mouseGesture.x,event.clientY - mouseGesture.y) > 4) mouseGesture.moved = true;
      if (isDraggingRef.current) {
        updateDrag(event.clientX, event.clientY);
        return;
      }

      // Guard: If cursor is over any modal, card, panel, button, or menu on top of the canvas,
      // hide the astrolabe tooltip immediately and do not process raycasting
      if (!pointerCanHover(event.clientX, event.clientY)) { dismissHover();return; }

      const rect = renderer.domElement.getBoundingClientRect();
      updateDrag(event.clientX, event.clientY);

      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = pickChartTargets();

      if (intersects.length > 0 && !isDraggingRef.current) {
        const data = intersects[0].object.userData;
        if (event.isTrusted) observeChartHover(data.componentId || data.planetName || data.houseName || data.aspectName);
        setAspectHoverRef.current(data.aspectName || (isInset() ? data.componentId || data.planetName || data.houseName : null) || null);
        hoverTarget = intersects[0].object;hoverPointer = {x:event.clientX,y:event.clientY};
        isHovered = true;
        renderer.domElement.style.cursor = data.selectable === false ? 'help' : 'pointer';

        {
          const isSelected = activeSelectionsRef.current.includes(data.componentId || data.planetName);
          const selectHint = activateRef.current ? 'Click to bring your chart into focus' : data.selectable === false ? 'Birth time needed for a precise Moon placement' : 'Shift/Ctrl-click to toggle multi-selection';

          tooltipEl.innerHTML = `
            <div style="font-size: 9px; letter-spacing: 0.14em; color: ${data.accent}; font-weight: 700; margin-bottom: 3px; text-transform: uppercase;">
              ${data.category} ${data.aspectName ? '· HOVER PREVIEW ' : ''}${isSelected ? '★ SELECTED' : ''}
            </div>
            <div style="font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 4px; font-family: 'Cinzel', serif;">
              ${data.title}
            </div>
            <div style="font-size: 11px; color: #c4bcd0; line-height: 1.4; margin-bottom: 4px;">
              ${data.detail}
            </div>
            <div style="font-size: 9px; color: #f2ca50; font-family: monospace;">
              ✦ ${selectHint}
            </div>
          `;
          refreshCallout();
        }
      } else {
        dismissHover();
        renderer.domElement.style.cursor = isDraggingRef.current ? 'grabbing' : 'grab';
      }
    };

    const zoom = (factor: number) => {
      dismissHover();
      const distance = camera.position.length();
      camera.position.multiplyScalar(getTorusZoomDistance(distance, factor) / distance);
      camera.lookAt(0, -0.15, 0);
    };
    const touchBinding = bindTorusTouch(renderer.domElement as unknown as HTMLElement, {
      start: (x, y) => {
        mouseGesture = null;suppressDragClick = false;activatedTouchUntil = 0;
        startDrag(x, y);
      },
      move: updateDrag,
      end: (allowMomentum) => {
        endDrag();
        if (!allowMomentum) {
          velocityXRef.current = 0;
          velocityYRef.current = 0;
        }
      },
      zoom,
    });

    // Click handler with Shift-Click / Ctrl-Click Multi-Selection
    const onClick = (event: MouseEvent) => {
      const observedInput = clickInput;
      clickInput = 'unknown';
      if (Date.now() < activatedTouchUntil) return;
      if (touchBinding.suppressClick()) return;
      // Rotation is not a target activation: consume only the click following
      // a legitimate mouse gesture that crossed the same four-pixel tolerance.
      if (suppressDragClick) { suppressDragClick = false;return; }
      const elementUnderPointer = document.elementFromPoint(event.clientX, event.clientY);
      if (
        elementUnderPointer &&
        elementUnderPointer !== renderer.domElement &&
        elementUnderPointer !== containerRef.current &&
        !renderer.domElement.contains(elementUnderPointer)
      ) {
        return;
      }

      // Inset clicks run two paths from one tap: the pane swap that brings
      // the chart forward starts immediately, while the tapped object's own
      // selection waits for the pane's CSS transition to end (or fires at
      // once when the user prefers reduced motion).
      if (isInset()) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const data = pickChartTargets()[0]?.object.userData;
        if (data && data.selectable !== false) {
          const isMulti = event.shiftKey || event.ctrlKey || event.metaKey;
          const target = chartAnalyticsTarget(data.componentId || data.planetName || data.houseName || data.aspectName || '');
          const pointerType = (event as PointerEvent).pointerType;
          const inputMethod = pointerType === 'touch' ? 'touch'
            : pointerType === 'mouse' || pointerType === 'pen' ? 'pointer'
            : event.detail > 0 ? observedInput : 'unknown';
          const reportSelection = () => {
            if (event.isTrusted && target) trackInteraction('chart_item_select', {
              ...target, activity_kind: 'education', response_mode: 'no_response', entry_point: 'chart_object',
              input_method: inputMethod,
            });
          };
          queueInsetObjectSelection(data, isMulti, reportSelection);
          return;
        }
        activateRef.current?.();
        return;
      }

      if (activateRef.current) { activateRef.current();return; }

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = pickChartTargets();

      if (intersects.length > 0) {
        const data = intersects[0].object.userData;
        if (data.selectable === false) return;
        const componentId =
          data.componentId || data.planetName || data.houseName || data.aspectName || data.title;

        const isMulti = event.shiftKey || event.ctrlKey || event.metaKey;
        const target = chartAnalyticsTarget(data.componentId || data.planetName || data.houseName || data.aspectName || '');
        const pointerType = (event as PointerEvent).pointerType;
        const inputMethod = pointerType === 'touch' ? 'touch'
          : pointerType === 'mouse' || pointerType === 'pen' ? 'pointer'
          : event.detail > 0 ? observedInput : 'unknown';
        const reportSelection = () => {
          if (event.isTrusted && target) trackInteraction('chart_item_select', {
            ...target, activity_kind: 'education', response_mode: 'no_response', entry_point: 'chart_object',
            input_method: inputMethod,
          });
        };

        if (toggleComponentRef.current && componentId) {
          toggleComponentRef.current(componentId, isMulti);
          reportSelection();
        } else if (selectPlanetRef.current && data.planetName) {
          selectPlanetRef.current(data.planetName);
          reportSelection();
        }
      }
    };

    const onTouchActivate = (event: TouchEvent) => {
      if (event.isTrusted) clickInput = 'touch';
      if (event.touches.length || event.changedTouches.length !== 1 || touchBinding.suppressClick()) return;
      const touch = event.changedTouches[0], element = document.elementFromPoint(touch.clientX,touch.clientY);
      if (element && element !== renderer.domElement && element !== containerRef.current && !renderer.domElement.contains(element)) return;
      // Inset taps follow the same two-path rule as clicks: the chart comes
      // forward at once while the tapped object's selection waits for the
      // pane's CSS transition to end (or fires at once under reduced motion).
      if (isInset()) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const data = pickChartTargets()[0]?.object.userData;
        if (data && data.selectable !== false) {
          const target = chartAnalyticsTarget(data.componentId || data.planetName || data.houseName || data.aspectName || '');
          const reportSelection = () => {
            if (event.isTrusted && target) trackInteraction('chart_item_select', {
              ...target, activity_kind: 'education', response_mode: 'no_response', entry_point: 'chart_object',
              input_method: 'touch',
            });
          };
          activatedTouchUntil = Date.now() + 700;
          if (event.cancelable) event.preventDefault();
          queueInsetObjectSelection(data, false, reportSelection);
          return;
        }
      }
      if (!activateRef.current) return;
      // A real tap with sub-threshold movement may not produce a native click
      // after touchmove prevented scrolling. Activate once from its touchend.
      activatedTouchUntil = Date.now() + 700;
      if (event.cancelable) event.preventDefault();
      activateRef.current();
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoom(event.deltaY > 0 ? 1.05 : 0.95);
    };

    const onMouseLeave = () => {
      dismissHover();
      if (touchBinding.suppressMouse()) return;
      isDraggingRef.current = false;
    };

    // Any new pointerdown anywhere invalidates a deferred inset selection.
    const onDocumentPointerDown = () => {
      pendingInsetSelectionRef.current = null;
      dismissHover();
    };

    const domEl = renderer.domElement as unknown as HTMLElement;
    domEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    domEl.addEventListener('click', onClick);
    domEl.addEventListener('touchend', onTouchActivate, { passive: false });
    domEl.addEventListener('wheel', onWheel, { passive: false });
    domEl.addEventListener('mouseleave', onMouseLeave);

    let animFrameId = 0;
    let disposed = false;
    let contextLost = false;
    let lastTier3Render = 0;
    const renderFrame = () => {
      renderer.render(scene, camera);
      if (tier === 3) renderer.domElement.style.backgroundColor = 'transparent';
    };

    const animate = () => {
      animFrameId = 0;
      if (disposed || contextLost || !visibleRef.current || document.visibilityState === 'hidden') return;
      animFrameId = requestAnimationFrame(animate);
      if (tier === 3) {
        const now = performance.now();
        if (now - lastTier3Render < 66) return;
        lastTier3Render = now;
      }
      const haloOpacity = chartHaloOpacity(performance.now() - focusStartRef.current, reducedMotionRef.current);
      haloMaterialsRef.current.forEach(material => { material.opacity = haloOpacity; });

      if (wheelGroupRef.current) {
        if (!reducedMotionRef.current && !isDraggingRef.current && !isHovered) {
          // Operator tuning 2026-11-08: 2.5× the original 0.00022 — her
          // wheel turns like the sky: perceptibly, unhurried.
          const baseSpin = isSpinningRef.current ? 0.00055 : 0;
          wheelGroupRef.current.rotation.y += velocityYRef.current;
          wheelGroupRef.current.rotation.x += velocityXRef.current;

          wheelGroupRef.current.rotation.x = Math.max(
            -0.55,
            Math.min(1.15, wheelGroupRef.current.rotation.x)
          );

          velocityYRef.current =
            velocityYRef.current * 0.972 + baseSpin * 0.028;
          velocityXRef.current *= 0.94;
        }
      }

      renderFrame();
      refreshCallout();
      // HTML text retains real screen-pixel size when the whole chart becomes the inset.
      // It sits above the WebGL halo rather than being blurred into its texture.
      const bounds = container.getBoundingClientRect();
      const inverseScale = bounds.width > 0 ? container.clientWidth / bounds.width : 1;
      const labelWidth = Math.min(178, Math.max(110, bounds.width - 16));
      const occupied: Array<{ x: number; y: number }> = [];
      endpointLabelsRef.current.forEach(({ element, leader, point, persistent }) => {
        if (!showAnnotationsRef.current || isInset()) { element.style.display = leader.style.display = 'none';return; }
        if (persistent) element.style.display = leader.style.display = '';
        if (element.style.display === 'none') return;
        const projected = point.clone(); wheelGroup.localToWorld(projected); projected.project(camera);
        const anchorX = (projected.x + 1) * bounds.width / 2;
        const anchorY = (1 - projected.y) * bounds.height / 2;
        let x = Math.max(8, Math.min(bounds.width - labelWidth - 8, anchorX - labelWidth / 2));
        let y = Math.max(8, Math.min(bounds.height - 55, anchorY - 65));
        for (let attempt = 0; attempt < 12; attempt++) {
          if (!occupied.some(other => Math.abs(x - other.x) < labelWidth + 5 && Math.abs(y - other.y) < 49)) break;
          y += 51;
          if (y > bounds.height - 55) { y = 8; x = x < bounds.width / 2 ? Math.max(8, bounds.width - labelWidth - 8) : 8; }
        }
        occupied.push({ x, y });
        element.style.width = labelWidth + 'px';
        element.style.transform = 'translate(' + x * inverseScale + 'px,' + y * inverseScale + 'px) scale(' + inverseScale + ')';
        const endX = x + labelWidth / 2, endY = y + 42;
        leader.style.left = anchorX * inverseScale + 'px'; leader.style.top = anchorY * inverseScale + 'px';
        leader.style.width = Math.hypot(endX - anchorX, endY - anchorY) * inverseScale + 'px';
        leader.style.height = inverseScale + 'px';
        leader.style.transform = 'rotate(' + Math.atan2(endY - anchorY, endX - anchorX) + 'rad)';
      });
      glyphLabelsRef.current.forEach(({ element, point }) => {
        const projected = point.clone(); wheelGroup.localToWorld(projected); projected.project(camera);
        const anchorX = (projected.x + 1) * bounds.width / 2;
        const anchorY = (1 - projected.y) * bounds.height / 2;
        element.style.transform = 'translate(' + anchorX * inverseScale + 'px,' + anchorY * inverseScale + 'px) translate(-50%, -50%) scale(' + inverseScale + ')';
      });
    };
    const wake = () => {
      if (!disposed && !contextLost && visibleRef.current && document.visibilityState !== 'hidden' && !animFrameId) animate();
      if (!visibleRef.current || document.visibilityState === 'hidden') dismissHover();
    };
    wakeRendererRef.current = wake;
    document.addEventListener('visibilitychange', wake);
    wake();

    const renderSize = new THREE.Vector2(width, height);
    const handleResize = () => {
      dismissHover();
      if (disposed || contextLost) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      // Do not replace a valid canvas with viewport-sized pixels while layout is pending.
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (renderSize.x !== w || renderSize.y !== h) {
        if (webglRenderer) webglRenderer.setSize(w, h, false);
        else renderer.setSize(w, h);
        renderSize.set(w, h);
      }
      // setSize clears the drawing buffer: repaint in the same callback.
      renderFrame();
      wake();
    };
    let contextLostTimer = 0;
    const onContextLost = (event: Event) => {
      dismissHover();
      event.preventDefault();
      contextLost = true;
      cancelAnimationFrame(animFrameId);
      animFrameId = 0;
      if (webglRenderer && !forceSoftware) contextLostTimer = window.setTimeout(() => setForceSoftware(true), 3000);
    };
    const onContextRestored = () => {
      if (disposed) return;
      contextLost = false;
      window.clearTimeout(contextLostTimer);
      handleResize();
    };
    resizeRendererRef.current = handleResize;
    if (webglRenderer) {
      domEl.addEventListener('webglcontextlost', onContextLost);
      domEl.addEventListener('webglcontextrestored', onContextRestored);
    }
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', dismissHover, true);
    window.addEventListener('blur', dismissHover);
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    window.visualViewport?.addEventListener('resize', dismissHover);
    window.visualViewport?.addEventListener('scroll', dismissHover);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      pendingInsetSelectionRef.current = null;
      dismissHover();
      disposed = true;
      dismissHoverRef.current = () => {};
      wakeRendererRef.current = () => {};
      resizeRendererRef.current = () => {};
      window.clearTimeout(contextLostTimer);
      if (webglRenderer) {
        domEl.removeEventListener('webglcontextlost', onContextLost);
        domEl.removeEventListener('webglcontextrestored', onContextRestored);
      }
      cancelAnimationFrame(animFrameId);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', wake);
      domEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      touchBinding.dispose();
      domEl.removeEventListener('click', onClick);
      domEl.removeEventListener('touchend', onTouchActivate);
      domEl.removeEventListener('wheel', onWheel);
      domEl.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', dismissHover, true);
      window.removeEventListener('blur', dismissHover);
      document.removeEventListener('pointerdown', onDocumentPointerDown, true);
      window.visualViewport?.removeEventListener('resize', dismissHover);
      window.visualViewport?.removeEventListener('scroll', dismissHover);
      const textures = new Set<THREE.Texture>();
      const materials = new Set<THREE.Material>();
      scene.traverse(object => {
        const item = object as THREE.Mesh;
        item.geometry?.dispose();
        const list = item.material ? (Array.isArray(item.material) ? item.material : [item.material]) : [];
        list.forEach(material => { materials.add(material); const texture = (material as THREE.SpriteMaterial).map; if (texture) textures.add(texture); });
      });
      textures.forEach(texture => texture.dispose());
      materials.forEach(material => material.dispose());
      webglRenderer?.dispose();
      tooltipEl.remove();
    };
  }, [forceSoftware]);

  // Update dynamic chart items on the 3D astrolabe
  useEffect(() => {
    dismissHoverRef.current();
    // A rebuilt chart invalidates any inset selection still waiting to fire;
    // layout, selection or annotation re-runs of this effect must not.
    if (chartEpochRef.current !== chart) {
      chartEpochRef.current = chart;
      pendingInsetSelectionRef.current = null;
    }
    const dynamicGroup = dynamicGroupRef.current;
    if (!dynamicGroup) return;

    while (dynamicGroup.children.length > 0) {
      const child = dynamicGroup.children[0];
      dynamicGroup.remove(child);
    }
    interactiveObjectsRef.current = [];
    haloMaterialsRef.current = [];

    const R_TORUS_TRACK = 2.05;
    const R_TORUS_TUBE = 0.38;
    const Y_SUPERIMPOSED = R_TORUS_TUBE + 0.02;
    const R_PLANETS_TRACK = 1.50;
    const R_HOUSE_INNER = 1.08;

    // Without birth time there is no defensible ascendant orientation or house wheel.
    const ASC_LON = chart.input.birthTimeUnknown ? 0 : chart.ascLon;

    function lonToRad(lon: number): number {
      const diff = (lon - ASC_LON + 360) % 360;
      return Math.PI - (diff * Math.PI) / 180;
    }

    const glyphLabels: typeof glyphLabelsRef.current = [];
    const addGlyphLabel = (text: string, point: THREE.Vector3) => {
      if (rendererTierRef.current !== 3) return;
      if (containerRef.current?.closest<HTMLElement>('[data-chart-callout-boundary]')?.dataset.chartInset === 'true') return;
      const element = document.createElement('div');
      element.textContent = text;
      Object.assign(element.style, { position: 'absolute', top: '0', left: '0', zIndex: '13', pointerEvents: 'none', transformOrigin: '50% 50%', color: '#fff8e1', fontFamily: '"Cinzel", Georgia, serif', fontWeight: '700', fontSize: '17px', textShadow: '0 0 4px #000000, 0 1px 3px #000000', whiteSpace: 'nowrap' });
      containerRef.current?.append(element);
      glyphLabels.push({ element, point });
    }

    function createGlyphSprite(
      text: string,
      subText: string,
      colorHex: string,
      scale = 0.36,
      isHighlighted = false
    ): THREE.Sprite {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 128, 128);

      // 1. Christmas bauble golden metallic hanger crown & loop at top
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(57, 4, 14, 10);
      ctx.beginPath();
      ctx.arc(64, 5, 5, 0, Math.PI * 2);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffe57f';
      ctx.stroke();

      // 2. Bold, rich jewel-toned Christmas bauble spherical disc base
      ctx.beginPath();
      ctx.arc(64, 52, 42, 0, Math.PI * 2);
      ctx.fillStyle = isHighlighted ? '#fef08a' : colorHex;
      ctx.fill();

      // 3. Outer golden metallic ornament rim
      ctx.lineWidth = isHighlighted ? 5 : 3.5;
      ctx.strokeStyle = isHighlighted ? '#ffffff' : '#ffd875';
      ctx.stroke();

      // 4. Spherical radial gloss specular highlight (Christmas bauble glass reflection)
      const grad = ctx.createRadialGradient(48, 38, 4, 64, 52, 42);
      grad.addColorStop(0, 'rgba(255,255,255,0.72)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.22)');
      grad.addColorStop(0.75, 'rgba(0,0,0,0.12)');
      grad.addColorStop(1, 'rgba(0,0,0,0.58)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(64, 52, 42, 0, Math.PI * 2);
      ctx.fill();

      // 5. High-contrast symbol: Dark glyph surrounded by a crisp thin light border
      ctx.font = 'bold 54px "Cinzel", "Cinzel Decorative", "Times New Roman", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Crisp thin light/white border for immediate visual pop on any background
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(text, 64, 52);

      // Deep bold dark glyph fill for maximum contrast
      ctx.fillStyle = '#080214'; // deep dark cosmic ink
      ctx.fillText(text, 64, 52);

      // Subtext degree text with high-contrast dual outline
      if (subText) {
        ctx.font = 'bold 20px "IBM Plex Mono", monospace';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#05020a';
        ctx.strokeText(subText, 64, 108);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(subText, 64, 108);
      }

      const texture = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.userData.focused = isHighlighted;
      const finalScale = isHighlighted ? scale * 1.3 : scale;
      sprite.scale.set(finalScale, finalScale, 1);
      return sprite;
    }

    // 0. GEOCENTRIC CENTER: 🜨 EARTH (TERRA) FOCAL OBSERVER
    // In classic astrolabes and geocentric natal charts, the center is the observer on Earth.
    const R_CENTER_RETICLE = 0.22;
    const earthGeo = new THREE.SphereGeometry(R_CENTER_RETICLE, 32, 32);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x228be6, // Celestial Earth ocean azure
      emissive: 0x0c325c,
      emissiveIntensity: 0.5,
      metalness: 0.85,
      roughness: 0.2,
    });
    const earthSphere = new THREE.Mesh(earthGeo, earthMat);
    earthSphere.position.set(0, 0.05, 0);
    earthSphere.userData.focused = activeSelections.includes('Earth') || activeSelections.includes('Earth (Geocentric Origin)');
    dynamicGroup.add(earthSphere);

    // Gold Equatorial Ring around Earth
    const earthRingGeo = new THREE.TorusGeometry(0.26, 0.012, 16, 48);
    const earthRingMat = new THREE.MeshStandardMaterial({
      color: 0xf2ca50,
      emissive: 0xd4af37,
      emissiveIntensity: 0.6,
      metalness: 0.9,
      roughness: 0.15,
    });
    const earthRing = new THREE.Mesh(earthRingGeo, earthRingMat);
    earthRing.rotation.x = Math.PI / 2;
    earthRing.position.set(0, 0.05, 0);
    earthRing.userData.focused = earthSphere.userData.focused;
    dynamicGroup.add(earthRing);

    // Floating Billboard Label above Earth Center
    const isEarthSelected = activeSelections.includes('Earth') || activeSelections.includes('Earth (Geocentric Origin)');
    const earthSprite = createGlyphSprite('🜨', 'Earth', '#38bdf8', 0.36, isEarthSelected);
    earthSprite.position.set(0, 0.36, 0);
    dynamicGroup.add(earthSprite);
    addGlyphLabel('🜨', earthSprite.position.clone());

    // Interactive Hit Sphere for Earth Origin (Tested first)
    const hitEarth = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 12, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitEarth.position.set(0, 0.05, 0);
    hitEarth.userData = {
      componentId: 'Earth (Geocentric Origin)',
      planetName: 'Earth',
      title: '🜨 Earth (Terra) · Geocentric Origin',
      category: 'ASTROLABE FOCAL ORIGIN',
      detail: `The observer’s natal vantage point on Earth at ${chart.input.placeName || 'birthplace'}. In geocentric natal astrology, the entire celestial sphere, houses, and planetary spheres revolve around this terrestrial focal point.`,
      accent: '#38bdf8',
    };
    dynamicGroup.add(hitEarth);
    interactiveObjectsRef.current.push(hitEarth);

    // 1. ZODIAC SIGNS (Superimposed on torus)
    ZODIAC_SIGNS.forEach((sign) => {
      const cuspRad = lonToRad(sign.lon);
      const tickGeo = new THREE.CylinderGeometry(0.012, 0.012, R_TORUS_TUBE * 1.8, 8);
      const tickMat = new THREE.MeshBasicMaterial({ color: 0xd4af37 });
      const tick = new THREE.Mesh(tickGeo, tickMat);
      tick.position.set(
        Math.cos(cuspRad) * R_TORUS_TRACK,
        Y_SUPERIMPOSED,
        Math.sin(cuspRad) * R_TORUS_TRACK
      );
      tick.rotation.z = Math.PI / 2;
      tick.rotation.y = -cuspRad;
      tick.userData.focused = activeSelections.includes(sign.name);
      dynamicGroup.add(tick);

      const centerRad = lonToRad(sign.lon + 15);
      const zx = Math.cos(centerRad) * R_TORUS_TRACK;
      const zz = Math.sin(centerRad) * R_TORUS_TRACK;
      const isSelected = activeSelections.includes(sign.name);

      const zSprite = createGlyphSprite(sign.glyph, '', '#f5d77f', 0.32, isSelected);
      zSprite.userData.targetId = sign.name;
      zSprite.position.set(zx, Y_SUPERIMPOSED + 0.1, zz);
      dynamicGroup.add(zSprite);
      addGlyphLabel(sign.glyph, zSprite.position.clone());

      const hitMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitMesh.position.set(zx, Y_SUPERIMPOSED + 0.08, zz);
      hitMesh.userData = {
        componentId: sign.name,
        title: `${sign.name} (${sign.glyph})`,
        category: 'ZODIAC SIGN',
        detail: `${sign.element} · ${sign.modality} · ${sign.desc}`,
        accent: '#f2ca50',
      };
      dynamicGroup.add(hitMesh);
      interactiveObjectsRef.current.push(hitMesh);
    });

    // 2. HOUSE CUSPS & SPOKES
    (chart.input.birthTimeUnknown ? [] : chart.houseCusps).forEach((h) => {
      const rad = lonToRad(h.lon);
      const isCardo = h.isCardo;
      const houseId = `House ${h.num}`;
      const isSelected = activeSelections.includes(houseId) || activeSelections.includes(h.label);

      const xInner = Math.cos(rad) * R_HOUSE_INNER;
      const zInner = Math.sin(rad) * R_HOUSE_INNER;
      const xOuter = Math.cos(rad) * (R_TORUS_TRACK - R_TORUS_TUBE);
      const zOuter = Math.sin(rad) * (R_TORUS_TRACK - R_TORUS_TUBE);

      const spokeGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(xInner, 0.025, zInner),
        new THREE.Vector3(xOuter, 0.025, zOuter),
      ]);
      const spokeMat = new THREE.LineBasicMaterial({
        color: isSelected ? 0xffdf80 : isCardo ? 0xf2ca50 : 0x7c6999,
        linewidth: isSelected ? 4 : isCardo ? 3 : 1,
        transparent: true,
        opacity: isSelected ? 1.0 : isCardo ? 0.95 : 0.45,
      });
      const spokeLine = new THREE.Line(spokeGeo, spokeMat);
      spokeLine.userData.focused = isSelected;
      dynamicGroup.add(spokeLine);

      // Cusp Badge
      const badgeR = R_TORUS_TRACK - R_TORUS_TUBE - 0.12;
      const badgeX = Math.cos(rad) * badgeR;
      const badgeZ = Math.sin(rad) * badgeR;

      const badgeSprite = createGlyphSprite(
        h.label,
        h.formattedDeg.split(' ')[0],
        isSelected ? '#fff' : isCardo ? '#f2ca50' : '#d4af37',
        isSelected ? 0.35 : isCardo ? 0.3 : 0.24,
        isSelected || isCardo
      );
      badgeSprite.position.set(badgeX, 0.08, badgeZ);
      badgeSprite.userData.targetId = houseId;
      badgeSprite.userData.focused = isSelected;
      dynamicGroup.add(badgeSprite);

      const hitCusp = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitCusp.position.set(badgeX, 0.08, badgeZ);
      hitCusp.userData = {
        componentId: houseId,
        houseName: houseId,
        title: h.title,
        category: isCardo ? 'CARDINAL ANGLE (CARDO)' : 'HOUSE CUSP',
        detail: `${h.desc} · Cusp at ${h.formattedDeg}`,
        accent: isCardo ? '#f2ca50' : '#d4af37',
      };
      dynamicGroup.add(hitCusp);
      interactiveObjectsRef.current.push(hitCusp);

      // House Number in Sector Center
      const nextH = chart.houseCusps.find((nc) => nc.num === (h.num % 12) + 1);
      const nextLon = nextH ? nextH.lon : (h.lon + 30) % 360;
      const span = (nextLon - h.lon + 360) % 360;
      if (isSelected) {
        const sector = new THREE.Mesh(
          new THREE.RingGeometry(R_HOUSE_INNER + 0.03, R_TORUS_TRACK - R_TORUS_TUBE - 0.04, 48, 1, -rad, span * Math.PI / 180),
          new THREE.MeshBasicMaterial({ color: 0xffdf80, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
        );
        sector.name = houseId;
        sector.userData.focused = true;
        sector.rotation.x = -Math.PI / 2;
        sector.position.y = 0.015;
        dynamicGroup.add(sector);
      }
      const midLon = (h.lon + span / 2) % 360;
      const midRad = lonToRad(midLon);

      const hNumR = (R_HOUSE_INNER + R_TORUS_TRACK - R_TORUS_TUBE) / 2;
      const hNumX = Math.cos(midRad) * hNumR;
      const hNumZ = Math.sin(midRad) * hNumR;

      const hCanvas = document.createElement('canvas');
      hCanvas.width = 128;
      hCanvas.height = 128;
      const hCtx = hCanvas.getContext('2d')!;
      hCtx.beginPath();hCtx.arc(64,64,51,0,Math.PI*2);
      hCtx.fillStyle=isSelected?'#634618':'#100c1c';hCtx.fill();
      hCtx.lineWidth=isSelected?7:4;hCtx.strokeStyle=isSelected?'#fff1ac':'#d4af37';hCtx.stroke();
      hCtx.font = 'bold 68px "IBM Plex Mono", monospace';
      hCtx.textAlign = 'center';hCtx.textBaseline = 'middle';
      hCtx.fillStyle = '#fff2bd';hCtx.fillText(h.num.toString(),64,67);

      const hTex = new THREE.CanvasTexture(hCanvas);
      const hMat = new THREE.SpriteMaterial({
        map: hTex,
        transparent: true,
        depthTest: false,
      });
      const hSprite = new THREE.Sprite(hMat);
      hSprite.scale.set(isSelected ? 0.34 : 0.28, isSelected ? 0.34 : 0.28, 1);
      hSprite.position.set(hNumX, 0.04, hNumZ);
      hSprite.userData.focused = isSelected;
      hSprite.userData.targetId = houseId;
      hSprite.userData.orientationAnchor = true;
      hSprite.renderOrder = 20;
      dynamicGroup.add(hSprite);

      const hitSector = new THREE.Mesh(
        new THREE.SphereGeometry(0.19, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitSector.position.set(hNumX, 0.04, hNumZ);
      hitSector.userData = {
        componentId: houseId,
        houseName: houseId,
        title: `House ${h.num} Sector`,
        category: 'HOUSE DOMAIN',
        detail: h.desc,
        accent: '#d4af37',
      };
      dynamicGroup.add(hitSector);
      Object.assign(hSprite.userData, hitSector.userData);
      interactiveObjectsRef.current.push(hSprite, hitSector);
    });

    const endpointLabels: typeof endpointLabelsRef.current = [];
    const addEndpointLabel = (kind: 'NATAL' | 'NOW', name: string, glyph: string, placement: string, point: THREE.Vector3, target: string, persistent: boolean) => {
      if (!showAnnotations || containerRef.current?.closest<HTMLElement>('[data-chart-callout-boundary]')?.dataset.chartInset === 'true') return;
      const element = document.createElement('div');
      const color = kind === 'NOW' ? '#a5f3fc' : '#ffe4a0';
      Object.assign(element.style, { position: 'absolute', top: '0', left: '0', zIndex: '12', pointerEvents: 'none', transformOrigin: '0 0', padding: '5px 8px', boxSizing: 'border-box', background: '#080b16', border: '1px solid ' + color, borderRadius: '7px', color: '#ffffff', fontFamily: 'Arial, sans-serif', fontSize: '13px', lineHeight: '17px', boxShadow: '0 2px 8px #000b' });
      const title = document.createElement('div'); title.textContent = kind + ' · ' + glyph + ' ' + name;
      Object.assign(title.style, { color, fontWeight: '700', whiteSpace: 'nowrap' });
      const detail = document.createElement('div'); detail.textContent = placement;
      Object.assign(detail.style, { color: '#ffffff', whiteSpace: 'normal', fontVariantNumeric: 'tabular-nums' });
      element.append(title, detail);
      const leader = document.createElement('div');
      Object.assign(leader.style, { position: 'absolute', zIndex: '11', pointerEvents: 'none', background: color, transformOrigin: '0 50%', opacity: '0.8' });
      containerRef.current?.append(leader, element);
      element.style.display = leader.style.display = persistent ? '' : 'none';
      endpointLabels.push({ element, leader, point, target, persistent });
    };

    // 3. PLANETARY PLACEMENTS
    const bodyCoordinates: Record<string, { x: number; z: number; rad: number; r: number }> = {};

    chart.natalBodies.forEach((body) => {
      const baseRad = lonToRad(body.lon);
      const adjustedRad = baseRad + (body.clusterAngle || 0);
      const rTrack = R_PLANETS_TRACK - body.tier * 0.13;

      const x = Math.cos(adjustedRad) * rTrack;
      const z = Math.sin(adjustedRad) * rTrack;

      bodyCoordinates[body.name] = { x, z, rad: baseRad, r: rTrack };

      const isSelected = activeSelections.includes(body.name);
      const beadColorInt = parseInt(body.color.replace('#', '0x'), 16);

      // Bold Christmas tree bauble 3D spherical ornament
      const beadRadius = isSelected ? 0.11 : 0.082;
      const beadGeo = new THREE.SphereGeometry(beadRadius, 24, 24);
      const beadMat = new THREE.MeshPhysicalMaterial({
        color: beadColorInt,
        emissive: beadColorInt,
        emissiveIntensity: isSelected ? 0.9 : 0.45,
        roughness: 0.1,
        metalness: 0.88,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
      });
      const bead = new THREE.Mesh(beadGeo, beadMat);
      bead.name = body.name;
      bead.userData.focused = isSelected;
      bead.position.set(x, 0.08, z);
      dynamicGroup.add(bead);

      const uncertainMoon = chart.input.birthTimeUnknown && body.name === 'Moon';
      const sprite = createGlyphSprite(body.glyph, uncertainMoon ? '?' : body.degText, body.color, 0.4, isSelected);
      sprite.position.set(x, 0.36, z);
      dynamicGroup.add(sprite);
      addGlyphLabel(body.glyph, sprite.position.clone());
      addEndpointLabel('NATAL', body.name, body.glyph, uncertainMoon ? 'Birth time needed' : body.fullDegText, new THREE.Vector3(x, 0.36, z), body.name, isSelected);
      bead.userData.targetId = sprite.userData.targetId = body.name;

      const hitPlanet = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 10, 10),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitPlanet.position.set(x, 0.32, z);
      hitPlanet.userData = {
        componentId: body.name,
        selectable: !uncertainMoon,
        planetName: body.name,
        title: `NATAL ${body.glyph} ${body.name} (${uncertainMoon ? 'time uncertain' : body.degText})`,
        category: 'NATAL PLANETARY PLACEMENT',
        detail: chart.input.birthTimeUnknown
          ? (uncertainMoon ? 'The Moon changes position during the day. A birth time is needed for a precise placement.' : `${body.name} · ${body.degText}. Birth time unknown; houses and angles are unavailable. Positions use the reference time.`)
          : body.detail,
        accent: body.color,
      };
      dynamicGroup.add(hitPlanet);
      interactiveObjectsRef.current.push(hitPlanet);
    });

    // Current sky is a separate cyan orbit. Longitudes use the same orientation as
    // natal bodies; radial staggering only separates neighbours, never changes longitude.
    const currentCoordinates: Record<string, THREE.Vector3> = {};
    if (chart.currentSky) {
      const orbit = new THREE.Mesh(
        new THREE.TorusGeometry(2.68, 0.012, 8, 160),
        new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.75 })
      );
      orbit.rotation.x = Math.PI / 2;
      orbit.position.y = 0.08;
      dynamicGroup.add(orbit);
      const placed: number[] = [];
      chart.currentSky.bodies.forEach(body => {
        const rad = lonToRad(body.lon);
        const nearby = placed.filter(lon => Math.abs(((body.lon - lon + 540) % 360) - 180) < 11).length;
        placed.push(body.lon);
        const radius = 2.68 + Math.min(nearby, 2) * 0.24;
        const position = new THREE.Vector3(Math.cos(rad) * radius, 0.10, Math.sin(rad) * radius);
        currentCoordinates[body.target] = position;
        const focused = activeSelections.includes(body.target);
        const bead = new THREE.Mesh(
          new THREE.SphereGeometry(focused ? 0.11 : 0.075, 20, 16),
          new THREE.MeshPhysicalMaterial({ color: 0x8aefff, emissive: 0x26cde2, emissiveIntensity: focused ? 1.1 : 0.5, metalness: 0.5, roughness: 0.18 })
        );
        bead.position.copy(position); bead.userData.focused = focused; dynamicGroup.add(bead);
        let sprite: THREE.Sprite;
        if (!showAnnotations) {
          sprite = createGlyphSprite(body.glyph, '', '#67e8f9', 0.34, focused);
        } else {
          const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 152;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#062b38'; ctx.strokeStyle = focused ? '#e0fcff' : '#67e8f9'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.roundRect(5, 5, 310, 142, 22); ctx.fill(); ctx.stroke();
          ctx.textAlign = 'center'; ctx.fillStyle = '#c7faff';
          ctx.font = 'bold 48px Arial'; ctx.fillText('NOW ' + body.glyph, 160, 66);
          ctx.font = 'bold 34px Arial'; ctx.fillText(body.name, 160, 116);
          sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }));
          sprite.scale.set(focused ? 0.72 : 0.62, focused ? 0.342 : 0.295, 1);
        }
        sprite.position.copy(position); sprite.position.y = 0.37;
        sprite.userData.focused = focused; dynamicGroup.add(sprite);
        addGlyphLabel(body.glyph, sprite.position.clone());
        addEndpointLabel('NOW', body.name, body.glyph, body.fullDegText, sprite.position.clone(), body.target, focused);
        bead.userData.targetId = sprite.userData.targetId = body.target;
        const hit = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.copy(sprite.position);
        hit.userData = {
          componentId: body.target, planetName: body.target,
          title: 'NOW ' + body.glyph + ' ' + body.name + ' · ' + body.fullDegText,
          category: 'CURRENT SKY · ' + chart.currentSky!.observedAt,
          detail: body.name + ' in the observed current sky. ' + body.fullDegText + '. This is separate from the natal placement.', accent: '#67e8f9',
        };
        dynamicGroup.add(hit); interactiveObjectsRef.current.push(hit);
      });
    }

    // Tube geometry makes focus width reliable in WebGL (native line widths are
    // commonly fixed at one pixel). Curved close conjunctions remain visible.
    type VisibleAspect = { name: string; from: string; to: string; type: 'Conjunction' | 'Sextile' | 'Square' | 'Trine' | 'Opposition'; color: number; colorHex: string; detail: string };
    const hoverAspects = new Map<string, { group: THREE.Group; targets: string[] }>();
    const addAspect = (asp: VisibleAspect, from: THREE.Vector3, to: THREE.Vector3, transit: boolean) => {
      const selected = activeSelections.includes(asp.name);
      const aspectColor = transit ? ({ Conjunction: 0xd8b4fe, Sextile: 0x38bdf8, Square: 0xff5555, Trine: 0x2563eb, Opposition: 0xff3b3b }[asp.type]) : asp.color;
      const midpoint = from.clone().add(to).multiplyScalar(0.5);
      let curve: THREE.Curve<THREE.Vector3> = new THREE.LineCurve3(from, to);
      if (from.distanceTo(to) < 0.45) {
        const outward = midpoint.clone().setY(0).normalize().multiplyScalar(0.42);
        const control = midpoint.clone().add(outward); control.y += 0.20;
        curve = new THREE.QuadraticBezierCurve3(from, control, to);
      }
      const lineMaterial = transit
        ? new THREE.LineDashedMaterial({ color: 0x67e8f9, transparent: true, opacity: selected ? 1 : 0.6, dashSize: 0.09, gapSize: 0.055, depthTest: false })
        : new THREE.LineBasicMaterial({ color: asp.color, transparent: true, opacity: selected ? 1 : 0.6, depthTest: false });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), lineMaterial);
      if (transit) line.computeLineDistances();
      line.name = asp.name; line.userData.focused = selected; line.renderOrder = 3; dynamicGroup.add(line);
      const tube = (path: THREE.Curve<THREE.Vector3>, radius: number, color: number, opacity: number) => {
        const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, 32, radius, 8, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false }));
        mesh.name = asp.name; mesh.userData.focused = selected; mesh.renderOrder = 4; dynamicGroup.add(mesh);
      };
      if (selected) {
        if (asp.type === 'Square') {
          // Layered translucent tubes give the whole square a soft red halo;
          // WebGL's one-pixel lines disappear on dense phone-sized charts.
          tube(curve, 0.090, 0xff5555, 0.07);
          tube(curve, 0.065, 0xff5555, 0.13);
          tube(curve, 0.044, 0xff5555, 0.25);
          tube(curve, 0.025, 0xff7373, 1);
        }
        if (transit) {
          const segments = Math.max(3, Math.ceil(curve.getLength() / 0.18));
          for (let index = 0; index < segments; index++) {
            const start = index / segments, finish = Math.min(1, (index + 0.64) / segments);
            const dash = new THREE.CatmullRomCurve3([curve.getPoint(start), curve.getPoint((start + finish) / 2), curve.getPoint(finish)]);
            tube(dash, asp.type === 'Square' ? 0.010 : 0.028, 0x83f1ff, 1);
          }
          // A shorter central accent identifies aspect type without confusing the cyan NOW connection.
          const accent = new THREE.CatmullRomCurve3([curve.getPoint(0.43), curve.getPoint(0.5), curve.getPoint(0.57)]);
          tube(accent, 0.038, aspectColor, 1);
        } else if (asp.type !== 'Square') {
          tube(curve, 0.038, 0xffe6a5, 0.4);
          tube(curve, 0.023, asp.color, 1);
        }
        // Endpoint rings clarify the precise pair, even beneath sharp glyphs.
        [from, to].forEach(point => {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 8, 32), new THREE.MeshBasicMaterial({ color: transit ? 0x9df5ff : 0xffdf80, depthTest: false }));
          ring.rotation.x = Math.PI / 2; ring.position.copy(point); ring.userData.focused = true; ring.renderOrder = 5; dynamicGroup.add(ring);
        });
      }
      // Pick the actual curve along its entire length, rather than disjoint spheres.
      line.userData = { ...line.userData, componentId: asp.name, aspectName: asp.name, title: asp.name, category: transit ? 'CURRENT SKY → NATAL ASPECT' : 'NATAL GEOMETRIC ASPECT', detail: asp.detail, accent: transit ? '#67e8f9' : asp.colorHex };
      interactiveObjectsRef.current.push(line);
      const hoverGroup = new THREE.Group(); hoverGroup.visible = false;
      const addHoverPath = (path: THREE.Curve<THREE.Vector3>) => {
        const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, 24, 0.032, 8, false), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false }));
        mesh.userData.focused = true; mesh.renderOrder = 7; hoverGroup.add(mesh);
      };
      if (transit) {
        const count = Math.max(3, Math.ceil(curve.getLength() / 0.18));
        for (let i = 0; i < count; i++) addHoverPath(new THREE.CatmullRomCurve3([curve.getPoint(i / count), curve.getPoint((i + 0.32) / count), curve.getPoint(Math.min(1, (i + 0.64) / count))]));
      } else addHoverPath(curve);
      [from, to].forEach(point => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.025, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false }));
        ring.rotation.x = Math.PI / 2; ring.position.copy(point); ring.userData.focused = true; ring.renderOrder = 8; hoverGroup.add(ring);
      });
      dynamicGroup.add(hoverGroup); hoverAspects.set(asp.name, { group: hoverGroup, targets: [asp.from, asp.to] });
    };
    chart.aspectChords.filter(a => !chart.input.birthTimeUnknown || (a.from !== 'Moon' && a.to !== 'Moon')).forEach(asp => {
      const from = bodyCoordinates[asp.from], to = bodyCoordinates[asp.to];
      if (from && to) addAspect(asp, new THREE.Vector3(from.x, 0.10, from.z), new THREE.Vector3(to.x, 0.10, to.z), false);
    });
    chart.currentSky?.aspects.forEach(asp => {
      const from = currentCoordinates[asp.from], to = bodyCoordinates[asp.to];
      if (from && to) addAspect(asp, from.clone(), new THREE.Vector3(to.x, 0.10, to.z), true);
    });
    endpointLabelsRef.current = endpointLabels;
    glyphLabelsRef.current = glyphLabels;
    // Structural frame meshes are exempt and stay vivid at their recorded
    // focusBaseOpacity; only non-focused representational elements dim.
    const focusActive = activeSelections.length > 0;
    wheelGroupRef.current?.traverse(object => {
      const item = object as THREE.Mesh;
      const list = item.material ? (Array.isArray(item.material) ? item.material : [item.material]) : [];
      list.forEach(material => {
        if (!material.visible) return;
        if (material.userData.focusBaseOpacity === undefined) {
          material.userData.focusBaseOpacity = material.opacity;
          material.userData.focusBaseTransparent = material.transparent;
        }
        material.transparent = focusActive || material.userData.focusBaseTransparent;
        material.opacity = material.userData.focusBaseOpacity * (focusActive && !object.userData.focused && !object.userData.orientationAnchor && !object.userData.structureFrame ? CHART_FOCUS.dim : 1);
        material.needsUpdate = true;
      });
    });
    let currentHover: string | null = null;
    const applyHover = (name: string | null) => {
      if (name === currentHover) return;
      currentHover = name;
      const targets = new Set(name ? hoverAspects.get(name)?.targets || [name] : []);
      const endpointTargets = new Set(name ? hoverAspects.get(name)?.targets || [] : []);
      const inset = containerRef.current?.closest<HTMLElement>('[data-chart-callout-boundary]')?.dataset.chartInset === 'true';
      hoverAspects.forEach((entry, key) => { entry.group.visible = key === name; });
      endpointLabels.forEach(label => {
        label.element.style.display = label.leader.style.display = !inset && showAnnotationsRef.current && (label.persistent || endpointTargets.has(label.target)) ? '' : 'none';
        label.element.style.borderStyle = !label.persistent && endpointTargets.has(label.target) ? 'dashed' : 'solid';
      });
      dynamicGroup.traverse(object => {
        if (!object.userData.targetId) return;
        if (object instanceof THREE.Sprite) {
          if (!object.userData.hoverBaseScale) object.userData.hoverBaseScale = object.scale.clone();
          object.scale.copy(object.userData.hoverBaseScale).multiplyScalar(inset && targets.has(object.userData.targetId) ? 1.12 : 1);
        }
        const item = object as THREE.Mesh;
        const materials = item.material ? (Array.isArray(item.material) ? item.material : [item.material]) : [];
        materials.forEach(material => {
          material.opacity = material.userData.focusBaseOpacity * (focusActive && !object.userData.focused && !targets.has(object.userData.targetId) && !object.userData.structureFrame ? CHART_FOCUS.dim : 1);
        });
      });
    };
    setAspectHoverRef.current = applyHover;
    // Soft radial halos are separate from the sharp glyph canvases.
    const focusedSprites = dynamicGroup.children.filter(object => object instanceof THREE.Sprite && object.userData.focused) as THREE.Sprite[];
    if (focusedSprites.length) {
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      const gradient = ctx.createRadialGradient(64, 64, 14, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(255,225,148,0)');
      gradient.addColorStop(.37, 'rgba(255,219,125,.28)');
      gradient.addColorStop(.57, 'rgba(255,211,115,.68)');
      gradient.addColorStop(1, 'rgba(218,160,255,0)');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
      const texture = new THREE.CanvasTexture(canvas);
      focusedSprites.forEach(subject => {
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, opacity: CHART_FOCUS.steadyHalo });
        const halo = new THREE.Sprite(material);
        halo.position.copy(subject.position);
        halo.scale.set(subject.scale.x * 1.75, subject.scale.y * 1.75, 1);
        halo.renderOrder = 1; subject.renderOrder = 2;
        halo.userData.focused = true;
        dynamicGroup.add(halo); haloMaterialsRef.current.push(material);
      });
    }
    if (rendererTierRef.current === 3 && sceneRef.current) hideTier3Sprites(sceneRef.current);
    wakeRendererRef.current();
    return () => {
      if (setAspectHoverRef.current === applyHover) setAspectHoverRef.current = () => {};
      endpointLabels.forEach(({ element, leader }) => { element.remove(); leader.remove(); });
      if (endpointLabelsRef.current === endpointLabels) endpointLabelsRef.current = [];
      glyphLabels.forEach(({ element }) => { element.remove(); });
      if (glyphLabelsRef.current === glyphLabels) glyphLabelsRef.current = [];
      dynamicGroup.traverse(object => {
        const renderable = object as THREE.Mesh;
        renderable.geometry?.dispose();
        const materials = renderable.material ? (Array.isArray(renderable.material) ? renderable.material : [renderable.material]) : [];
        materials.forEach(material => {
          (material as THREE.SpriteMaterial).map?.dispose();
          material.dispose();
        });
      });
      dynamicGroup.clear();
    };
  }, [chart, activeSelections, showAnnotations, layoutKey]);

  return (
    <div
      ref={containerRef}
      id="threejs-container-ANIMATION_71"
      className="absolute inset-0 w-full h-full bg-transparent pointer-events-auto"
    />
  );
};
