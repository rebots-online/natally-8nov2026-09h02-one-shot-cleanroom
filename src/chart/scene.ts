// Pure three.js builder for the Natally natal-chart scene — no React.
// AstroChart.tsx owns the canvas, pointer input, and lifecycle; everything
// geometric (zodiac ring, ecliptic, bodies, aspects, halo) lives here and is
// fully disposable on teardown.

import * as THREE from 'three';
import type { AspectKind, ChartBodyKey, NatalChart, ZodiacSign } from '../shared/types';

/** Handle over a mounted chart scene. All methods are total and cheap. */
export interface ChartScene {
  /** Advance ambient motion by `deltaSeconds` and render one frame. */
  update(deltaSeconds: number): void;
  /** Match the renderer and camera to a new host size in CSS pixels. */
  resize(widthPx: number, heightPx: number): void;
  /** Nearest body marker under the given normalized-device point, or null. */
  pickAt(ndcX: number, ndcY: number): ChartBodyKey | null;
  /** Move the hover halo onto a body, or hide it when key is null. */
  setHover(key: ChartBodyKey | null): void;
  /** Apply a pointer drag as screen-pixel deltas (rotate + tilt, clamped). */
  spinBy(dragDxPx: number, dragDyPx: number): void;
  /** Apply wheel travel (positive deltaY pulls back), clamped to range. */
  zoomBy(wheelDeltaY: number): void;
  /** Redraw every canvas-text sprite (e.g. after webfonts finish loading). */
  refreshLabels(): void;
  /** Release all GPU resources held by this scene. */
  dispose(): void;
}

// Palette mirrored from src/shared/tokens.css (owner: W1).
const PALETTE = {
  plumDeep: 0x1c1122,
  plum: 0x2a1a33,
  plumRaised: 0x362141,
  plumLine: 0x422a50,
  brass: 0xc9a45c,
  brassBright: 0xd9b878,
  brassDim: 0x6f5a35,
  parchment: 0xf3ead8,
  parchmentMuted: 0xb9a996,
  tension: 0x8f3b52,
} as const;

const DEG = Math.PI / 180;

const SIGNS: readonly ZodiacSign[] = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

const SIGN_GLYPH: Record<ZodiacSign, string> = {
  Aries: '\u2648',
  Taurus: '\u2649',
  Gemini: '\u264A',
  Cancer: '\u264B',
  Leo: '\u264C',
  Virgo: '\u264D',
  Libra: '\u264E',
  Scorpio: '\u264F',
  Sagittarius: '\u2650',
  Capricorn: '\u2651',
  Aquarius: '\u2652',
  Pisces: '\u2653',
};

// Relative marker sizes: luminaries lead, personal planets, outers, points.
const BODY_IMPORTANCE: Record<ChartBodyKey, number> = {
  Sun: 1.0,
  Moon: 0.92,
  Mercury: 0.66,
  Venus: 0.66,
  Mars: 0.66,
  Jupiter: 0.72,
  Saturn: 0.72,
  Uranus: 0.52,
  Neptune: 0.52,
  Pluto: 0.52,
  Chiron: 0.44,
  TrueNode: 0.44,
  Ascendant: 0.58,
  Midheaven: 0.58,
};

const BODY_LABEL: Record<ChartBodyKey, string> = {
  Sun: 'Sun',
  Moon: 'Moon',
  Mercury: 'Mercury',
  Venus: 'Venus',
  Mars: 'Mars',
  Jupiter: 'Jupiter',
  Saturn: 'Saturn',
  Uranus: 'Uranus',
  Neptune: 'Neptune',
  Pluto: 'Pluto',
  Chiron: 'Chiron',
  TrueNode: 'Node',
  Ascendant: 'Asc',
  Midheaven: 'MC',
};

// Layout radii (world units; the zodiac disk spans roughly -10.2..10.2).
const R_OUT = 10.2; // zodiac ring outer edge
const R_ZIN = 8.4; // zodiac ring inner edge
const R_GLYPH = 9.3; // sign glyph radius
const R_ECL = 5.1; // brass ecliptic ring
const R_BODY = 6.55; // body marker lane
const R_BODY_OUT = 7.7; // relief lane for clustered longitudes
const R_CUSP_IN = 4.3; // house cusp lines start here

const AMBIENT_SPIN = 0.05; // rad/s around the disk normal
const TILT_MIN = -1.05;
const TILT_MAX = 0.5;
const DIST_MIN = 17;
const DIST_MAX = 44;
const SPIN_PER_PIXEL = 0.006;
const TILT_PER_PIXEL = 0.005;
const ZOOM_PER_WHEEL = 0.02;

