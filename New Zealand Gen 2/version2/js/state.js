// =========================================================================
// GAME STATE MANAGEMENT (Save/Load, Default State, Offline Progression)
// =========================================================================

const GameState = {
      defaultState() {
        return {
          lastSavedAt: Date.now(),
          chapter: 1, // 1 = Māori Era, 2 = Colonial Trade Era, 3 = Chapter 2b Township/Modern
          population: 6,
          populationCap: 14,
          growthMeter: 0,
          whenuaProgress: 0,
          resources: {
            kai: 35,
            rakau: 30,
            whenua: 36,
            coin: 0,
            tradeGoods: 0,
            industry: 0
          },
          caps: {
            kai: 200,
            rakau: 180,
            coin: 500,
            tradeGoods: 250,
            industry: 300
          },
          jobs: {
            gardener: 2,
            fisher: 1,
            forester: 1,
            explorer: 0,
            merchant: 0,
            pastoralist: 0,
            artisan: 0
          },
          buildings: [
            { id: 'b_init_1', type: 'whare', row: 15, col: 8, status: 'complete', elapsed: 10, duration: 10 },
            { id: 'b_init_2', type: 'whare', row: 14, col: 8, status: 'complete', elapsed: 10, duration: 10 },
            { id: 'b_init_3', type: 'mara_kumara', row: 15, col: 9, status: 'complete', elapsed: 10, duration: 10 },
            { id: 'b_init_4', type: 'waka_ama', row: 16, col: 7, status: 'complete', elapsed: 10, duration: 10 }
          ],
          activeTasks: {
            kumara: { status: 'growing', elapsed: 4, duration: 8 },
            fishing: { status: 'idle', elapsed: 0, duration: 6 },
            timber: { status: 'idle', elapsed: 0, duration: 7 },
            voyage: { status: 'idle', elapsed: 0, duration: 22 }
          },
          milestonesReached: [],
          turningPointTriggered: false,
          turningPointProgress: 0, // 0 to 100 as ship approaches horizon
          turningPointComplete: false,
          chronicle: [
            { time: 'Year 1', text: 'Our waka hourua crossed Te Moana-nui-a-Kiwa and landed in this sheltered bay. The founding kāinga begins.' }
          ]
        };
      },

      loadState() {
        this.state = this.defaultState();
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.resources) {
              Object.assign(this.state, parsed);
              this.state.resources = Object.assign(this.defaultState().resources, parsed.resources);
              this.state.caps = Object.assign(this.defaultState().caps, parsed.caps || {});
              this.state.jobs = Object.assign(this.defaultState().jobs, parsed.jobs || {});
              this.state.activeTasks = Object.assign(this.defaultState().activeTasks, parsed.activeTasks || {});
            }
          } else {
            // Seed initial starter Whare and Māra Kūmara on the beach kāinga so the scene immediately feels alive
            this.state.buildings = [
              { id: 'b_init_1', type: 'whare', row: 15, col: 8, status: 'complete', elapsed: 10, duration: 10 },
              { id: 'b_init_2', type: 'mara_kumara', row: 15, col: 9, status: 'complete', elapsed: 10, duration: 10 }
            ];
          }
        } catch (e) {
          console.warn('Storage read fallback:', e);
        }

        // Check offline elapsed time
        const now = Date.now();
        const elapsedSec = Math.floor((now - (this.state.lastSavedAt || now)) / 1000);
        if (elapsedSec > 45) {
          const cappedSec = Math.min(elapsedSec, 24 * 3600);
          this.applyOfflineSimulation(cappedSec, true);
        }
      },

      saveState(manual = false) {
        this.state.lastSavedAt = Date.now();
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
          const el = document.getElementById('autosave-status');
          if (el) {
            el.textContent = manual ? '✓ Game saved just now' : 'Autosaved to browser storage';
          }
        } catch (e) {}
      },

      confirmReset() {
        if (confirm('Start a new playthrough of Aotearoa: Generations from the founding Waka landing?')) {
          localStorage.removeItem(STORAGE_KEY);
          this.grid = generatePeninsulaMap();
        this.totalLandTiles = 0;
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (this.grid[r][c].isLand) this.totalLandTiles++;
          }
        }
          this.state = this.defaultState();
          this.state.buildings = [
            { id: 'b_init_1', type: 'whare', row: 15, col: 8, status: 'complete', elapsed: 10, duration: 10 },
            { id: 'b_init_2', type: 'mara_kumara', row: 15, col: 9, status: 'complete', elapsed: 10, duration: 10 }
          ];
          this.syncGridWithState();
          this.rebuildTerrainAndObjects();
          this.renderUI(true);
          this.saveState(true);
        }
      },

};

window.GameState = GameState;
