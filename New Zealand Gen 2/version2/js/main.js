// =========================================================================
// AOTEAROA: GENERATIONS — MAIN GAME ENTRYPOINT & ORCHESTRATION
// =========================================================================

const Game = window.Game = {
  grid: [],
  state: null,
  speedMultiplier: 1,
  activeTab: 'actions',
  skyMode: 0, // 0 = Crisp Aotea Day, 1 = Golden Tōnga (Sunset), 2 = Matariki Starlight
  hoveredTile: null,
  selectedTile: null,

  // PixiJS references
  app: null,
  worldContainer: null,
  waterLayer: null,
  terrainLayer: null,
  objectLayer: null,
  fxLayer: null,
  skyOverlay: null,

  // Camera state
  camX: 0,
  camY: 0,
  camZoom: 1.0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,

  // Animated entities
  particles: [],
  villagerSprites: [],
  waveTime: 0,
  uiRefreshAccum: 0,
  autosaveAccum: 0,

  init() {
    if (this._initialized) return;
    this._initialized = true;
    this.grid = generatePeninsulaMap();
    this.totalLandTiles = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c].isLand) this.totalLandTiles++;
      }
    }
    this.loadState();
    this.initPixiScene();
    this.syncGridWithState();
    this.rebuildTerrainAndObjects();
    this.checkMilestones();
    this.renderUI(true);

    // Bind window resize
    window.addEventListener('resize', () => this.onResize());
  }
};

// Compose Game subsystems
Object.assign(Game, GameState);
Object.assign(Game, GameEngine);
Object.assign(Game, GameRenderer);
Object.assign(Game, GameUI);

// Launch game on DOM ready
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => Game.init());
} else {
  Game.init();
}