const GLYPH_FONT = '400 118px "Playfair Display", "DejaVu Sans", Georgia, serif';
const LABEL_FONT = '400 56px "Playfair Display", Georgia, serif';

function normLon(lon: number): number {
  return ((lon % 360) + 360) % 360;
}

function circGapDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Screen angle for a tropical longitude: 0° Aries at 9 o'clock, CCW. */
function lonToAngle(lon: number): number {
  return Math.PI + normLon(lon) * DEG;
}

function polar(radius: number, angle: number, z = 0): THREE.Vector3 {
  return new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), z);
}

function at(radius: number, lon: number, z = 0): THREE.Vector3 {
  return polar(radius, lonToAngle(lon), z);
}

interface LabelSpec {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  worldWidth: number;
  redraw: () => HTMLCanvasElement;
}

function drawGlyphCanvas(sign: ZodiacSign): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 192;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  g.font = GLYPH_FONT;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#c9a45c';
  g.shadowColor = 'rgba(217, 184, 120, 0.5)';
  g.shadowBlur = 16;
  g.fillText(SIGN_GLYPH[sign], 96, 104);
  return canvas;
}

function drawBodyLabelCanvas(text: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  if (!g) {
    canvas.width = 64;
    canvas.height = 84;
    return canvas;
  }
  g.font = LABEL_FONT;
  const textWidth = Math.ceil(g.measureText(text).width);
  canvas.width = textWidth + 28;
  canvas.height = 84;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f3ead8';
  ctx.shadowColor = 'rgba(28, 17, 34, 0.9)';
  ctx.shadowBlur = 6;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  return canvas;
}

function drawHaloCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  const grad = g.createRadialGradient(80, 80, 0, 80, 80, 80);
  grad.addColorStop(0, 'rgba(217, 184, 120, 0)');
  grad.addColorStop(0.42, 'rgba(217, 184, 120, 0)');
  grad.addColorStop(0.55, 'rgba(217, 184, 120, 0.85)');
  grad.addColorStop(0.7, 'rgba(201, 164, 92, 0.35)');
  grad.addColorStop(1, 'rgba(201, 164, 92, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 160, 160);
  return canvas;
}

function disposeMaterial(material: THREE.Material): void {
  const withMap = material as THREE.Material & { map?: THREE.Texture | null };
  withMap.map?.dispose();
  material.dispose();
}

/**
 * Build the full chart scene onto `canvas`. The caller drives `update` from a
 * requestAnimationFrame loop and must call `dispose` before dropping the
 * handle; every geometry, material, and texture created here is released.
 */
