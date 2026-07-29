/* ==============================================================================
  TIDAL - Deep Sea Jellyfish Navigation Engine
 ============================================================================== */

// -----------------------------------------------------------------------------
// 1. DOM Elements & Canvas Initialization
// -----------------------------------------------------------------------------
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false }); // Disable alpha on main context for max render speed
const W = canvas.width, H = canvas.height;             // Virtual canvas dimensions (420 x 680)
const overlay = document.getElementById('overlay');           // Main Menu / Game Over UI overlay
const menuBestBadge = document.getElementById('menuBestBadge');   // Main Menu Top Score badge
const pauseOverlay = document.getElementById('pauseOverlay'); // Pause state UI card overlay
const pauseScoreLine = document.getElementById('pauseScoreLine'); // Pause screen score line
const startBtn = document.getElementById('startBtn');         // Begin / Drift Again button
const resumeBtn = document.getElementById('resumeBtn');       // Resume Game button
const pauseBtn = document.getElementById('pauseBtn');         // Fixed top-left Pause button
const hud = document.getElementById('hud');                   // Top score display header
const statusListEl = document.getElementById('statusList');   // Stacked active status badges container
const badgePaused = document.getElementById('badgePaused');
const badgeBiome = document.getElementById('badgeBiome');
const badgeEatActive = document.getElementById('badgeEatActive');
const badgeEatReady = document.getElementById('badgeEatReady');
const badgeMagnetic = document.getElementById('badgeMagnetic');
const badgeDarkZone = document.getElementById('badgeDarkZone');
const depthEl = document.getElementById('depth');             // Bottom depth display meter

// -----------------------------------------------------------------------------
// 2. Game State & Core Progression Variables
// -----------------------------------------------------------------------------
let state = 'ready';    // Core game state: 'ready' | 'playing' | 'dead'
let isPaused = false;   // Flag indicating if gameplay is currently paused
let justResumedTime = 0;// Timestamp of last resume action to ignore trailing clicks
let frame = 0;          // Lifetime frame counter for animation cycles
let score = 0;          // Current run plankton score

// Persistent High Score Handling (localStorage)
const STORAGE_KEY_BEST = 'tidal_best_score';
function loadBestScore() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_BEST);
    if (saved !== null) {
      const val = parseInt(saved, 10);
      if (!isNaN(val) && val >= 0) return val;
    }
  } catch (e) {
    // Fallback if localStorage is restricted
  }
  return 0;
}
function saveBestScore(val) {
  try {
    localStorage.setItem(STORAGE_KEY_BEST, val.toString());
  } catch (e) {
    // Fallback if localStorage is restricted
  }
  updateMenuBestBadge();
}

let best = loadBestScore(); // High score tracking (Total Score = Plankton + Depth)

function updateMenuBestBadge() {
  if (menuBestBadge) {
    menuBestBadge.textContent = `Top Score: ${best}`;
  }
}
updateMenuBestBadge();
let depthScrolled = 0;  // Total world units descended into the cavern
let scrollSpeed = 2;    // Current frame descent rate (units per frame)

// Camera tracking elevation (shifts upward as depth increases to expand view below)
let currentFixedY = H * 0.32;

// Cavern Generation Constants
const WALL_MARGIN = 16;        // Minimum distance from canvas border to cave wall
const SEGMENT_SPACING = 230;   // Vertical distance between procedural cavern control points
const LOOKAHEAD_WORLD = H + 260;// Distance ahead of player to generate cave points
const FEATURE_MIN_DEPTH = 750; // Minimum depth required before split forks & pockets spawn

// -----------------------------------------------------------------------------
// 3. Player (Jellyfish) State & Controls
// -----------------------------------------------------------------------------
// Jellyfish physical entity (radius = 10 for tight, forgiving collision detection)
const jelly = { x: W / 2, radius: 8, tilt: 0 };
let prevJellyX = jelly.x;        // Track previous frame position to compute tilt angle
let targetX = jelly.x;           // Target X position driven by mouse or keyboard
let useKeyboard = false;         // Input mode toggle (Mouse vs Keyboard arrows)
let leftPressed = false;         // Left arrow key state
let rightPressed = false;        // Right arrow key state
const KEY_SPEED = 4.2;           // Base keyboard steering movement speed
let touchActive = false;         // Active touch dragging flag
let touchStartX = 0;             // Touch start X coordinate
let touchStartY = 0;             // Touch start Y coordinate
let touchStartTargetX = targetX; // Target X position at touch start
let activeTouchId = null;        // Active tracking touch identifier
let touchMoved = false;          // Track if touch dragged significantly

// Detect Mobile / Tablet vs Desktop Web
const isMobileOrTablet = window.matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPad|iPhone|iPod/i.test(navigator.userAgent);

function applyPlatformControls() {
  const controlGrid = document.getElementById('controlGrid');
  if (controlGrid) {
    if (isMobileOrTablet) {
      controlGrid.innerHTML = `
        <div class="ctrl-item"><span class="key">Touch Drag</span> Steer Jellyfish</div>
        <div class="ctrl-item"><span class="key">Tap Screen</span> Activate Eat Mode</div>
        <div class="ctrl-item"><span class="key">Pause Button</span> Pause Game</div>
      `;
    } else {
      controlGrid.innerHTML = `
        <div class="ctrl-item"><span class="key">&larr; &rarr;</span> / <span class="key">Mouse</span> Steer Jellyfish</div>
        <div class="ctrl-item"><span class="key">Space</span> / <span class="key">Click</span> Activate Eat Mode</div>
        <div class="ctrl-item"><span class="key">ESC</span> / <span class="key">Leave Canvas</span> Pause Game</div>
      `;
    }
  }

  const pauseInst = document.getElementById('pauseInstruction');
  if (pauseInst) {
    pauseInst.innerHTML = isMobileOrTablet
      ? 'Tap Resume to continue'
      : '<span class="key">ESC</span> or move mouse over game to resume';
  }

  if (badgeEatReady) {
    badgeEatReady.textContent = isMobileOrTablet ? 'Tap to Eat (-100)' : 'Space / Click to Eat (-100)';
  }
}
applyPlatformControls();

// -----------------------------------------------------------------------------
// 4. Entity Collections & Active Mechanics
// -----------------------------------------------------------------------------
let points = [];           // Control points forming the active cavern corridor
let pendingQueue = [];     // Pre-generated split fork sequence points awaiting insertion
let lastCenterForGen = W / 2; // Last generated cavern center position

let hazards = [];   // Active barnacle hazard entities
let plankton = [];  // Collectible bioluminescent plankton points
let flora = [];     // Decorative glowing sea flora on cave walls
let particles = []; // Ambient floating particles & explosion debris
let popups = [];    // Floating score animation text popups
let currents = [];  // Swirling Tidal Current power-up rings

let spawnTimer = 0;   // Counter tracking hazard/plankton spawn intervals
let eatActive = false; // Flag indicating if Eat Mode (crunching hazards) is active
let eatTimer = 0;     // Remaining frames for current Eat Mode activation
let eatFactor = 0;    // Smooth visual interpolation lerp factor for Eat Mode (0.0 to 1.0)
let darkFactor = 0;   // Smooth interpolation lerp factor for Abyssal Dark Zones (0.0 to 0.85)
let magnetTimer = 0;  // Remaining frames for active Magnetic Surge power-up
let magnetAlpha = 0;  // Smooth fade-out alpha for spinning magnetic arc visual effect

// -----------------------------------------------------------------------------
// 5. Memory Pools & Reusable Data Buffers (Garbage Collection Optimization)
// -----------------------------------------------------------------------------
// Ring buffer for jellyfish trail particles (eliminates array allocations during movement)
const MAX_TRAIL = 60;
const trailPool = Array.from({ length: MAX_TRAIL }, () => ({ x: 0, worldY: 0 }));
let trailHead = 0;
let trailCount = 0;

