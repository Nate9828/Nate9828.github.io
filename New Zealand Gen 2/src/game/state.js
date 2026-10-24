export function initState() {
  // Try to load from localStorage, otherwise default
  const saved = localStorage.getItem('aotearoa-save');
  if (saved) {
    return JSON.parse(saved);
  }
  
  return {
    lastSavedAt: Date.now(),
    chapter: 1,
    population: 2,
    populationCap: 10,
    resources: {
      kai: 0,
      rakau: 0
    },
    workers: {
      idle: 2,
      gatherer: 0, // gathers rakau
      farmer: 0    // gathers kai
    },
    buildings: []
  };
}

export function startGameLoop(state, engine) {
  // Update loop runs 10 times a second for smoothness, 
  // but resource generation is per second
  const TICK_RATE = 100; 
  
  setInterval(() => {
    const now = Date.now();
    const dt = (now - state.lastSavedAt) / 1000; // seconds since last tick
    
    // Generate resources based on workers
    // Farmers generate 1 kai per second
    state.resources.kai += state.workers.farmer * 1 * dt;
    // Gatherers generate 0.5 rakau per second
    state.resources.rakau += state.workers.gatherer * 0.5 * dt;
    
    state.lastSavedAt = now;
    
    // Save to local storage
    localStorage.setItem('aotearoa-save', JSON.stringify(state));
    
    // Dispatch event to update UI
    window.dispatchEvent(new CustomEvent('gameStateUpdated', { detail: state }));
    
  }, TICK_RATE);
}