export function createChartScene(canvas: HTMLCanvasElement, chart: NatalChart): ChartScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  let distance = 29;
  camera.position.set(0, 0, distance);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xf3ead8, 1.1));
  scene.add(new THREE.HemisphereLight(0xd9b878, 0x1c1122, 0.7));
  const keyLight = new THREE.DirectionalLight(0xfff2dc, 2.2);
  keyLight.position.set(6, 10, 12);
  scene.add(keyLight);

  // Everything chart-flavoured rotates together under `root`.
  const root = new THREE.Group();
  root.rotation.x = -0.32;
  scene.add(root);

  const labelSpecs: LabelSpec[] = [];

  const makeTextTexture = (source: HTMLCanvasElement): THREE.CanvasTexture => {
    const texture = new THREE.CanvasTexture(source);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = maxAniso;
    return texture;
  };

  const applyLabelCanvas = (spec: LabelSpec, source: HTMLCanvasElement): void => {
    const texture = makeTextTexture(source);
    spec.material.map?.dispose();
    spec.material.map = texture;
    spec.material.needsUpdate = true;
    spec.sprite.scale.set(spec.worldWidth, (spec.worldWidth * source.height) / source.width, 1);
  };

  const makeTextSprite = (redraw: () => HTMLCanvasElement, worldWidth: number): THREE.Sprite => {
    const material = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    const spec: LabelSpec = { sprite, material, worldWidth, redraw };
    applyLabelCanvas(spec, redraw());
    labelSpecs.push(spec);
    return sprite;
  };

  // — Backing disk, zodiac sectors, separators, degree ticks —
  const backing = new THREE.Mesh(
    new THREE.CircleGeometry(R_OUT + 0.55, 96),
    new THREE.MeshBasicMaterial({ color: PALETTE.plumDeep }),
  );
  backing.position.z = -0.08;
  root.add(backing);

  for (let i = 0; i < 12; i += 1) {
    const sector = new THREE.Mesh(
      new THREE.RingGeometry(R_ZIN, R_OUT, 48, 1, lonToAngle(i * 30), 30 * DEG),
      new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? PALETTE.plum : PALETTE.plumRaised }),
    );
    sector.position.z = -0.02;
    root.add(sector);

    const glyph = makeTextSprite(() => drawGlyphCanvas(SIGNS[i]), 1.7);
    glyph.position.copy(at(R_GLYPH, i * 30 + 15, 0.25));
    root.add(glyph);
  }

  const separatorPts: number[] = [];
  const tickPts: number[] = [];
  for (let d = 0; d < 360; d += 5) {
    const angle = lonToAngle(d);
    const inner = d % 30 === 0 ? R_ZIN - 0.06 : R_ZIN;
    const outer = d % 30 === 0 ? R_OUT : d % 10 === 0 ? R_ZIN + 0.34 : R_ZIN + 0.2;
    const target = d % 30 === 0 ? separatorPts : tickPts;
    const a = polar(inner, angle);
    const b = polar(outer, angle);
    target.push(a.x, a.y, 0.005, b.x, b.y, 0.005);
  }
  const lineGeometry = (pts: number[]): THREE.BufferGeometry => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  };
  root.add(
    new THREE.LineSegments(
      lineGeometry(separatorPts),
      new THREE.LineBasicMaterial({ color: PALETTE.plumLine, transparent: true, opacity: 0.95 }),
    ),
  );
  root.add(
    new THREE.LineSegments(
      lineGeometry(tickPts),
      new THREE.LineBasicMaterial({ color: PALETTE.plumLine, transparent: true, opacity: 0.55 }),
    ),
  );

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(R_OUT + 0.03, 0.018, 8, 220),
    new THREE.MeshStandardMaterial({
      color: PALETTE.brassDim,
      metalness: 0.8,
      roughness: 0.4,
    }),
  );
  root.add(rim);

  const ecliptic = new THREE.Mesh(
    new THREE.TorusGeometry(R_ECL, 0.04, 10, 180),
    new THREE.MeshStandardMaterial({
      color: PALETTE.brass,
      metalness: 0.85,
      roughness: 0.3,
      emissive: 0x241a08,
      emissiveIntensity: 0.8,
    }),
  );
  root.add(ecliptic);

  // — House cusp lines (subtle) —
  const cuspPts: number[] = [];
  for (const cusp of chart.houses) {
    const a = at(R_CUSP_IN, cusp.position.longitude);
    const b = at(R_ZIN, cusp.position.longitude);
    cuspPts.push(a.x, a.y, 0.01, b.x, b.y, 0.01);
  }
  root.add(
    new THREE.LineSegments(
      lineGeometry(cuspPts),
      new THREE.LineBasicMaterial({ color: PALETTE.plumLine, transparent: true, opacity: 0.55 }),
    ),
  );

  // — Body markers on two lanes (clusters peel off to the outer lane) —
  const unitSphere = new THREE.SphereGeometry(1, 28, 20);
  const goldMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.brassBright,
    metalness: 0.6,
    roughness: 0.32,
    emissive: 0x40300f,
    emissiveIntensity: 0.7,
  });
  const brassMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.brass,
    metalness: 0.7,
    roughness: 0.42,
    emissive: 0x241a08,
    emissiveIntensity: 0.55,
  });
  const stoneMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.parchmentMuted,
    metalness: 0.15,
    roughness: 0.75,
    emissive: 0x141216,
    emissiveIntensity: 0.5,
  });

  const laneLongitudes: number[][] = [[], []];
  const laneFor = (lon: number): 0 | 1 => {
    const gapIn = (lons: number[]): number =>
      lons.length === 0 ? Infinity : Math.min(...lons.map(other => circGapDeg(lon, other)));
    const lane: 0 | 1 = gapIn(laneLongitudes[0]) >= gapIn(laneLongitudes[1]) ? 0 : 1;
    laneLongitudes[lane].push(lon);
    return lane;
  };

  const bodyMeshes: THREE.Mesh[] = [];
  const bodyPosition = new Map<ChartBodyKey, THREE.Vector3>();
  const bodySize = new Map<ChartBodyKey, number>();

  const sortedBodies = [...chart.bodies].sort(
    (a, b) => normLon(a.position.longitude) - normLon(b.position.longitude),
  );
  for (const body of sortedBodies) {
    const lon = normLon(body.position.longitude);
    const size = 0.18 + 0.5 * (BODY_IMPORTANCE[body.key] ?? 0.6);
    const lane = laneFor(lon);
    const position = at(lane === 0 ? R_BODY : R_BODY_OUT, lon, size * 0.75);
    const markerMaterial =
      body.key === 'Sun' || body.key === 'Moon'
        ? goldMaterial
        : body.key === 'Chiron' ||
            body.key === 'TrueNode' ||
            body.key === 'Ascendant' ||
            body.key === 'Midheaven'
          ? stoneMaterial
          : brassMaterial;
    const marker = new THREE.Mesh(unitSphere, markerMaterial);
    marker.scale.setScalar(size);
    marker.position.copy(position);
    marker.userData.key = body.key;
    root.add(marker);
    bodyMeshes.push(marker);
    bodyPosition.set(body.key, position);
    bodySize.set(body.key, size);

    const label = makeTextSprite(() => drawBodyLabelCanvas(BODY_LABEL[body.key]), 1.35);
    label.position.set(position.x, position.y, position.z + size + 0.55);
    root.add(label);
  }

  const hub = new THREE.Mesh(unitSphere, goldMaterial);
  hub.scale.setScalar(0.13);
  hub.position.set(0, 0, 0.2);
  root.add(hub);

  // — Aspect chords, colored by kind —
  const aspectColor = (kind: AspectKind): { color: number; opacity: number } => {
    switch (kind) {
      case 'trine':
      case 'sextile':
        return { color: PALETTE.brass, opacity: 0.5 };
      case 'square':
      case 'opposition':
        return { color: PALETTE.tension, opacity: 0.6 };
      case 'conjunction':
        return { color: PALETTE.parchmentMuted, opacity: 0.32 };
    }
  };
  const aspectPtsByKind = new Map<AspectKind, number[]>();
  for (const aspect of chart.aspects) {
    const a = bodyPosition.get(aspect.a);
    const b = bodyPosition.get(aspect.b);
    if (!a || !b) continue;
    const pts = aspectPtsByKind.get(aspect.kind) ?? [];
    pts.push(a.x, a.y, 0.02, b.x, b.y, 0.02);
    aspectPtsByKind.set(aspect.kind, pts);
  }
  for (const [kind, pts] of aspectPtsByKind) {
    const look = aspectColor(kind);
    root.add(
      new THREE.LineSegments(
        lineGeometry(pts),
        new THREE.LineBasicMaterial({
          color: look.color,
          transparent: true,
          opacity: look.opacity,
        }),
      ),
    );
  }

  // — Hover halo (billboarded sprite so it always reads as a ring) —
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeTextTexture(drawHaloCanvas()),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.85,
    }),
  );
  halo.visible = false;
  root.add(halo);
  let haloBase = 1;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let elapsed = 0;

  return {
    update(deltaSeconds: number): void {
      elapsed += deltaSeconds;
      root.rotation.z += AMBIENT_SPIN * deltaSeconds;
      if (halo.visible) {
        const pulse = 1 + 0.06 * Math.sin(elapsed * 4.2);
        halo.scale.setScalar(haloBase * pulse);
        halo.material.opacity = 0.7 + 0.2 * Math.sin(elapsed * 4.2);
      }
      renderer.render(scene, camera);
    },

    resize(widthPx: number, heightPx: number): void {
      if (widthPx <= 0 || heightPx <= 0) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(widthPx, heightPx, false);
      camera.aspect = widthPx / heightPx;
      camera.updateProjectionMatrix();
    },

    pickAt(ndcX: number, ndcY: number): ChartBodyKey | null {
      ndc.set(ndcX, ndcY);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(bodyMeshes, false)[0];
      return hit ? (hit.object.userData.key as ChartBodyKey) : null;
    },

    setHover(key: ChartBodyKey | null): void {
      const position = key ? bodyPosition.get(key) : undefined;
      const size = key ? bodySize.get(key) : undefined;
      if (!key || !position || size === undefined) {
        halo.visible = false;
        return;
      }
      halo.position.set(position.x, position.y, position.z + 0.2);
      haloBase = size * 5.2;
      halo.scale.setScalar(haloBase);
      halo.visible = true;
    },

    spinBy(dragDxPx: number, dragDyPx: number): void {
      root.rotation.z -= dragDxPx * SPIN_PER_PIXEL;
      root.rotation.x = Math.min(
        Math.max(root.rotation.x + dragDyPx * TILT_PER_PIXEL, TILT_MIN),
        TILT_MAX,
      );
    },

    zoomBy(wheelDeltaY: number): void {
      distance = Math.min(Math.max(distance + wheelDeltaY * ZOOM_PER_WHEEL, DIST_MIN), DIST_MAX);
      camera.position.set(0, 0, distance);
    },

    refreshLabels(): void {
      for (const spec of labelSpecs) applyLabelCanvas(spec, spec.redraw());
    },

    dispose(): void {
      scene.traverse(object => {
        const holder = object as THREE.Mesh;
        holder.geometry?.dispose();
        const material = holder.material;
        if (Array.isArray(material)) material.forEach(disposeMaterial);
        else if (material) disposeMaterial(material);
      });
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