// Pre-allocated result objects to prevent Garbage Collection frame spikes
const channelResult = { leftX: 0, rightX: 0, pillarLeft: 0, pillarRight: 0 };
const channelListSingle = [{ left: 0, right: 0 }];
const channelListDouble = [{ left: 0, right: 0 }, { left: 0, right: 0 }];
const caveList = [];

// Dynamic Float32Array path buffer for high-performance jagged cave rendering
let pathBuf = new Float32Array(512);
function expandPathBuf(needed) {
  const newCap = Math.max(pathBuf.length * 2, needed);
  const n = new Float32Array(newCap);
  n.set(pathBuf);
  pathBuf = n;
}

// Pre-allocated rgba string builder to avoid per-frame template literal GC pressure
function rgba(r, g, b, a) {
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

// Cached color strings for drawJelly (only rebuilt when eatFactor integer-changes)
let _cachedEatKey = -1;
let _jellyGlowColor = '';
let _jellyGlowColorT = '';
let _jellyDomeColor = '';
let _jellyTentColor = '';
let _jellyGlowA = 0;
let _jellyTentA = 0;
let _jellyTentW = 0;
// Cached jelly radial gradient (keyed by radMult, avoids createRadialGradient every frame)
let _jellyGradCache = null;
let _jellyGradRadMult = -1;
function rebuildJellyColors(ef) {
  const key = Math.round(ef * 100);
  if (key === _cachedEatKey) return;
  _cachedEatKey = key;
  const gR = Math.round(76 + 179 * ef);
  const gG = Math.round(224 - 117 * ef);
  const gB = Math.round(210 - 116 * ef);
  _jellyGlowA = 0.55 + 0.20 * ef;
  _jellyGlowColor = rgba(gR, gG, gB, _jellyGlowA);
  _jellyGlowColorT = rgba(gR, gG, gB, 0);
  const dR = Math.round(200 + 55 * ef);
  const dG = Math.round(240 - 40 * ef);
  const dB = Math.round(238 - 48 * ef);
  _jellyDomeColor = rgba(dR, dG, dB, 0.92);
  const tR = Math.round(155 + 100 * ef);
  const tG = Math.round(140 - 20 * ef);
  const tB = Math.round(240 - 140 * ef);
  _jellyTentA = 0.55 + 0.40 * ef;
  _jellyTentW = 1.6 + 0.8 * ef;
  _jellyTentColor = rgba(tR, tG, tB, _jellyTentA);
  // Invalidate the gradient cache when color changes so it gets rebuilt with new stops
  _jellyGradCache = null;
}

// 6. Depth Biomes & Dynamic Palette Engine
// -----------------------------------------------------------------------------
const BIOMES = [
  {
    name: 'SUNLIT LAGOON',
    depth: 0,
    bgTop: [12, 26, 44],
    bgBot: [3, 7, 13],
    rockEdge: [10, 24, 38],
    rockMid: [18, 36, 57],
    glowColor: [76, 224, 210]
  },
  {
    name: 'CRYSTAL TRENCH',
    depth: 500,
    bgTop: [20, 10, 43],
    bgBot: [7, 3, 18],
    rockEdge: [27, 13, 51],
    rockMid: [41, 20, 74],
    glowColor: [176, 102, 254]
  },
  {
    name: 'ABYSSAL VOID',
    depth: 850,
    bgTop: [5, 5, 10],
    bgBot: [0, 0, 0],
    rockEdge: [10, 10, 16],
    rockMid: [20, 20, 31],
    glowColor: [255, 59, 86]
  },
  {
    name: 'THERMAL VENTS',
    depth: 1500,
    bgTop: [28, 12, 8],
    bgBot: [10, 4, 3],
    rockEdge: [38, 18, 11],
    rockMid: [61, 29, 18],
    glowColor: [255, 140, 59]
  }
];

let currentBiomeIdx = 0;
let lastAnnouncedBiome = -1;
let currentGlowRgb = [76, 224, 210];

function getCurrentBiomeData(depthMeters) {
  let idx = 0;
  while (idx < BIOMES.length - 1 && depthMeters >= BIOMES[idx + 1].depth) {
    idx++;
  }
  if (idx >= BIOMES.length - 1) {
    return { idx, b0: BIOMES[BIOMES.length - 1], b1: BIOMES[BIOMES.length - 1], t: 0 };
  }
  const b0 = BIOMES[idx];
  const b1 = BIOMES[idx + 1];
  const span = b1.depth - b0.depth;
  const progress = (depthMeters - b0.depth) / span;
  const t = Math.max(0, Math.min(1, progress));
  return { idx, b0, b1, t };
}

function lerpColor(c0, c1, t) {
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * t),
    Math.round(c0[1] + (c1[1] - c0[1]) * t),
    Math.round(c0[2] + (c1[2] - c0[2]) * t)
  ];
}

let bgGrad, rockGrad;
function updateDynamicGradients(depthMeters) {
  const data = getCurrentBiomeData(depthMeters);
  currentBiomeIdx = data.idx;

  if (currentBiomeIdx !== lastAnnouncedBiome && state === 'playing') {
    lastAnnouncedBiome = currentBiomeIdx;
    const bName = BIOMES[currentBiomeIdx].name;
    const gCol = BIOMES[currentBiomeIdx].glowColor;
    popups.push({
      text: `[ENTERED: ${bName}]`,
      x: W / 2,
      y: currentFixedY - 48,
      alpha: 1,
      life: 0,
      maxLife: 150,     // 2.5 seconds total duration
      fadeStart: 90,    // Remains 100% solid for 1.5s before starting to fade
      speed: 0.35,      // Gentle upward float speed
      font: 'bold 16px sans-serif',
      color: rgba(gCol[0], gCol[1], gCol[2], 1)
    });
  }

  const cBgTop = lerpColor(data.b0.bgTop, data.b1.bgTop, data.t);
  const cBgBot = lerpColor(data.b0.bgBot, data.b1.bgBot, data.t);
  const cEdge = lerpColor(data.b0.rockEdge, data.b1.rockEdge, data.t);
  const cMid = lerpColor(data.b0.rockMid, data.b1.rockMid, data.t);
  currentGlowRgb = lerpColor(data.b0.glowColor, data.b1.glowColor, data.t);

  bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, rgba(cBgTop[0], cBgTop[1], cBgTop[2], 1));
  bgGrad.addColorStop(1, rgba(cBgBot[0], cBgBot[1], cBgBot[2], 1));

  rockGrad = ctx.createLinearGradient(0, 0, W, 0);
  rockGrad.addColorStop(0, rgba(cEdge[0], cEdge[1], cEdge[2], 1));
  rockGrad.addColorStop(0.5, rgba(cMid[0], cMid[1], cMid[2], 1));
  rockGrad.addColorStop(1, rgba(cEdge[0], cEdge[1], cEdge[2], 1));
}
updateDynamicGradients(0);

/**
 * In-place array pruning utility (avoids array allocations of .filter)
 * @param {Array} arr - The target array to prune
 * @param {Function} predicate - Condition function (returns true to keep item)
 */
function pruneArray(arr, predicate) {
  let write = 0;
  for (let read = 0; read < arr.length; read++) {
    if (predicate(arr[read])) {
      arr[write++] = arr[read];
    }
  }
  arr.length = write;
}

// Generates random 3-point jitter offsets for organic cave wall texture
function jitterSet() {
  return [(Math.random() * 2 - 1) * 9, (Math.random() * 2 - 1) * 9, (Math.random() * 2 - 1) * 9];
}

