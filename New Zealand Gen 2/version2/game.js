// =========================================================================
// AOTEAROA: GENERATIONS — MODULAR GAME ENTRYPOINT & LOADER
// =========================================================================
// The game codebase has been refactored into domain-specific modules in version2/js/:
//
// 1. js/pixi-shim.js : Offline PixiJS 2D Canvas fallback shim
// 2. js/sound.js     : Procedural Web Audio API sound synthesizer (SoundFX)
// 3. js/data.js      : Game constants, isometric peninsula map generator, catalogs
// 4. js/state.js     : State management (GameState: defaultState, save/load, offline calc)
// 5. js/engine.js    : Game simulation rules & tick (GameEngine: timers, tasks, jobs, economy)
// 6. js/renderer.js  : Isometric PixiJS scene renderer (GameRenderer: terrain, buildings, FX)
// 7. js/ui.js        : DOM UI controller & tabs (GameUI: HUD, tasks, build, villagers, chronicle)
// 8. js/main.js      : Core orchestration & bootstrap (Game)
// =========================================================================

(function() {
  if (typeof window === 'undefined') return;
  if (window.Game && window.Game._initialized) return;

  const scripts = [
    'js/pixi-shim.js',
    'js/sound.js',
    'js/data.js',
    'js/state.js',
    'js/engine.js',
    'js/renderer.js',
    'js/ui.js',
    'js/main.js'
  ];

  if (typeof window.GameState === 'undefined') {
    scripts.forEach(src => {
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      document.head.appendChild(s);
    });
  }
})();
