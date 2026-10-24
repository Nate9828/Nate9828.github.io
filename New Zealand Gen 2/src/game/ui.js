export function initUI(state, engine) {
  const els = {
    pop: document.getElementById('res-population'),
    kai: document.getElementById('res-kai'),
    rakau: document.getElementById('res-rakau'),
    wIdle: document.getElementById('workers-idle'),
    wGatherer: document.getElementById('workers-gatherer'),
    wFarmer: document.getElementById('workers-farmer'),
    btnBuildWhare: document.getElementById('btn-build-whare')
  };

  // Listen for state updates
  window.addEventListener('gameStateUpdated', (e) => {
    const s = e.detail;
    els.pop.innerText = `${s.population}/${s.populationCap}`;
    els.kai.innerText = Math.floor(s.resources.kai);
    els.rakau.innerText = Math.floor(s.resources.rakau);
    els.wIdle.innerText = s.workers.idle;
    els.wGatherer.innerText = s.workers.gatherer;
    els.wFarmer.innerText = s.workers.farmer;
    
    // Check building affordability
    if (s.resources.rakau >= 10) {
      els.btnBuildWhare.disabled = false;
    } else {
      els.btnBuildWhare.disabled = true;
    }
  });

  // Worker controls
  function assignWorker(type) {
    if (state.workers.idle > 0) {
      state.workers.idle--;
      state.workers[type]++;
      
      // Save state immediately on interaction to ensure UI feels responsive
      localStorage.setItem('aotearoa-save', JSON.stringify(state));
      window.dispatchEvent(new CustomEvent('gameStateUpdated', { detail: state }));
    }
  }

  function unassignWorker(type) {
    if (state.workers[type] > 0) {
      state.workers[type]--;
      state.workers.idle++;
      
      localStorage.setItem('aotearoa-save', JSON.stringify(state));
      window.dispatchEvent(new CustomEvent('gameStateUpdated', { detail: state }));
    }
  }

  document.getElementById('btn-assign-gatherer').addEventListener('click', () => assignWorker('gatherer'));
  document.getElementById('btn-unassign-gatherer').addEventListener('click', () => unassignWorker('gatherer'));
  document.getElementById('btn-assign-farmer').addEventListener('click', () => assignWorker('farmer'));
  document.getElementById('btn-unassign-farmer').addEventListener('click', () => unassignWorker('farmer'));

  // Building
  els.btnBuildWhare.addEventListener('click', () => {
    if (state.resources.rakau >= 10) {
      state.resources.rakau -= 10;
      state.populationCap += 5; // Whare adds 5 housing
      state.buildings.push({ type: 'whare', id: Date.now() });
      engine.addBuilding('whare');
      
      localStorage.setItem('aotearoa-save', JSON.stringify(state));
      window.dispatchEvent(new CustomEvent('gameStateUpdated', { detail: state }));
    }
  });
}