// Coordinate conversion helpers between world space and canvas screen space
function screenYForWorldY(wy) { return currentFixedY + (wy - depthScrolled); }
function worldYForScreenY(sy) { return sy - currentFixedY + depthScrolled; }

/**
 * Calculates linear interpolated cavern wall boundaries at a given world Y position
 * @param {number} worldY - The world Y coordinate to inspect
 * @returns {Object} Boundaries object containing leftX, rightX, pillarLeft, pillarRight
 */
function getChannelData(worldY) {
  if (points.length < 2) {
    const c = W / 2;
    channelResult.leftX = WALL_MARGIN;
    channelResult.rightX = W - WALL_MARGIN;
    channelResult.pillarLeft = c;
    channelResult.pillarRight = c;
    return channelResult;
  }
  let i = 0;
  while (i < points.length - 2 && points[i + 1].worldY < worldY) i++;
  const p0 = points[i], p1 = points[i + 1];
  const span = (p1.worldY - p0.worldY) || 1;
  const t = Math.max(0, Math.min(1, (worldY - p0.worldY) / span));
  channelResult.leftX = p0.leftX + (p1.leftX - p0.leftX) * t;
  channelResult.rightX = p0.rightX + (p1.rightX - p0.rightX) * t;
  channelResult.pillarLeft = p0.pillarLeft + (p1.pillarLeft - p0.pillarLeft) * t;
  channelResult.pillarRight = p0.pillarRight + (p1.pillarRight - p0.pillarRight) * t;
  return channelResult;
}

/**
 * Returns available open channel paths at a given world Y position (1 or 2 channels if split)
 */
function getChannelsAt(worldY) {
  const b = getChannelData(worldY);
  if (b.pillarRight - b.pillarLeft > 3) {
    channelListDouble[0].left = b.leftX;
    channelListDouble[0].right = b.pillarLeft;
    channelListDouble[1].left = b.pillarRight;
    channelListDouble[1].right = b.rightX;
    return channelListDouble;
  }
  channelListSingle[0].left = b.leftX;
  channelListSingle[0].right = b.rightX;
  return channelListSingle;
}

// Guaranteed minimum channel width (20px hitbox + 18px clearance = 38px)
const MIN_CHANNEL_WIDTH = 38;

// -----------------------------------------------------------------------------
// 7. Procedural Cavern Generation
// -----------------------------------------------------------------------------

/**
 * Generates a multi-segment split fork cavern sequence with central rock pillar
 */
function planSplit(startWorldY, leftX, rightX) {
  const seq = [];
  const gap = Math.max(200, rightX - leftX);
  let center = (leftX + rightX) / 2;
  const maxPillar = 50 + Math.random() * 45;
  const steps = [
    { dw: 150, pf: 0.0 },
    { dw: 160, pf: 0.55 },
    { dw: 180, pf: 1.0 },
    { dw: 180, pf: 1.0 },
    { dw: 160, pf: 0.55 },
    { dw: 150, pf: 0.0 }
  ];
  let curWorldY = startWorldY;
  let curLeft = leftX, curRight = rightX;
  let bonusAdded = false;
  for (let idx = 0; idx < steps.length; idx++) {
    const s = steps[idx];
    curWorldY += s.dw;
    if (idx >= 2 && idx <= 3) {
      center += (Math.random() * 2 - 1) * 16;
      const localGap = Math.max(200, gap + (Math.random() * 20 - 10));
      curLeft = Math.max(WALL_MARGIN, center - localGap / 2);
      curRight = Math.min(W - WALL_MARGIN, center + localGap / 2);
    }

    // Clamp pillar width so BOTH left & right split channels are guaranteed >= MIN_CHANNEL_WIDTH (38px)
    const availableSpace = curRight - curLeft;
    const maxPillarWidth = Math.max(0, availableSpace - (MIN_CHANNEL_WIDTH * 2));
    const pillarWidth = Math.min(maxPillar * s.pf, maxPillarWidth);
    const pillarHalf = pillarWidth / 2;

    // Position center so pLeft - curLeft >= 38px AND curRight - pRight >= 38px
    const minCenter = curLeft + MIN_CHANNEL_WIDTH + pillarHalf;
    const maxCenter = curRight - MIN_CHANNEL_WIDTH - pillarHalf;
    if (maxCenter >= minCenter) {
      center = Math.max(minCenter, Math.min(maxCenter, center));
    }

    const pLeft = center - pillarHalf;
    const pRight = center + pillarHalf;

    const pt = {
      worldY: curWorldY, leftX: curLeft, rightX: curRight,
      pillarLeft: pLeft, pillarRight: pRight, pocket: null,
      lj: jitterSet(), rj: jitterSet()
    };
    seq.push(pt);

    // Spawn bonus plankton inside split channel
    if (idx === 2 && !bonusAdded) {
      bonusAdded = true;
      const side = Math.random() < 0.5 ? 'left' : 'right';
      const bx = side === 'left' ? (curLeft + pLeft) / 2 : (pRight + curRight) / 2;
      plankton.push({ x: bx, worldY: curWorldY, r: 8, collected: false, bob: Math.random() * Math.PI * 2, bonus: true });
    }
  }
  lastCenterForGen = center;
  return seq;
}

/**
 * Creates the next procedural control point for the descending cavern corridor
 */
function makeNextPoint() {
  if (pendingQueue.length) return pendingQueue.shift();

  const prev = points[points.length - 1];
  const worldY = (prev ? prev.worldY : 0) + SEGMENT_SPACING;
  const depthFactor = Math.min(worldY / 9000, 1);
  const minGap = 230 - depthFactor * 70;
  const maxGap = 270 - depthFactor * 55;
  let gap = minGap + Math.random() * (maxGap - minGap);
  gap = Math.max(gap, MIN_CHANNEL_WIDTH + 24);

  let center = lastCenterForGen + (Math.random() * 2 - 1) * 75;
  const minCenter = WALL_MARGIN + gap / 2;
  const maxCenter = W - WALL_MARGIN - gap / 2;
  center = Math.max(minCenter, Math.min(maxCenter, center));
  lastCenterForGen = center;

  let leftX = center - gap / 2;
  let rightX = center + gap / 2;
  let pillarLeft = center, pillarRight = center;
  let pocket = null;

  const canFeature = worldY > FEATURE_MIN_DEPTH;
  const roll = Math.random();

  if (canFeature && roll < 0.15) {
    const seq = planSplit(worldY, leftX, rightX);
    pendingQueue.push(...seq);
  } else if (canFeature && roll < 0.15 + 0.22) {
    // Generate side alcove pocket
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const extra = 85 + Math.random() * 70;
    let pLeftX = leftX, pRightX = rightX;
    let plankX;
    if (side === 'right') {
      pRightX = Math.min(W - 8, rightX + extra);
      plankX = rightX + extra * 0.55;
    } else {
      pLeftX = Math.max(8, leftX - extra);
      plankX = leftX - extra * 0.55;
    }
    pocket = { side };
    pendingQueue.push({
      worldY: worldY + 95, leftX: pLeftX, rightX: pRightX,
      pillarLeft: (pLeftX + pRightX) / 2, pillarRight: (pLeftX + pRightX) / 2,
      pocket: null, lj: jitterSet(), rj: jitterSet()
    });
    plankton.push({ x: plankX, worldY: worldY + 40, r: 8, collected: false, bob: Math.random() * Math.PI * 2, bonus: true });
    leftX = pLeftX; rightX = pRightX;
  }

  // Spawn decorative wall flora
  if (Math.random() < 0.5 && !pocket) {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const fx = side === 'left' ? leftX + 6 + Math.random() * 16 : rightX - 6 - Math.random() * 16;
    flora.push({ x: fx, worldY: worldY + (Math.random() * 2 - 1) * 60, glowSeed: Math.random() * 10 });
  }

  return { worldY, leftX, rightX, pillarLeft, pillarRight, pocket, lj: jitterSet(), rj: jitterSet() };
}

