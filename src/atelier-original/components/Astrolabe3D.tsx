import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { SVGRenderer } from 'three/examples/jsm/renderers/SVGRenderer.js';
import { CHART_FOCUS, chartHaloOpacity } from '../services/chartFocusVisuals';
import { bindTorusTouch, getTorusZoomDistance } from '../services/torusGestures';
import { placeChartCallout } from './chartCalloutPlacement';
import { NatalChartResult, ZODIAC_SIGNS } from '../services/ephemeris';
import { beginInteractionEpisode, chartAnalyticsTarget, trackInteraction } from '../services/interactionAnalytics';

type AstrolabeRenderer = THREE.WebGLRenderer | SVGRenderer;

// Deliberate local additions (§16.12 pending AUDIT-CHART): the legibility
// floor for every glyph and label sprite on the wheel. Textures are drawn at
// 256 logical px × devicePixelRatio (never upscaled into sampling blur), and
// sprites are held to a minimum on-screen CSS-pixel size derived each frame
// from the renderer's own pixel size — so nothing shrinks with the canvas,
// and nothing is ever darker or blurrier than before.
const LABEL_TEXTURE_CSS_PX = 256;
const MIN_GLYPH_CSS_PX = 12;
const MIN_DEGREE_CSS_PX = 11;
const GLYPH_FACE_FRACTION = 0.72; // glyph face height as a fraction of the sprite
const DEGREE_FACE_FRACTION = 0.22; // degree/subtext face height as a fraction of the sprite
const HOUSE_NUMBER_FACE_FRACTION = 0.58; // house numeral face height as a fraction of the sprite
const labelDevicePixelRatio = () => Math.max(1, window.devicePixelRatio || 1);
// Saturated sign-bauble fills by element (AUDIT-CHART): a dark, outlined
// glyph on a bright saturated disc reads at every inset size — pale-on-pale
// did not.
const SIGN_ELEMENT_FILL: Record<string, string> = {
  Fire: '#ff6a3d',
  Earth: '#46c26a',
  Air: '#54a8ff',
  Water: '#35c3f2',
};

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
  onComponentTap?: (target: string) => void;
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
  onComponentTap,
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
  // Deliberate local additions (§16.12 pending AUDIT-CHART): a tapped aspect
  // owns the wheel's highlight until something else is tapped — the shell's
  // spoken echo may lag or omit the aspect, but the operator sees the line
  // and both its bodies light up on the tap itself.
  const [localAspectFocus, setLocalAspectFocus] = useState<string | null>(null);
  // Every glyph/label sprite with its on-screen minimum, re-clamped each
  // frame by the render loop (AUDIT-CHART).
  const sizedSpritesRef = useRef<Array<{ sprite: THREE.Sprite; minCssPx: number }>>([]);
  // AUDIT2-CHART: movable labels (degree text, house numbers, cusp badges)
  // and fixed glyph obstacles for the per-frame screen-space declutter. A
  // colliding label steps along its own radius until its screen box clears
  // every glyph and every label placed before it — so degree text sits
  // radially outward of its body and clustered bodies stagger, at every
  // wheel angle, zoom and inset size.
  const declutterRef = useRef<{
    movables: Array<{
      sprite: THREE.Sprite;
      origin: THREE.Vector3;
      axis: THREE.Vector3;
      offsets: number[];
      current: number;
    }>;
    obstacles: Array<{ object: THREE.Object3D; radius: number }>;
  } | null>(null);
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
    if (!highlightedComponents.length && !selectedComponents.length && !selectedPlanetName) setLocalAspectFocus(null);
    wakeRendererRef.current();
  }, [focusSequence]);
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
    const localFocus = localAspectFocus ? [localAspectFocus] : [];
    const seeds = highlightedComponents.length ? [
      ...highlightedComponents, ...localFocus,
    ] : [
      ...selectedComponents, ...(selectedPlanetName ? [selectedPlanetName] : []), ...localFocus,
    ];
    // Deliberate local addition (§16.12 pending INSET): highlightedComponents
    // arrives as interface target names ("Sun trine Moon", "now Mars square
    // Venus", "now Mars"), which must highlight the same objects the frozen
    // ids do. Resolve each name against the chart; anything unrecognized
    // passes through unchanged so the presentation rail's own ids keep working.
    const chordIdsByTargetName = new Map<string, string>();
    chart.aspectChords.forEach(a => chordIdsByTargetName.set(`${a.from} ${a.type.toLowerCase()} ${a.to}`, a.name));
    chart.currentSky?.aspects.forEach(a => {
      const transitBody = chart.currentSky?.bodies.find(body => body.target === a.from);
      if (transitBody) chordIdsByTargetName.set(`now ${transitBody.name} ${a.type.toLowerCase()} ${a.to}`, a.name);
    });
    const selected = new Set<string>();
    seeds.forEach(seed => {
      const chordId = chordIdsByTargetName.get(seed);
      if (chordId) { selected.add(chordId); return; }
      const nowBody = chart.currentSky?.bodies.find(body => `now ${body.name}` === seed);
      selected.add(nowBody ? nowBody.target : seed);
    });
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
  }, [chart, selectedComponents.join('\0'), selectedPlanetName, highlightedComponents.join('\0'), localAspectFocus]);
  const activeSelectionsRef = useRef(activeSelections);
  activeSelectionsRef.current = activeSelections;
  const toggleComponentRef = useRef(onToggleComponent);
  toggleComponentRef.current = onToggleComponent;
  const componentTapRef = useRef(onComponentTap);
  componentTapRef.current = onComponentTap;
  // Deliberate local addition (§16.12 pending INSET). The shell speaks
  // interface target names — bodies "Sun", current-sky bodies "now Mars",
  // natal aspects "Sun trine Moon", now↔natal "now Mars square Venus" — while
  // this scene's ids are the frozen port's symbol-decorated chord names
  // ("Sun △ Moon (120°)") and timestamped Now-targets ("Now Mars @ …").
  // A tapped hit resolves to its interface name from the chart itself; ids
  // that already match the vocabulary (bodies, signs, houses) pass through,
  // and an unresolvable hit reports nothing rather than a made-up name.
  const componentTapNameRef = useRef<(data: THREE.Object3D['userData']) => string | null>(() => null);
  componentTapNameRef.current = (data) => {
    const aspectName = typeof data.aspectName === 'string' ? data.aspectName : '';
    if (aspectName) {
      const natal = chart.aspectChords.find(a => a.name === aspectName);
      if (natal) return `${natal.from} ${natal.type.toLowerCase()} ${natal.to}`;
      const transit = chart.currentSky?.aspects.find(a => a.name === aspectName);
      const transitBody = transit ? chart.currentSky?.bodies.find(body => body.target === transit.from) : undefined;
      if (transit && transitBody) return `now ${transitBody.name} ${transit.type.toLowerCase()} ${transit.to}`;
      return null;
    }
    const id = data.componentId || data.planetName || data.houseName;
    if (typeof id !== 'string' || !id) return null;
    const nowBody = chart.currentSky?.bodies.find(body => body.target === id);
    return nowBody ? `now ${nowBody.name}` : id;
  };
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
      cameraRef.current.userData.manualZoom = 1;
      resizeRendererRef.current();
      velocityYRef.current = 0.00022;
      velocityXRef.current = 0;
    }
  }, [resetTrigger]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initialBounds = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(initialBounds.width || container.clientWidth));
    const height = Math.max(1, Math.round(initialBounds.height || container.clientHeight));

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 6.8, 6.2);
    camera.lookAt(0, -0.15, 0);
    cameraRef.current = camera;

    const { renderer, tier } = createAstrolabeRenderer(forceSoftware);
    const webglRenderer = tier === 3 ? null : (renderer as THREE.WebGLRenderer);
    if (webglRenderer) webglRenderer.setPixelRatio(labelDevicePixelRatio());
    if (webglRenderer) webglRenderer.setSize(width, height, false);
    else renderer.setSize(width, height);
    Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' });
    if (webglRenderer) {
      webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      webglRenderer.toneMappingExposure = 1.15;
    }
    // The polished torus needs a bright source to reflect; direct lamps alone
    // left its metal inner shoulder black. This is an actual environment
    // reflection, while glyph materials keep their authored colours.
    let reflectionTarget: THREE.WebGLRenderTarget | null = null;
    if (webglRenderer) {
      const environmentCanvas = document.createElement('canvas');
      environmentCanvas.width = 1024; environmentCanvas.height = 512;
      const context = environmentCanvas.getContext('2d')!;
      context.fillStyle = '#65556f'; context.fillRect(0, 0, 1024, 512);
      const sun = context.createRadialGradient(270, 155, 10, 270, 155, 160);
      sun.addColorStop(0, '#ffffff'); sun.addColorStop(0.12, '#fff9df');
      sun.addColorStop(0.36, '#d8b67f'); sun.addColorStop(1, 'rgba(216,182,127,0)');
      context.fillStyle = sun; context.fillRect(0, 0, 1024, 512);
      context.fillStyle = '#f5e8d6'; context.fillRect(650, 90, 150, 22);
      const source = new THREE.CanvasTexture(environmentCanvas);
      source.mapping = THREE.EquirectangularReflectionMapping;
      source.colorSpace = THREE.SRGBColorSpace;
      const generator = new THREE.PMREMGenerator(webglRenderer);
      reflectionTarget = generator.fromEquirectangular(source);
      scene.environment = reflectionTarget.texture;
      source.dispose(); generator.dispose();
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
      color: 0x4c3568,
      emissive: 0x11071c,
      roughness: 0.16,
      metalness: 0.88,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      reflectivity: 0.95,
      ior: 1.55,
      envMapIntensity: 1.6,
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
    // Deliberate local addition (§16.12 pending AUDIT-CHART): the hovered
    // element's own world hit point and extent anchor the callout, so it can
    // sit clear of the element with a visible gap instead of on top of it.
    let hoverAnchor: { point: THREE.Vector3; extent: number } | null = null;
    const boundary = container.closest<HTMLElement>('[data-chart-callout-boundary]');
    const isInset = () => boundary?.dataset.chartInset === 'true';
    const dismissHover = () => {
      hoverTarget = null;hoverPointer = null;hoverAnchor = null;isHovered = false;
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

    // Deliberate local addition (§16.12 pending INSET): a click or tap on a
    // hovered component reports the hit to the shell by its interface target
    // name, and the shell swaps the view and speaks (§4) — instead of
    // selection only. Callers run inside the drag-guarded click/tap paths, so
    // a rotation never reports. Telemetry keeps the frozen internal ids.
    const reportComponentTap = (
      data: THREE.Object3D['userData'],
      inputMethod: string,
      isTrusted: boolean
    ): boolean => {
      const report = componentTapRef.current;
      if (!report) return false;
      const name = componentTapNameRef.current(data);
      if (!name) return false;
      // AUDIT-CHART: a tapped aspect owns the wheel's highlight (the line and
      // both its bodies, via activeSelections) until something else is tapped;
      // a tapped non-aspect releases it.
      if (data.aspectName) setLocalAspectFocus(previous => (previous === name ? null : name));
      else setLocalAspectFocus(null);
      const analytics = chartAnalyticsTarget(data.componentId || data.planetName || data.houseName || data.aspectName || '');
      if (isTrusted && analytics) trackInteraction('chart_item_select', {
        ...analytics, activity_kind: 'education', response_mode: 'no_response', entry_point: 'chart_object',
        input_method: inputMethod,
      });
      report(name);
      return true;
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
      // AUDIT-CHART: hand the placement helper a point derived from the
      // hovered element's projected screen extent, not the raw pointer — the
      // callout then sits one visible gap beyond the element, on the side
      // with room inside the pane.
      let placePoint = hoverPointer;
      if (hoverAnchor) {
        const projected = hoverAnchor.point.clone().project(camera);
        const centerX = (projected.x + 1) * rect.width / 2 + rect.left;
        const centerY = (1 - projected.y) * rect.height / 2 + rect.top;
        const distance = camera.position.distanceTo(hoverAnchor.point);
        const pxPerWorld = distance > 0
          ? rect.height / (2 * distance * Math.tan((camera.fov * Math.PI) / 360))
          : 0;
        if (pxPerWorld > 0) {
          const gap = Math.max(12, hoverAnchor.extent * pxPerWorld + 6);
          const cardHeight = tooltipEl.offsetHeight || 110;
          const roomAbove = centerY - gap - cardHeight >= rect.top;
          placePoint = { x: centerX, y: roomAbove ? centerY - gap : centerY + gap };
        }
      }
      if (!placeChartCallout(tooltipEl, placePoint, isInset() && boundary ? boundary.getBoundingClientRect() : null)) dismissHover();
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
        // AUDIT-CHART: remember what is being described, not just where the
        // pointer sits, so the callout can keep a gap off of it.
        hoverAnchor = {
          point: intersects[0].point.clone(),
          extent: intersects[0].object instanceof THREE.Sprite
            ? Math.max(intersects[0].object.scale.x, intersects[0].object.scale.y) * 0.5
            : intersects[0].object.userData.aspectName ? 0.1 : 0.26,
        };
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
      camera.userData.manualZoom = camera.position.length() / (camera.userData.frameDistance || camera.position.length());
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
          if (reportComponentTap(data, inputMethod, event.isTrusted)) return;
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

      // A click over a hovered component reports to the shell (swap + speak,
      // §4) before bare activation or selection. Without onComponentTap the
      // frozen path below is untouched.
      if (componentTapRef.current) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hitData = pickChartTargets()[0]?.object.userData;
        if (hitData && hitData.selectable !== false) {
          const pointerType = (event as PointerEvent).pointerType;
          const inputMethod = pointerType === 'touch' ? 'touch'
            : pointerType === 'mouse' || pointerType === 'pen' ? 'pointer'
            : event.detail > 0 ? observedInput : 'unknown';
          if (reportComponentTap(hitData, inputMethod, event.isTrusted)) return;
        }
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
          if (reportComponentTap(data, 'touch', event.isTrusted)) {
            activatedTouchUntil = Date.now() + 700;
            if (event.cancelable) event.preventDefault();
            return;
          }
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
      // Foreground touch taps report the same way mouse clicks do; without
      // onComponentTap the activation-only path below is untouched.
      if (componentTapRef.current) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hitData = pickChartTargets()[0]?.object.userData;
        if (hitData && hitData.selectable !== false && reportComponentTap(hitData, 'touch', event.isTrusted)) {
          activatedTouchUntil = Date.now() + 700;
          if (event.cancelable) event.preventDefault();
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
    const sizedSpriteWorld = new THREE.Vector3();
    const declutterWorld = new THREE.Vector3();
    const renderSize = new THREE.Vector2(width, height);
    let renderDpr = labelDevicePixelRatio();
    const syncRenderSize = (bounds: DOMRect) => {
      const w = Math.round(bounds.width), h = Math.round(bounds.height);
      if (w <= 0 || h <= 0) return;
      const dpr = labelDevicePixelRatio();
      camera.aspect = w / h;
      const frameDistance = (scene.userData.wheelRadius || 2.75) * 1.08 / (Math.sin(camera.fov * Math.PI / 360) * Math.min(1, camera.aspect));
      camera.userData.frameDistance = frameDistance;
      camera.position.set(0, 6.8, 6.2).normalize().multiplyScalar(frameDistance * (camera.userData.manualZoom || 1));
      camera.lookAt(0, -0.15, 0);
      camera.updateProjectionMatrix();
      if (renderSize.x === w && renderSize.y === h && renderDpr === dpr) return;
      if (webglRenderer) {
        webglRenderer.setPixelRatio(dpr);
        webglRenderer.setSize(w, h, false);
      } else renderer.setSize(w, h);
      renderSize.set(w, h);
      renderDpr = dpr;
    };
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
      const bounds = container.getBoundingClientRect();
      // CSS transforms change the displayed box without changing clientWidth.
      // Keep the backing pixels matched throughout the pane transition.
      syncRenderSize(bounds);
      if (!reducedMotionRef.current) {
        const sunAngle = performance.now() / 17000;
        glintPoint1.position.set(Math.cos(sunAngle) * 4, 6, Math.sin(sunAngle) * 4);
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

      // Deliberate local addition (§16.12 pending AUDIT-CHART): every glyph
      // and label sprite is held to its minimum on-screen size, measured from
      // the renderer's actual pixel size each frame — zoom, the pane swap and
      // inset resizes all re-derive it, so symbols never shrink with the
      // canvas into illegibility and never grow blurrier than their texture.
      if (bounds.height > 0) {
        const halfFovTan = Math.tan((camera.fov * Math.PI) / 360);
        sizedSpritesRef.current.forEach(({ sprite, minCssPx }) => {
          if (tier === 3) { sprite.visible = false; return; }
          const compact = bounds.width < 440;
          const visibilityWidth = sprite.userData.visibilityWidth || 0;
          sprite.visible = bounds.width >= visibilityWidth || sprite.userData.focused;
          if (!sprite.visible) return;
          const map = compact ? sprite.userData.compactTexture : sprite.userData.detailTexture;
          if (map && sprite.material.map !== map) { sprite.material.map = map; sprite.material.needsUpdate = true; }
          const base = sprite.userData.baseScale as THREE.Vector3 | undefined;
          if (!base || !sprite.parent) return;
          sprite.getWorldPosition(sizedSpriteWorld);
          const distance = camera.position.distanceTo(sizedSpriteWorld);
          if (distance <= 0) return;
          const pxPerWorld = bounds.height / (2 * distance * halfFovTan);
          const boost = typeof sprite.userData.hoverScaleFactor === 'number' ? sprite.userData.hoverScaleFactor : 1;
          const onScreenPx = base.y * boost * pxPerWorld;
          if (onScreenPx <= 0) return;
          const minimum = compact && sprite.userData.compactTexture
            ? (bounds.width < 160 ? 6 : bounds.width < 240 ? 9 : 11) / GLYPH_FACE_FRACTION
            : sprite.userData.minimumTextCss ? sprite.userData.minimumTextCss * 2
            : compact ? Math.min(minCssPx, bounds.width < 160 ? 8 : 13) : minCssPx;
          const floor = Math.max(1, minimum / onScreenPx);
          sprite.scale.set(base.x * boost * floor, base.y * boost * floor, 1);
          const marker = sprite.userData.markerMesh as THREE.Mesh | undefined;
          if (marker) marker.scale.setScalar(Math.max(1, sprite.scale.y / base.y));
        });
      }
      // AUDIT2-CHART: degree labels, house numbers and cusp badges never sit
      // on a glyph or each other. Their screen boxes are tested against every
      // fixed glyph and each previously placed label; a colliding label steps
      // along its own radius (outward for degree text, staggering clustered
      // bodies) until it clears. The wheel is rigid, so a chosen offset holds
      // steady; the lerp only eases transitions when the view changes.
      const declutter = declutterRef.current;
      if (declutter && bounds.height > 0 && declutter.movables.length) {
        const fovTan = Math.tan((camera.fov * Math.PI) / 360);
        const boxOf = (object: THREE.Object3D, halfWidth: number, halfHeight: number) => {
          object.updateWorldMatrix(true, false);
          const world = object.getWorldPosition(declutterWorld);
          const distance = camera.position.distanceTo(world);
          const pxPerWorld = distance > 0 ? bounds.height / (2 * distance * fovTan) : 0;
          const projected = world.project(camera);
          return {
            x: (projected.x + 1) * bounds.width / 2,
            y: (1 - projected.y) * bounds.height / 2,
            hw: halfWidth * pxPerWorld,
            hh: halfHeight * pxPerWorld,
          };
        };
        const overlaps = (a: { x: number; y: number; hw: number; hh: number }, b: { x: number; y: number; hw: number; hh: number }) =>
          Math.abs(a.x - b.x) < a.hw + b.hw + 2 && Math.abs(a.y - b.y) < a.hh + b.hh + 2;
        const placed = declutter.obstacles.filter(entry => entry.object.visible).map(entry => {
          const sprite = entry.object as THREE.Sprite;
          return sprite.isSprite
            ? boxOf(entry.object, sprite.scale.x / 2, sprite.scale.y / 2)
            : boxOf(entry.object, entry.radius, entry.radius);
        });
        declutter.movables.forEach(movable => {
          if (!movable.sprite.visible) return;
          let target = movable.offsets[movable.offsets.length - 1];
          let targetBox: { x: number; y: number; hw: number; hh: number } | null = null;
          for (const offset of movable.offsets) {
            movable.sprite.position.copy(movable.origin).addScaledVector(movable.axis, offset);
            const box = boxOf(movable.sprite, movable.sprite.scale.x / 2, movable.sprite.scale.y / 2);
            if (!placed.some(other => overlaps(box, other))) { target = offset;targetBox = box;break; }
          }
          // The tested box must be the box actually drawn this frame; easing
          // a label through another label made the valid target still overlap.
          movable.current = target;
          movable.sprite.position.copy(movable.origin).addScaledVector(movable.axis, movable.current);
          // If there is no collision-free slot, details wait for focus or
          // selection instead of piling up or drifting outside the wheel.
          movable.sprite.visible = Boolean(targetBox);
          if (targetBox) placed.push(targetBox);
        });
      }
      renderFrame();
      refreshCallout();
      // HTML text retains real screen-pixel size when the whole chart becomes the inset.
      // It sits above the WebGL halo rather than being blurred into its texture.
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

    const handleResize = () => {
      dismissHover();
      if (disposed || contextLost) return;
      syncRenderSize(container.getBoundingClientRect());
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
      scene.environment = null;
      reflectionTarget?.dispose();
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
    if (sceneRef.current) sceneRef.current.userData.wheelRadius = chart.currentSky ? 3.5 : 2.75;

    while (dynamicGroup.children.length > 0) {
      const child = dynamicGroup.children[0];
      dynamicGroup.remove(child);
    }
    interactiveObjectsRef.current = [];
    haloMaterialsRef.current = [];
    sizedSpritesRef.current = [];

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
    // AUDIT-CHART: every authored label sprite registers here with its
    // on-screen minimum; the render loop holds each to it.
    const sizedLabels: Array<{ sprite: THREE.Sprite; minCssPx: number }> = [];
    // AUDIT2-CHART: registries for the per-frame label declutter (see the
    // render loop). Glyphs, beads and sign baubles are fixed obstacles; the
    // movable labels dodge them along their own radii.
    const declutterMovables: NonNullable<typeof declutterRef.current>['movables'] = [];
    const declutterObstacles: NonNullable<typeof declutterRef.current>['obstacles'] = [];
    function createGlyphSprite(
      text: string,
      _subText: string,
      _colorHex: string,
      scale = 0.24,
      isHighlighted = false,
      earthSymbol = false
    ): THREE.Sprite {
      const dpr = labelDevicePixelRatio();
      const S = LABEL_TEXTURE_CSS_PX;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.miterLimit = 2;
      // Only the crisp glyph is painted. Its dark jewel is actual lit 3D
      // geometry, so neither compact nor focused views become flat stickers.
      const ink = isHighlighted ? '#fffbd3' : '#fff4da';
      if (earthSymbol) {
        const pass = (color: string, width: number) => {
          ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
          ctx.arc(128, 128, 66, 0, Math.PI * 2);
          ctx.moveTo(44, 128); ctx.lineTo(212, 128);
          ctx.moveTo(128, 62); ctx.lineTo(128, 194); ctx.stroke();
        };
        pass('#08040f', 20); pass(ink, 9);
      } else {
        ctx.font = 'bold 184px "Segoe UI Symbol", "Noto Sans Symbols 2", "DejaVu Sans", serif';
        ctx.lineWidth = 12; ctx.strokeStyle = '#08040f';
        ctx.strokeText(text, 128, 138, 220);
        ctx.fillStyle = ink; ctx.fillText(text, 128, 138, 220);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture, transparent: true, depthTest: false, toneMapped: false,
      }));
      const finalScale = isHighlighted ? scale * 1.1 : scale;
      sprite.scale.set(finalScale, finalScale, 1);
      sprite.userData.baseScale = sprite.scale.clone();
      sprite.userData.focused = isHighlighted;
      sprite.userData.crispLabel = true;
      sprite.userData.detailTexture = texture;
      sprite.userData.compactTexture = texture;
      sprite.userData.minCssPx = MIN_GLYPH_CSS_PX / GLYPH_FACE_FRACTION;
      sizedLabels.push({ sprite, minCssPx: sprite.userData.minCssPx });
      return sprite;
    }
    // AUDIT2-CHART: a body's degree readout is its own label, offset
    // radially outward from the body — never printed inside the glyph sprite,
    // where it piled onto glyphs and neighbouring degree text. Same texture
    // density and the same ≥ 11 CSS px floor as every other label.
    function createDegreeLabel(text: string, highlighted = false): THREE.Sprite {
      const dpr = labelDevicePixelRatio();
      const W = 232, H = 112;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);
      ctx.font = 'bold 56px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.lineWidth = 9;
      ctx.strokeStyle = '#05020a';
      ctx.strokeText(text, W / 2, H / 2);
      ctx.fillStyle = highlighted ? '#fff1ac' : '#ffe9b8';
      ctx.fillText(text, W / 2, H / 2);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      const mat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        toneMapped: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.userData.crispLabel = true;
      const scaleY = 0.18;
      const scaleX = 0.18 * (W / H);
      sprite.scale.set(scaleX, scaleY, 1);
      sprite.userData.baseScale = new THREE.Vector3(scaleX, scaleY, 1);
      sprite.userData.minCssPx = MIN_DEGREE_CSS_PX / (56 / 112);
      sprite.userData.visibilityWidth = 600;
      sprite.userData.focused = highlighted;
      sprite.renderOrder = 20;
      sizedLabels.push({ sprite, minCssPx: sprite.userData.minCssPx });
      return sprite;
    }
    const addGlyphLabel = (text: string, point: THREE.Vector3) => {
      if (rendererTierRef.current !== 3) return;
      if (containerRef.current?.closest<HTMLElement>('[data-chart-callout-boundary]')?.dataset.chartInset === 'true') return;
      const element = document.createElement('div');
      element.textContent = text;
      Object.assign(element.style, { position: 'absolute', top: '0', left: '0', zIndex: '13', pointerEvents: 'none', transformOrigin: '50% 50%', color: '#fff8e1', fontFamily: '"Cinzel", Georgia, serif', fontWeight: '700', fontSize: '17px', textShadow: '0 0 4px #000000, 0 1px 3px #000000', whiteSpace: 'nowrap' });
      containerRef.current?.append(element);
      glyphLabels.push({ element, point });
    }

    // 0. GEOCENTRIC CENTER: 🜨 EARTH (TERRA) FOCAL OBSERVER
    // In classic astrolabes and geocentric natal charts, the center is the observer on Earth.
    const R_CENTER_RETICLE = 0.22;
    const earthGeo = new THREE.SphereGeometry(R_CENTER_RETICLE, 32, 32);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x0c3d68, // A dark ocean jewel under the high-contrast Earth glyph.
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
    const earthSprite = createGlyphSprite('⊕', '', '#38bdf8', 0.28, isEarthSelected, true);
    earthSprite.position.copy(earthSphere.position);
    earthSprite.userData.markerMesh = earthSphere;
    dynamicGroup.add(earthSprite);
    declutterObstacles.push({ object: earthSprite, radius: 0.2 });
    addGlyphLabel('⊕', earthSprite.position.clone());
    const earthName = createDegreeLabel('Earth', isEarthSelected);
    earthName.userData.visibilityWidth = 240;
    earthName.userData.minimumTextCss = 11;
    earthName.position.set(0, 0.05, 0.42); dynamicGroup.add(earthName);

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
      // Follow the actual torus cross-section all the way to both bezels.
      // Depth testing hides the back of each fine stroke behind the rim.
      const tickHalfSpan = R_TORUS_TUBE;
      const tickPoints: THREE.Vector3[] = [];
      for (let step = 0; step <= 48; step++) {
        const d = -tickHalfSpan + (tickHalfSpan * 2 * step) / 48;
        tickPoints.push(new THREE.Vector3(
          Math.cos(cuspRad) * (R_TORUS_TRACK + d),
          Math.sqrt(Math.max(0, R_TORUS_TUBE * R_TORUS_TUBE - d * d)) + 0.02,
          Math.sin(cuspRad) * (R_TORUS_TRACK + d)
        ));
      }
      const tick = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(tickPoints),
        new THREE.LineBasicMaterial({ color: 0xffd875, toneMapped: false, depthWrite: false })
      );
      tick.userData.focused = activeSelections.includes(sign.name);
      // Deliberate local addition (§16.12 pending INSET): sign ring ticks are
      // wheel structure; the focus-dim traverse never dims them.
      tick.userData.wheelStructure = true;
      dynamicGroup.add(tick);

      const centerRad = lonToRad(sign.lon + 15);
      const zx = Math.cos(centerRad) * R_TORUS_TRACK;
      const zz = Math.sin(centerRad) * R_TORUS_TRACK;
      const isSelected = activeSelections.includes(sign.name);

      // AUDIT-CHART: a saturated element fill under the dark, outlined glyph.
      const jewel = new THREE.Mesh(
        new THREE.SphereGeometry(0.105, 24, 18),
        new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(SIGN_ELEMENT_FILL[sign.element] || '#f5d77f').multiplyScalar(0.2),
          roughness: 0.22, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.7,
        })
      );
      jewel.position.set(zx, Y_SUPERIMPOSED + 0.08, zz);
      jewel.userData.focused = isSelected; jewel.userData.crispLabel = true;
      dynamicGroup.add(jewel);
      const zSprite = createGlyphSprite(sign.glyph, '', SIGN_ELEMENT_FILL[sign.element] || '#f5d77f', 0.22, isSelected);
      zSprite.userData.markerMesh = jewel;
      zSprite.userData.targetId = sign.name;
      zSprite.position.copy(jewel.position);
      dynamicGroup.add(zSprite);
      addGlyphLabel(sign.glyph, zSprite.position.clone());
      declutterObstacles.push({ object: zSprite, radius: 0.16 });

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
      Object.assign(zSprite.userData, hitMesh.userData);
      interactiveObjectsRef.current.push(zSprite, hitMesh);
    });

    // 2. HOUSE CUSPS & SPOKES
    (chart.input.birthTimeUnknown ? [] : chart.houseCusps).forEach((h) => {
      const rad = lonToRad(h.lon);
      const isCardo = h.isCardo;
      const houseId = `House ${h.num}`;
      const isSelected = activeSelections.includes(houseId) || activeSelections.includes(h.label);

      // Deliberate local addition (§16.12 pending AUDIT-CHART): cusp
      // separators are flat radial bars whose ends reach into both rings
      // (inner guide ring and inner bezel), so each cusp line runs between
      // the rings, attached — never a hairline floating apart off the wheel.
      const spokeInner = R_HOUSE_INNER;
      const spokeOuter = R_TORUS_TRACK - R_TORUS_TUBE;
      const spokeGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(rad) * spokeInner, 0.03, Math.sin(rad) * spokeInner),
        new THREE.Vector3(Math.cos(rad) * spokeOuter, 0.03, Math.sin(rad) * spokeOuter),
      ]);
      const spokeMat = new THREE.LineBasicMaterial({
        color: isSelected ? 0xffdf80 : 0xf2ca50,
        transparent: true,
        opacity: isSelected ? 1.0 : isCardo ? 0.95 : 0.75,
        toneMapped: false,
        depthWrite: false,
      });
      const spokeBar = new THREE.Line(spokeGeo, spokeMat);
      spokeBar.userData.focused = isSelected;
      // House spokes are wheel structure (§16.12 pending INSET): never dimmed.
      spokeBar.userData.wheelStructure = true;
      dynamicGroup.add(spokeBar);

      // Cusp Badge
      const badgeR = R_TORUS_TRACK - R_TORUS_TUBE - 0.12;
      const badgeX = Math.cos(rad) * badgeR;
      const badgeZ = Math.sin(rad) * badgeR;

      const badgeSprite = createGlyphSprite(
        h.label,
        '',
        isSelected ? '#fff' : isCardo ? '#f2ca50' : '#d4af37',
        isSelected ? 0.35 : isCardo ? 0.3 : 0.24,
        isSelected || isCardo
      );
      badgeSprite.position.set(badgeX, 0.08, badgeZ);
      badgeSprite.userData.targetId = houseId;
      badgeSprite.userData.focused = isSelected;
      badgeSprite.userData.visibilityWidth = isCardo ? 700 : Number.POSITIVE_INFINITY;
      // The cusp badge carries the degree mark (its subtext); wheel structure
      // (§16.12 pending INSET) keeps it legible through any focus dim.
      badgeSprite.userData.wheelStructure = true;
      dynamicGroup.add(badgeSprite);
      declutterMovables.push({ sprite: badgeSprite, origin: badgeSprite.position.clone(), axis: new THREE.Vector3(Math.cos(rad), 0, Math.sin(rad)), offsets: [0, -0.08, -0.16], current: 0 });

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
      // AUDIT-CHART: house numerals drawn at 256 px × devicePixelRatio with
      // their own on-screen floor (≥ 11 CSS px), never softer or smaller.
      const hDpr = labelDevicePixelRatio();
      hCanvas.width = Math.round(LABEL_TEXTURE_CSS_PX * hDpr);
      hCanvas.height = Math.round(LABEL_TEXTURE_CSS_PX * hDpr);
      const hCtx = hCanvas.getContext('2d')!;
      hCtx.scale(hDpr, hDpr);
      hCtx.font = `bold ${Math.round(LABEL_TEXTURE_CSS_PX * HOUSE_NUMBER_FACE_FRACTION)}px "IBM Plex Mono", monospace`;
      hCtx.textAlign = 'center'; hCtx.textBaseline = 'middle';
      hCtx.lineJoin = 'round'; hCtx.lineWidth = 15; hCtx.strokeStyle = '#08040f';
      hCtx.strokeText(h.num.toString(), 128, 133);
      hCtx.fillStyle = '#fff2bd'; hCtx.fillText(h.num.toString(), 128, 133);

      const hTex = new THREE.CanvasTexture(hCanvas);
      hTex.colorSpace = THREE.SRGBColorSpace;
      hTex.generateMipmaps = false;
      hTex.minFilter = THREE.LinearFilter;
      const hMat = new THREE.SpriteMaterial({
        map: hTex,
        transparent: true,
        depthTest: false,
        toneMapped: false,
      });
      const hSprite = new THREE.Sprite(hMat);
      const hScale = isSelected ? 0.34 : 0.28;
      hSprite.scale.set(hScale, hScale, 1);
      hSprite.userData.baseScale = new THREE.Vector3(hScale, hScale, 1);
      hSprite.userData.minCssPx = MIN_DEGREE_CSS_PX / HOUSE_NUMBER_FACE_FRACTION;
      sizedLabels.push({ sprite: hSprite, minCssPx: hSprite.userData.minCssPx });
      hSprite.position.set(hNumX, 0.04, hNumZ);
      hSprite.userData.focused = isSelected;
      hSprite.userData.visibilityWidth = 160;
      hSprite.userData.targetId = houseId;
      // House numbers are wheel structure (§16.12 pending INSET): never dimmed.
      hSprite.userData.wheelStructure = true;
      hSprite.userData.crispLabel = true;
      hSprite.userData.orientationAnchor = true;
      hSprite.renderOrder = 20;
      dynamicGroup.add(hSprite);
      declutterMovables.push({ sprite: hSprite, origin: hSprite.position.clone(), axis: new THREE.Vector3(Math.cos(midRad), 0, Math.sin(midRad)), offsets: [0, -0.12, -0.24, 0.12], current: 0 });

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
    const bodyLanes = new Map<string, number>();
    const placedBodies: Array<{ lon: number; lane: number }> = [];
    [...chart.natalBodies].sort((left, right) => left.lon - right.lon).forEach(body => {
      const used = new Set(placedBodies.filter(other => Math.abs(((body.lon - other.lon + 540) % 360) - 180) <= 12).map(other => other.lane));
      const lane = [0, 3, 1, 2].find(candidate => !used.has(candidate)) ?? body.tier % 4;
      bodyLanes.set(body.name, lane);
      placedBodies.push({ lon: body.lon, lane });
    });

    chart.natalBodies.forEach((body) => {
      const baseRad = lonToRad(body.lon);
      const adjustedRad = baseRad;
      const rTrack = R_PLANETS_TRACK - body.tier * 0.13;

      const x = Math.cos(adjustedRad) * rTrack;
      const z = Math.sin(adjustedRad) * rTrack;

      const anchor = new THREE.Vector3(Math.cos(baseRad) * R_PLANETS_TRACK, 0.08, Math.sin(baseRad) * R_PLANETS_TRACK);
      bodyCoordinates[body.name] = { x: anchor.x, z: anchor.z, rad: baseRad, r: R_PLANETS_TRACK };

      const isSelected = activeSelections.includes(body.name);
      const beadRadius = isSelected ? 0.11 : 0.10;
      const beadGeo = new THREE.SphereGeometry(beadRadius, 24, 24);
      const beadMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(body.color).multiplyScalar(0.18),
        emissive: new THREE.Color(body.color).multiplyScalar(0.035),
        emissiveIntensity: isSelected ? 0.7 : 0.25,
        roughness: 0.22,
        metalness: 0.55,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        envMapIntensity: 0.7,
      });
      const bead = new THREE.Mesh(beadGeo, beadMat);
      bead.name = body.name;
      bead.userData.focused = isSelected;
      bead.userData.crispLabel = true;
      bead.position.set(x, 0.18 + (bodyLanes.get(body.name) || 0) * 0.12, z);
      dynamicGroup.add(bead);
      const leader = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([anchor, bead.position.clone()]),
        new THREE.LineBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.65, toneMapped: false, depthWrite: false })
      );
      leader.userData.focused = isSelected;
      dynamicGroup.add(leader);

      const uncertainMoon = chart.input.birthTimeUnknown && body.name === 'Moon';
      const sprite = createGlyphSprite(body.glyph, '', body.color, 0.22, isSelected);
      sprite.position.copy(bead.position);
      sprite.userData.markerMesh = bead;
      dynamicGroup.add(sprite);
      declutterObstacles.push({ object: sprite, radius: beadRadius });
      const degreeLabel = createDegreeLabel(uncertainMoon ? '?' : body.degText, isSelected);
      const labelAxis = new THREE.Vector3(Math.cos(adjustedRad), 0, Math.sin(adjustedRad));
      degreeLabel.position.copy(sprite.position).addScaledVector(labelAxis, 0.32);
      dynamicGroup.add(degreeLabel);
      declutterMovables.push({ sprite: degreeLabel, origin: degreeLabel.position.clone(), axis: labelAxis, offsets: [0, 0.12, 0.24, 0.36, 0.48], current: 0 });
      addGlyphLabel(body.glyph, sprite.position.clone());
      addEndpointLabel('NATAL', body.name, body.glyph, uncertainMoon ? 'Birth time needed' : body.fullDegText, bead.position.clone(), body.name, isSelected);
      bead.userData.targetId = sprite.userData.targetId = body.name;

      const hitPlanet = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 12, 12),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitPlanet.position.copy(bead.position);
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
      Object.assign(sprite.userData, hitPlanet.userData);
      Object.assign(bead.userData, hitPlanet.userData);
      interactiveObjectsRef.current.push(sprite, bead, hitPlanet);
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
        const position = new THREE.Vector3(Math.cos(rad) * radius, 0.18 + Math.min(nearby, 3) * 0.12, Math.sin(rad) * radius);
        const anchor = new THREE.Vector3(Math.cos(rad) * 2.68, 0.10, Math.sin(rad) * 2.68);
        currentCoordinates[body.target] = anchor;
        const focused = activeSelections.includes(body.target);
        const bead = new THREE.Mesh(
          new THREE.SphereGeometry(focused ? 0.11 : 0.075, 20, 16),
          new THREE.MeshPhysicalMaterial({ color: 0x093d4d, emissive: 0x032530, emissiveIntensity: focused ? 0.7 : 0.25, metalness: 0.55, roughness: 0.22, clearcoat: 1, envMapIntensity: 0.7 })
        );
        bead.position.copy(position); bead.userData.focused = focused; bead.userData.crispLabel = true; dynamicGroup.add(bead);
        const leader = new THREE.Line(new THREE.BufferGeometry().setFromPoints([anchor, position]), new THREE.LineBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false }));
        leader.userData.focused = focused; dynamicGroup.add(leader);
        const sprite = createGlyphSprite(body.glyph, '', '#67e8f9', 0.22, focused);
        sprite.position.copy(position); sprite.userData.markerMesh = bead;
        sprite.userData.focused = focused; dynamicGroup.add(sprite);
        addGlyphLabel(body.glyph, sprite.position.clone());
        addEndpointLabel('NOW', body.name, body.glyph, body.fullDegText, sprite.position.clone(), body.target, focused);
        bead.userData.targetId = sprite.userData.targetId = body.target;
        declutterObstacles.push({ object: sprite, radius: 0.17 });
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
    sizedSpritesRef.current = sizedLabels;
    declutterRef.current = { movables: declutterMovables, obstacles: declutterObstacles };
    // Structural frame meshes are exempt and stay vivid at their recorded
    // focusBaseOpacity; only non-focused representational elements dim. The
    // wheel structure — house spokes, house numbers, cusp degree badges, sign
    // ticks, all carrying userData.wheelStructure (§16.12 pending INSET) — is
    // exempt the same way, so only bodies, glyphs and aspect lines de-emphasise.
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
        material.opacity = material.userData.focusBaseOpacity * (focusActive && !object.userData.focused && !object.userData.crispLabel && !object.userData.orientationAnchor && !object.userData.structureFrame && !object.userData.wheelStructure ? CHART_FOCUS.dim : 1);
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
          // AUDIT-CHART: hover emphasis is a factor the per-frame size pass
          // applies — never a one-shot scale write the pass would overwrite.
          object.userData.hoverScaleFactor = inset && targets.has(object.userData.targetId) ? 1.12 : 1;
        }
        const item = object as THREE.Mesh;
        const materials = item.material ? (Array.isArray(item.material) ? item.material : [item.material]) : [];
        materials.forEach(material => {
          // Wheel structure never dims, on focus or hover (§16.12 pending INSET).
          material.opacity = material.userData.focusBaseOpacity * (focusActive && !object.userData.focused && !object.userData.crispLabel && !targets.has(object.userData.targetId) && !object.userData.structureFrame && !object.userData.wheelStructure ? CHART_FOCUS.dim : 1);
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
      sizedSpritesRef.current = [];
      if (declutterRef.current?.movables === declutterMovables) declutterRef.current = null;
      const textures = new Set<THREE.Texture>();
      dynamicGroup.traverse(object => {
        const renderable = object as THREE.Mesh;
        renderable.geometry?.dispose();
        const materials = renderable.material ? (Array.isArray(renderable.material) ? renderable.material : [renderable.material]) : [];
        materials.forEach(material => {
          const texture = (material as THREE.SpriteMaterial).map;
          if (texture) textures.add(texture);
          material.dispose();
        });
        if (object.userData.detailTexture) textures.add(object.userData.detailTexture);
        if (object.userData.compactTexture) textures.add(object.userData.compactTexture);
      });
      textures.forEach(texture => texture.dispose());
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