/**
 * Ensures enough cavern control points exist ahead of current scroll depth
 */
function ensurePoints() {
  if (points.length === 0) {
    const c = W / 2;
    points.push({ worldY: -50, leftX: c - 110, rightX: c + 110, pillarLeft: c, pillarRight: c, pocket: null, lj: [0, 0, 0], rj: [0, 0, 0] });
  }
  while (points[points.length - 1].worldY < depthScrolled + LOOKAHEAD_WORLD) {
    points.push(makeNextPoint());
  }
  while (points.length > 3 && points[1].worldY < depthScrolled - 300) points.shift();
}

// -----------------------------------------------------------------------------
// 8. Stepped Speed Progression & Game Lifecycle
// -----------------------------------------------------------------------------

/**
 * Calculates descent speed with 300m stage plateaus (20% speed ramp, 80% steady plateau)
 * @param {number} depth - World depth scrolled
 */
function calculateSteppedSpeed(depth) {
  const cycle = 300 * 14; // 300m per stage cycle
  const stage = Math.floor(depth / cycle);
  const progressInCycle = (depth % cycle) / cycle;
  const rampProgress = Math.min(1, progressInCycle / 0.20); // 20% speed ramp, 80% steady plateau
  const baseStageSpeed = 2.0 + stage * 1.2;
  const nextStageSpeed = 2.0 + (stage + 1) * 1.2;
  return baseStageSpeed + (nextStageSpeed - baseStageSpeed) * rampProgress;
}

/**
 * Resets all gameplay variables to initialize a fresh run
 */
function resetGame() {
  jelly.x = W / 2;
  targetX = jelly.x;
  prevJellyX = jelly.x;
  touchActive = false;
  activeTouchId = null;
  touchMoved = false;
  currentFixedY = H * 0.32;
  depthScrolled = 0;
  scrollSpeed = 2;
  currentBiomeIdx = 0;
  lastAnnouncedBiome = -1;
  updateDynamicGradients(0);
  score = 0;
  frame = 0;
  points = [];
  pendingQueue = [];
  lastCenterForGen = W / 2;
  hazards.length = 0;
  plankton.length = 0;
  flora.length = 0;
  popups.length = 0;
  currents.length = 0;
  eatActive = false;
  eatTimer = 0;
  eatFactor = 0;
  darkFactor = 0;
  magnetTimer = 0;
  magnetAlpha = 0;
  isPaused = false;
  pauseOverlay.style.display = 'none';
  trailHead = 0;
  trailCount = 0;
  spawnTimer = 0;
  overlay.querySelector('h1').textContent = 'TIDAL';
  ensurePoints();
}

// Pause Control Functions
function pauseGame() {
  if (state === 'playing' && !isPaused) {
    isPaused = true;
    pauseOverlay.style.display = 'flex';

    const currentRunScore = Math.max(0, Math.floor(score)) + Math.floor(depthScrolled / 14);
    if (currentRunScore > best) {
      best = currentRunScore;
      saveBestScore(best);
    }

    if (pauseScoreLine) {
      pauseScoreLine.style.display = 'block';
      pauseScoreLine.innerHTML = `
        <div style="font-size:13px; opacity:0.85; margin-bottom:3px;">Current Run: ${currentRunScore}</div>
        <div style="font-size:16px; color:var(--glow-teal); font-weight:bold;">Top Score: ${best}</div>
      `;
    }
  }
}

function resumeGame() {
  if (state === 'playing' && isPaused) {
    isPaused = false;
    pauseOverlay.style.display = 'none';
    lastTime = performance.now(); // Reset delta timer to prevent movement jump
    targetX = jelly.x;
    prevJellyX = jelly.x;
    touchActive = false;
    activeTouchId = null;
    touchMoved = false;
    justResumedTime = performance.now();
  }
}

function togglePause() {
  if (state === 'playing') {
    if (isPaused) resumeGame();
    else pauseGame();
  }
}

/**
 * Activates Eat Mode (costs 100 Plankton to crunch next hazard)
 */
function triggerEatMode() {
  if (state !== 'playing') return;
  if (eatActive) return;
  if (score >= 100) {
    score -= 100;
    eatActive = true;

    // Duration decreases by 1 second for every 400m depth, down to a minimum of 1 second
    const depthMeters = Math.floor(depthScrolled / 14);
    const depthIncrements = Math.floor(depthMeters / 400);
    const maxEatSeconds = Math.max(1, 5 - depthIncrements);

    eatTimer = Math.round(maxEatSeconds * 60);
    popups.push({
      text: '-100',
      x: jelly.x,
      y: currentFixedY - 22,
      alpha: 1,
      life: 0,
      color: '#ff6b5e'
    });
  }
}

// Ambient Background Floating Particles Setup
function initAmbient() {
  particles = [];
  for (let i = 0; i < 50; i++) {
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.6 + 0.3,
      speed: Math.random() * 0.3 + 0.05,
      alpha: Math.random() * 0.5 + 0.15
    });
  }
}
initAmbient();
ensurePoints();

function startGame() {
  resetGame();
  state = 'playing';
  overlay.style.opacity = '0';
  overlay.style.pointerEvents = 'none';
}

/**
 * Triggers game over sequence and updates final score breakdown
 */
function endGame() {
  state = 'dead';
  isPaused = false;
  pauseOverlay.style.display = 'none';

  const planktonGathered = Math.max(0, Math.floor(score));
  const depthReached = Math.floor(depthScrolled / 14);
  const totalScore = planktonGathered + depthReached;

  if (totalScore > best) {
    best = totalScore;
    saveBestScore(best);
  }

  overlay.style.opacity = '1';
  overlay.style.pointerEvents = 'auto';
  overlay.querySelector('h1').textContent = 'SUNK';
  const scoreLine = document.getElementById('gameScoreLine');
  if (scoreLine) {
    scoreLine.style.display = 'block';
    scoreLine.innerHTML = `
      <div style="font-size:14px; opacity:0.9; margin-bottom:3px;">Plankton gathered: ${planktonGathered}</div>
      <div style="font-size:14px; opacity:0.9; margin-bottom:6px;">Depth: ${depthReached}m</div>
      <div style="font-size:17px; color:var(--glow-teal); font-weight:bold;">Total: ${totalScore} &nbsp;&middot;&nbsp; Best: ${best}</div>
    `;
  }
  startBtn.textContent = 'Drift again';
}

// -----------------------------------------------------------------------------
// 9. Entity Spawning Logic
// -----------------------------------------------------------------------------

/**
 * Checks if candidate spawn coordinates overlap with any active hazard
 */
function isOverlapWithHazard(x, worldY, radius) {
  const minDist = radius * 2 + 12; // Minimum clearance spacing between barnacle centers
  for (let i = 0; i < hazards.length; i++) {
    const h = hazards[i];
    if (h.eaten) continue;
    const dx = x - h.x;
    const dy = worldY - h.worldY;
    if (Math.hypot(dx, dy) < minDist) {
      return true;
    }
  }
  return false;
}

/**
 * Spawns hazards, barnacle rows, plankton, and tidal currents ahead of the player
 */
function spawnDrift() {
  const spawnWorldY = depthScrolled + H + 60;
  const channels = getChannelsAt(spawnWorldY);
  const ch = channels[Math.floor(Math.random() * channels.length)];
  const margin = 24;
  const minX = ch.left + margin;
  const maxX = ch.right - margin;
  if (maxX <= minX) return;

  const depthMeters = Math.floor(depthScrolled / 14);

  // Barnacle Row Formations in deep waters (450m+)
  if (depthMeters >= 450 && Math.random() < 0.32) {
    const count = Math.random() < 0.5 ? 2 : 3;
    const stepX = (maxX - minX) / (count + 1);
    const gapIdx = Math.floor(Math.random() * (count + 1));
    for (let i = 1; i <= count; i++) {
      if (i === gapIdx + 1) continue; // Leave open gap to thread through!
      const hx = minX + i * stepX + (Math.random() * 8 - 4);
      if (!isOverlapWithHazard(hx, spawnWorldY, 11)) {
        hazards.push({ x: hx, worldY: spawnWorldY, r: 11, spin: Math.random() * Math.PI * 2 });
      }
    }
  } else if (Math.random() < 0.42) {
    // Single hazard spawn with anti-overlap retry attempts
    for (let attempt = 0; attempt < 5; attempt++) {
      const x = minX + Math.random() * (maxX - minX);
      if (!isOverlapWithHazard(x, spawnWorldY, 11)) {
        hazards.push({ x, worldY: spawnWorldY, r: 11, spin: Math.random() * Math.PI * 2 });
        break;
      }
    }
  } else {
    const x = minX + Math.random() * (maxX - minX);
    if (!isOverlapWithHazard(x, spawnWorldY, 7)) {
      plankton.push({ x, worldY: spawnWorldY, r: 7, collected: false, bob: Math.random() * Math.PI * 2, bonus: false });
    }
  }

  // Tidal Current spawning (rare 5% power-up spawn)
  if (Math.random() < 0.05) {
    const cx = minX + Math.random() * (maxX - minX);
    if (!isOverlapWithHazard(cx, spawnWorldY + 30, 18)) {
      currents.push({ x: cx, worldY: spawnWorldY + 30, r: 18, collected: false, rot: Math.random() * Math.PI * 2 });
    }
  }
}

// -----------------------------------------------------------------------------
// 10. Rendering Functions
// -----------------------------------------------------------------------------

function drawAmbient() {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.y -= (currentBiomeIdx === 3 ? p.speed * 2.2 : p.speed);
    if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
    ctx.beginPath();
    ctx.fillStyle = rgba(currentGlowRgb[0], currentGlowRgb[1], currentGlowRgb[2], p.alpha);
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function buildJaggedPathBuf(list, sideKey, jitterKey) {
  let count = 0;
  for (let idx = 0; idx < list.length - 1; idx++) {
    const p0 = list[idx], p1 = list[idx + 1];
    const y0 = screenYForWorldY(p0.worldY), y1 = screenYForWorldY(p1.worldY);
    const x0 = p0[sideKey], x1 = p1[sideKey];
    const jit = p0[jitterKey] || [0, 0, 0];
    const steps = jit.length + 1;
    if (idx === 0) {
      if (count + 2 > pathBuf.length) expandPathBuf(count + 2);
      pathBuf[count++] = x0;
      pathBuf[count++] = y0;
    }
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const bx = x0 + (x1 - x0) * t;
      const by = y0 + (y1 - y0) * t;
      const jAmt = s <= jit.length ? jit[s - 1] * Math.sin(t * Math.PI) : 0;
      if (count + 2 > pathBuf.length) expandPathBuf(count + 2);
      pathBuf[count++] = bx + jAmt;
      pathBuf[count++] = by;
    }
  }
  return count;
}

function drawFlora() {
  for (let i = 0; i < flora.length; i++) {
    const f = flora[i];
    const sy = screenYForWorldY(f.worldY);
    if (sy < -20 || sy > H + 20) continue;
    const pulse = 0.4 + 0.35 * Math.sin(frame * 0.04 + f.glowSeed);
    const alpha = 0.35 + pulse * 0.3;

    // Fast layered glow replacing expensive shadowBlur
    ctx.beginPath();
    ctx.fillStyle = rgba(currentGlowRgb[0], currentGlowRgb[1], currentGlowRgb[2], alpha * 0.35);
    ctx.arc(f.x, sy, 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = rgba(currentGlowRgb[0], currentGlowRgb[1], currentGlowRgb[2], alpha);
    ctx.arc(f.x, sy, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCave() {
  const topWY = worldYForScreenY(-60);
  const botWY = worldYForScreenY(H + 60);

  caveList.length = 0;
  const startB = getChannelData(topWY);
  caveList.push({ worldY: topWY, leftX: startB.leftX, rightX: startB.rightX, pillarLeft: startB.pillarLeft, pillarRight: startB.pillarRight });
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.worldY > topWY && p.worldY < botWY) caveList.push(p);
  }
  const endB = getChannelData(botWY);
  caveList.push({ worldY: botWY, leftX: endB.leftX, rightX: endB.rightX, pillarLeft: endB.pillarLeft, pillarRight: endB.pillarRight });

  ctx.fillStyle = rockGrad;

  const strokeLight = rgba(currentGlowRgb[0], currentGlowRgb[1], currentGlowRgb[2], 0.18);
  const strokeHeavy = rgba(currentGlowRgb[0], currentGlowRgb[1], currentGlowRgb[2], 0.45);
  const strokeMid   = rgba(currentGlowRgb[0], currentGlowRgb[1], currentGlowRgb[2], 0.30);

  // Left wall
  const leftCount = buildJaggedPathBuf(caveList, 'leftX', 'lj');
  ctx.beginPath();
  ctx.moveTo(0, pathBuf[1]);
  for (let i = 0; i < leftCount; i += 2) ctx.lineTo(pathBuf[i], pathBuf[i + 1]);
  ctx.lineTo(0, pathBuf[leftCount - 1]);
  ctx.closePath();
  ctx.fill();

  // Dual glow stroke (replaces shadowBlur)
  ctx.strokeStyle = strokeLight;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(pathBuf[0], pathBuf[1]);
  for (let i = 0; i < leftCount; i += 2) ctx.lineTo(pathBuf[i], pathBuf[i + 1]);
  ctx.stroke();

  ctx.strokeStyle = strokeHeavy;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(pathBuf[0], pathBuf[1]);
  for (let i = 0; i < leftCount; i += 2) ctx.lineTo(pathBuf[i], pathBuf[i + 1]);
  ctx.stroke();

  // Right wall
  const rightCount = buildJaggedPathBuf(caveList, 'rightX', 'rj');
  ctx.beginPath();
  ctx.moveTo(W, pathBuf[1]);
  for (let i = 0; i < rightCount; i += 2) ctx.lineTo(pathBuf[i], pathBuf[i + 1]);
  ctx.lineTo(W, pathBuf[rightCount - 1]);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = strokeLight;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(pathBuf[0], pathBuf[1]);
  for (let i = 0; i < rightCount; i += 2) ctx.lineTo(pathBuf[i], pathBuf[i + 1]);
  ctx.stroke();

  ctx.strokeStyle = strokeHeavy;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(pathBuf[0], pathBuf[1]);
  for (let i = 0; i < rightCount; i += 2) ctx.lineTo(pathBuf[i], pathBuf[i + 1]);
  ctx.stroke();

  // Fork divider
  let firstFork = -1, lastFork = -1;
  for (let i = 0; i < caveList.length; i++) {
    if (caveList[i].pillarRight - caveList[i].pillarLeft > 3) {
      if (firstFork === -1) firstFork = i;
      lastFork = i;
    }
  }
  if (firstFork >= 0 && lastFork > firstFork) {
    const startIdx = Math.max(0, firstFork - 1);
    const endIdx = Math.min(caveList.length - 1, lastFork + 1);
    ctx.fillStyle = rockGrad;
    ctx.strokeStyle = strokeMid;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const pt0 = caveList[startIdx];
    ctx.moveTo(pt0.pillarLeft, screenYForWorldY(pt0.worldY));
    for (let k = startIdx; k <= endIdx; k++) ctx.lineTo(caveList[k].pillarLeft, screenYForWorldY(caveList[k].worldY));
    for (let k = endIdx; k >= startIdx; k--) ctx.lineTo(caveList[k].pillarRight, screenYForWorldY(caveList[k].worldY));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * Renders the Jellyfish player sprite, tentacle dynamics, and power-up glow effects
 */
function drawJelly() {
  const bx = jelly.x, by = currentFixedY, r = 11.5;
  rebuildJellyColors(eatFactor);

  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(jelly.tilt);

  // Radial glow — gradient cached by radMult key to avoid createRadialGradient every frame
  const radMult = 3.2 + 1.0 * eatFactor;
  const radMultKey = Math.round(radMult * 100);
  if (_jellyGradCache === null || _jellyGradRadMult !== radMultKey) {
    _jellyGradRadMult = radMultKey;
    // createRadialGradient at local (0,0) — valid because we are inside ctx.translate(bx,by)
    _jellyGradCache = ctx.createRadialGradient(0, 0, 2, 0, 0, r * radMult);
    _jellyGradCache.addColorStop(0, _jellyGlowColor);
    _jellyGradCache.addColorStop(1, _jellyGlowColorT);
  }
  ctx.fillStyle = _jellyGradCache;
  ctx.beginPath();
  ctx.arc(0, 0, r * radMult, 0, Math.PI * 2);
  ctx.fill();

  // Dome fill (cached)
  ctx.beginPath();
  ctx.fillStyle = _jellyDomeColor;
  ctx.ellipse(0, 0, r, r * 0.8, 0, Math.PI, 0);
  ctx.quadraticCurveTo(r, r * 0.5, 0, r * 0.35);
  ctx.quadraticCurveTo(-r, r * 0.5, -r, 0);
  ctx.fill();

  // Tentacles (cached)
  const t = frame * 0.08;
  ctx.strokeStyle = _jellyTentColor;
  ctx.lineWidth = _jellyTentW;

  for (let i = -2; i <= 2; i++) {
    const ox = i * (r * (0.32 - 0.04 * eatFactor));
    ctx.beginPath();
    ctx.moveTo(ox, r * 0.3);

    const wob = Math.sin(t + i) * 5;
    const flare = i * 15 + Math.sin(t * 1.5 + i) * 3;
    const curX = wob * (1 - eatFactor) + flare * eatFactor;
    const curY = (r * 1.6) * (1 - eatFactor) + (r * 2.2 + Math.abs(i) * 2) * eatFactor;

    ctx.quadraticCurveTo(ox + curX * (0.5 + 0.1 * eatFactor), r * (1.6 - 0.5 * eatFactor), curX, curY);
    ctx.stroke();
  }

  // Spinning magnetic field curves ( ) arcs around player with quick fade-out
  if (magnetAlpha > 0.01) {
    const rotSpeed = frame * 0.14;
    ctx.strokeStyle = rgba(76, 224, 210, 0.85 * magnetAlpha);
    ctx.lineWidth = 2.2;

    const radii = [r * 2.0, r * 2.8];
    for (let rIdx = 0; rIdx < radii.length; rIdx++) {
      const rad = radii[rIdx];
      const dir = rIdx % 2 === 0 ? 1 : -1;
      ctx.save();
      ctx.rotate(rotSpeed * dir);

      // Right arc: )
      ctx.beginPath();
      ctx.arc(0, 0, rad, -0.45, 0.45);
      ctx.stroke();

      // Left opposing arc: (
      ctx.beginPath();
      ctx.arc(0, 0, rad, Math.PI - 0.45, Math.PI + 0.45);
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.restore();
}

function drawHazard(h) {
  const sy = screenYForWorldY(h.worldY);
  if (sy < -30 || sy > H + 30) return;
  ctx.save();
  ctx.translate(h.x, sy);
  ctx.rotate(h.spin + frame * 0.03);

  // Soft glow layer replacing expensive shadowBlur
  ctx.fillStyle = 'rgba(255,107,94,0.25)';
  ctx.beginPath();
  ctx.arc(0, 0, h.r * 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,107,94,0.85)';
  ctx.beginPath();
  ctx.arc(0, 0, h.r * 0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,140,120,0.8)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * h.r * 0.5, Math.sin(a) * h.r * 0.5);
    ctx.lineTo(Math.cos(a) * h.r * 1.5, Math.sin(a) * h.r * 1.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlankton(p) {
  const sy = screenYForWorldY(p.worldY) + Math.sin(frame * 0.05 + p.bob) * 4;
  if (sy < -20 || sy > H + 20) return;
  ctx.save();
  const rad = p.bonus ? 13 : 10;
  const grad = ctx.createRadialGradient(p.x, sy, 0, p.x, sy, rad);
  grad.addColorStop(0, p.bonus ? 'rgba(255,235,180,0.95)' : 'rgba(255,217,142,0.9)');
  grad.addColorStop(1, 'rgba(255,217,142,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(p.x, sy, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe9c2';
  ctx.beginPath();
  ctx.arc(p.x, sy, p.bonus ? 4 : 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTrail() {
  for (let i = 0; i < trailCount; i++) {
    const idx = (trailHead - trailCount + i + MAX_TRAIL) % MAX_TRAIL;
    const t = trailPool[idx];
    const sy = screenYForWorldY(t.worldY);
    if (sy < -20 || sy > H + 20) continue;
    const alpha = (i / trailCount) * 0.3;
    ctx.beginPath();
    ctx.fillStyle = rgba(76, 224, 210, alpha);
    ctx.arc(t.x, sy, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCurrents() {
  for (let i = 0; i < currents.length; i++) {
    const c = currents[i];
    if (c.collected) continue;
    const sy = screenYForWorldY(c.worldY);
    if (sy < -30 || sy > H + 30) continue;
    ctx.save();
    ctx.translate(c.x, sy);
    ctx.rotate(c.rot + frame * 0.05);

    ctx.strokeStyle = 'rgba(76, 224, 210, 0.8)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, c.r, 0, Math.PI * 1.5);
    ctx.stroke();

    ctx.fillStyle = 'rgba(76, 224, 210, 0.3)';
    ctx.beginPath();
    ctx.arc(0, 0, c.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Renders dark abyssal overlay using a clip-path punch-out.
 * Avoids createRadialGradient (which forces Skia software rasterization on Firefox)
 * by instead clipping out a circular "spotlight" hole and filling solid dark.
 */
function drawDarkOverlay() {
  if (darkFactor < 0.01) return;
  ctx.save();
  const jx = jelly.x, jy = currentFixedY;
  const spotRad = 130 + (eatActive ? 35 : 0) + (magnetTimer > 0 ? 25 : 0);

  // Even-odd fill rule: outer rect fills dark, inner circle is punched out as transparent
  ctx.beginPath();
  // Outer rectangle (entire canvas)
  ctx.rect(0, 0, W, H);
  // Spotlight hole (drawn clockwise cancels with rect's winding, punching a hole)
  ctx.arc(jx, jy, spotRad, 0, Math.PI * 2, true);
  ctx.fillStyle = rgba(5, 11, 20, 0.88 * darkFactor);
  ctx.fill('evenodd');

  // Soft inner-edge fade ring: a slightly larger semi-transparent ring
  ctx.beginPath();
  ctx.arc(jx, jy, spotRad * 1.05, 0, Math.PI * 2);
  ctx.arc(jx, jy, spotRad * 0.85, 0, Math.PI * 2, true);
  ctx.fillStyle = rgba(5, 11, 20, 0.45 * darkFactor);
  ctx.fill('evenodd');

  ctx.restore();
}

function drawPopups() {
  for (let i = 0; i < popups.length; i++) {
    const pop = popups[i];
    ctx.save();
    ctx.font = pop.font || 'bold 15px sans-serif';
    ctx.fillStyle = pop.color || '#ff6b5e';
    ctx.globalAlpha = pop.alpha;
    ctx.textAlign = 'center';
    ctx.fillText(pop.text, pop.x, pop.y);
    ctx.restore();
  }
}

// -----------------------------------------------------------------------------
// 11. Fixed Timestep Engine Update & Physics Loop
// -----------------------------------------------------------------------------

/**
 * Main physics update function executing at fixed 60 FPS
 */
function update() {
  frame++;

  if (state === 'playing') {
    const depthMeters = Math.floor(depthScrolled / 14);
    updateDynamicGradients(depthMeters);

    // Player steering controller
    const activeKeySpeed = KEY_SPEED + 1.2 + Math.min(depthScrolled / 2500, 3.5);
    if (useKeyboard) {
      if (leftPressed) jelly.x -= activeKeySpeed;
      if (rightPressed) jelly.x += activeKeySpeed;
      targetX = jelly.x;
    } else {
      jelly.x += (targetX - jelly.x) * 0.25;
    }
    jelly.x = Math.max(6, Math.min(W - 6, jelly.x));

    // Tilt animation calculation
    const vx = jelly.x - prevJellyX;
    jelly.tilt = Math.max(-0.5, Math.min(0.5, vx * 0.12));
    prevJellyX = jelly.x;

    // Continuously increase descent speed with staged plateaus
    scrollSpeed = calculateSteppedSpeed(depthScrolled);
    depthScrolled += scrollSpeed;

    // Abyssal Dark Zone periodic logic (deep waters 750m+)
    const isDarkZone = (depthMeters >= 750 && (Math.floor(depthMeters / 400) % 2 === 0));
    const targetDark = isDarkZone ? 0.85 : 0.0;
    darkFactor += (targetDark - darkFactor) * 0.03;

    // Magnetic timer update
    if (magnetTimer > 0) magnetTimer--;

    // Elevate camera position as HUD depth reaches 700m to expand viewable distance below
    const depthProgress = Math.max(0, Math.min(1, (depthMeters - 600) / 100));
    const targetFixedY = H * (0.32 - depthProgress * 0.20);
    currentFixedY += (targetFixedY - currentFixedY) * 0.08;

    ensurePoints();

    // Store trail point in ring buffer
    const t = trailPool[trailHead];
    t.x = jelly.x;
    t.worldY = depthScrolled;
    trailHead = (trailHead + 1) % MAX_TRAIL;
    if (trailCount < MAX_TRAIL) trailCount++;

    // Entity spawner timer tick
    spawnTimer++;
    const spawnEvery = Math.max(35, 95 - Math.floor(depthScrolled / 150));
    if (spawnTimer > spawnEvery) {
      spawnTimer = 0;
      spawnDrift();
    }

    // Update Eat Mode timer & smooth color transition factor
    if (eatActive) {
      eatTimer--;
      if (eatTimer <= 0) {
        eatActive = false;
      }
    }
    const targetEatFactor = eatActive ? 1.0 : 0.0;
    eatFactor += (targetEatFactor - eatFactor) * 0.04;

    // Cavern wall collision detection
    const b = getChannelData(depthScrolled);
    let hit = false;
    if (jelly.x - jelly.radius < b.leftX || jelly.x + jelly.radius > b.rightX) hit = true;
    const pillarWidth = b.pillarRight - b.pillarLeft;
    if (pillarWidth > 3 && jelly.x + jelly.radius > b.pillarLeft && jelly.x - jelly.radius < b.pillarRight) hit = true;
    if (hit) endGame();

    // Hazard collision detection & Eat Mode crunching
    for (let i = 0; i < hazards.length; i++) {
      const h = hazards[i];
      if (h.eaten) continue;
      const sy = screenYForWorldY(h.worldY);
      const d = Math.hypot(jelly.x - h.x, currentFixedY - sy);
      const hitRadius = eatActive ? (jelly.radius + h.r * 1.2 + 10) : (jelly.radius + h.r * 0.6);
      if (d < hitRadius) {
        if (eatActive) {
          h.eaten = true;
          eatActive = false;
          eatTimer = 0;
          popups.push({
            text: 'CRUNCH!',
            x: h.x,
            y: sy - 15,
            alpha: 1,
            life: 0,
            color: '#4ce0d2'
          });
          for (let p = 0; p < 10; p++) {
            particles.push({
              x: h.x,
              y: sy,
              r: Math.random() * 2 + 1,
              speed: Math.random() * 0.4 + 0.1,
              alpha: 1
            });
          }
        } else {
          endGame();
        }
      }
    }
    pruneArray(hazards, h => !h.eaten && screenYForWorldY(h.worldY) > -40);

    // Tidal Current collisions
    for (let i = 0; i < currents.length; i++) {
      const c = currents[i];
      if (c.collected) continue;
      const sy = screenYForWorldY(c.worldY);
      const d = Math.hypot(jelly.x - c.x, currentFixedY - sy);
      if (d < jelly.radius + c.r) {
        c.collected = true;
        magnetTimer = 180; // 3 sec magnetic pull!
        popups.push({
          text: 'MAGNETIC SURGE!',
          x: jelly.x,
          y: currentFixedY - 25,
          alpha: 1,
          life: 0,
          color: '#4ce0d2'
        });
      }
    }
    pruneArray(currents, c => !c.collected && screenYForWorldY(c.worldY) > -40);

    // Update magnetic fade-out factor
    const targetMagAlpha = magnetTimer > 0 ? Math.min(1, magnetTimer / 15) : 0;
    magnetAlpha += (targetMagAlpha - magnetAlpha) * 0.2;

    // Plankton collection & Magnetic attraction (pulls toward player, stronger closer to player)
    for (let i = 0; i < plankton.length; i++) {
      const p = plankton[i];
      if (p.collected) continue;

      if (magnetTimer > 0) {
        const dx = jelly.x - p.x;
        const dy = depthScrolled - p.worldY;
        const dist = Math.hypot(dx, dy);

        if (dist < 220 && dist > 0.5) {
          const ux = dx / dist;
          const uy = dy / dist;
          // Magnetic pull gets progressively stronger as plankton nears player
          const pullStrength = 2.5 + (1 - dist / 220) * 7.5;
          p.x += ux * pullStrength;
          p.worldY += uy * pullStrength;
        }
      }

      const sy = screenYForWorldY(p.worldY);
      const d = Math.hypot(jelly.x - p.x, currentFixedY - sy);
      if (d < jelly.radius + (p.bonus ? 13 : 10)) {
        p.collected = true;
        score += p.bonus ? 25 : 10;
      }
    }
    pruneArray(plankton, p => !p.collected && screenYForWorldY(p.worldY) > -40);
    pruneArray(flora, f => screenYForWorldY(f.worldY) > -60);

    // Update floating text popups
    for (let i = 0; i < popups.length; i++) {
      const pop = popups[i];
      const maxLife = pop.maxLife || 40;
      const fadeStart = pop.fadeStart || 0;
      pop.y -= pop.speed || 0.8;
      pop.life += 1;

      if (pop.life <= fadeStart) {
        pop.alpha = 1;
      } else {
        const fadeRange = maxLife - fadeStart;
        pop.alpha = Math.max(0, 1 - (pop.life - fadeStart) / fadeRange);
      }
    }
    pruneArray(popups, pop => pop.life < (pop.maxLife || 40));
  }
}

/**
 * Main render function assembling scene layers
 */
function render() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  drawAmbient();
  drawCave();
  drawFlora();
  drawTrail();
  drawCurrents();
  for (let i = 0; i < hazards.length; i++) if (!hazards[i].eaten) drawHazard(hazards[i]);
  for (let i = 0; i < plankton.length; i++) if (!plankton[i].collected) drawPlankton(plankton[i]);
  drawJelly();
  drawDarkOverlay();
  drawPopups();

  const newHud = (state === 'playing' || state === 'dead') ? ('Plankton  ' + Math.floor(score)) : 'Tidal';
  if (hud.textContent !== newHud) hud.textContent = newHud;

  // Toggle persistent status badge elements without DOM innerHTML allocations
  if (state === 'playing') {
    if (isPaused) {
      if (badgePaused.style.display !== 'block') badgePaused.style.display = 'block';
      if (badgeBiome && badgeBiome.style.display !== 'none') badgeBiome.style.display = 'none';
      if (badgeEatActive.style.display !== 'none') badgeEatActive.style.display = 'none';
      if (badgeEatReady.style.display !== 'none') badgeEatReady.style.display = 'none';
      if (badgeMagnetic.style.display !== 'none') badgeMagnetic.style.display = 'none';
      if (badgeDarkZone.style.display !== 'none') badgeDarkZone.style.display = 'none';
    } else {
      if (badgePaused.style.display !== 'none') badgePaused.style.display = 'none';

      if (badgeBiome) {
        const bTxt = `[${BIOMES[currentBiomeIdx].name}]`;
        if (badgeBiome.textContent !== bTxt) badgeBiome.textContent = bTxt;
        if (badgeBiome.style.display !== 'block') badgeBiome.style.display = 'block';
        badgeBiome.style.borderColor = rgba(currentGlowRgb[0], currentGlowRgb[1], currentGlowRgb[2], 0.6);
        badgeBiome.style.color = rgba(currentGlowRgb[0], currentGlowRgb[1], currentGlowRgb[2], 1);
      }

      if (eatActive) {
        const secLeft = Math.max(0, (eatTimer / 60)).toFixed(1);
        const txt = `[EAT MODE ${secLeft}s]`;
        if (badgeEatActive.textContent !== txt) badgeEatActive.textContent = txt;
        if (badgeEatActive.style.display !== 'block') badgeEatActive.style.display = 'block';
        if (badgeEatReady.style.display !== 'none') badgeEatReady.style.display = 'none';
      } else {
        if (badgeEatActive.style.display !== 'none') badgeEatActive.style.display = 'none';
        const readyShow = (score >= 100) ? 'block' : 'none';
        if (badgeEatReady.style.display !== readyShow) badgeEatReady.style.display = readyShow;
      }

      const magShow = (magnetTimer > 0) ? 'block' : 'none';
      if (badgeMagnetic.style.display !== magShow) badgeMagnetic.style.display = magShow;

      const darkShow = (darkFactor > 0.4) ? 'block' : 'none';
      if (badgeDarkZone.style.display !== darkShow) badgeDarkZone.style.display = darkShow;
    }
  } else {
    if (badgePaused.style.display !== 'none') badgePaused.style.display = 'none';
    if (badgeBiome && badgeBiome.style.display !== 'none') badgeBiome.style.display = 'none';
    if (badgeEatActive.style.display !== 'none') badgeEatActive.style.display = 'none';
    if (badgeEatReady.style.display !== 'none') badgeEatReady.style.display = 'none';
    if (badgeMagnetic.style.display !== 'none') badgeMagnetic.style.display = 'none';
    if (badgeDarkZone.style.display !== 'none') badgeDarkZone.style.display = 'none';
  }

  if (pauseBtn) {
    const showPause = (state === 'playing' && !isPaused) ? 'flex' : 'none';
    if (pauseBtn.style.display !== showPause) pauseBtn.style.display = showPause;
  }

  let depthText = state === 'playing' 
    ? ('depth ' + Math.floor(depthScrolled / 14) + 'm') 
    : (isMobileOrTablet ? 'touch & drag to steer' : 'follow with mouse, or use \u2190 \u2192');
  if (depthEl.textContent !== depthText) depthEl.textContent = depthText;
}

// -----------------------------------------------------------------------------
// 12. Main Loop & Event Controller Listeners
// -----------------------------------------------------------------------------
let lastTime = performance.now();
let accumulator = 0;
const STEP = 1000 / 60; // 60 FPS fixed physics timestep (16.66ms)

function loop(now) {
  if (!now) now = performance.now();
  let dt = now - lastTime;
  lastTime = now;
  if (dt > 100) dt = 100; // Cap max delta time to prevent spiral of death

  if (state === 'playing' && !isPaused) {
    accumulator += dt;
    while (accumulator >= STEP) {
      update();
      accumulator -= STEP;
    }
  }

  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Mouse & Touch Input Handlers
window.addEventListener('mousemove', (e) => {
  if (state === 'playing' && !isPaused && performance.now() - justResumedTime < 250) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  targetX = (e.clientX - rect.left) * scaleX;
  useKeyboard = false;
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (state !== 'playing') {
    startGame();
    return;
  }
  if (isPaused) {
    resumeGame();
    return;
  }
  if (performance.now() - justResumedTime < 250) {
    return;
  }

  const t = e.changedTouches[0];
  activeTouchId = t.identifier;
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchStartTargetX = jelly.x;
  touchActive = true;
  touchMoved = false;
  useKeyboard = false;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (state !== 'playing' || isPaused || !touchActive) return;

  let t = null;
  for (let i = 0; i < e.touches.length; i++) {
    if (e.touches[i].identifier === activeTouchId) {
      t = e.touches[i];
      break;
    }
  }
  if (!t) t = e.touches[0];
  if (!t) return;

  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  if (Math.hypot(dx, dy) > 8) {
    touchMoved = true;
  }

  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  targetX = Math.max(6, Math.min(W - 6, touchStartTargetX + dx * scaleX));
  useKeyboard = false;
}, { passive: false });

function handleTouchEnd(e) {
  for (let i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === activeTouchId) {
      if (!touchMoved && state === 'playing' && !isPaused && (performance.now() - justResumedTime >= 250)) {
        triggerEatMode();
      }
      touchActive = false;
      activeTouchId = null;
      break;
    }
  }
}
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

canvas.addEventListener('mouseleave', () => {
  if (state === 'playing') {
    pauseGame();
  }
});

canvas.addEventListener('mouseenter', () => {
  if (state === 'playing' && isPaused) {
    resumeGame();
  }
});

canvas.addEventListener('click', () => {
  if (state !== 'playing') {
    startGame();
  } else if (isPaused) {
    resumeGame();
  } else {
    if (performance.now() - justResumedTime < 250) return;
    triggerEatMode();
  }
});

// Keyboard Listeners
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    togglePause();
    e.preventDefault();
    return;
  }
  if (e.code === 'ArrowLeft') { leftPressed = true; useKeyboard = true; e.preventDefault(); }
  if (e.code === 'ArrowRight') { rightPressed = true; useKeyboard = true; e.preventDefault(); }
  if (e.code === 'Space') {
    if (state !== 'playing') startGame();
    else if (isPaused) resumeGame();
    else triggerEatMode();
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft') leftPressed = false;
  if (e.code === 'ArrowRight') rightPressed = false;
});

// Button Click Event Bindings
startBtn.addEventListener('click', (e) => { e.stopPropagation(); startGame(); });
resumeBtn.addEventListener('click', (e) => { e.stopPropagation(); resumeGame(); });
resumeBtn.addEventListener('touchstart', (e) => { e.stopPropagation(); resumeGame(); }, { passive: false });
if (pauseBtn) {
  pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
  pauseBtn.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: false });
}
