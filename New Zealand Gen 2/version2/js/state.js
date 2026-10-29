// =========================================================================
// GAME STATE MANAGEMENT (Save/Load, Default State, Offline Progression)
// =========================================================================

const GameState = {
      defaultState() {
        return {
          lastSavedAt: Date.now(),
          chapter: 1, // 1 = Māori Era, 2 = Colonial Trade Era, 3 = Chapter 2b Township/Modern
          population: 6,
          populationCap: 10,
          growthMeter: 0,
          whenuaProgress: 0,
          surveysCompleted: 0,
          villagerTraining: {
            status: 'idle', // 'idle' | 'training'
            elapsed: 0,
            duration: 25
          },
          resources: {
            kai: 30,
            rakau: 20,
            whenua: 28,
            coin: 0,
            tradeGoods: 0,
            industry: 0
          },
          caps: {
            kai: 150,
            rakau: 120,
            coin: 400,
            tradeGoods: 200,
            industry: 200
          },
          jobs: {
            gardener: 0,
            hunter: 0,
            forester: 0,
            explorer: 0,
            merchant: 0,
            pastoralist: 0,
            artisan: 0
          },
          buildings: [
            { id: 'b_init_1', type: 'whare', row: 15, col: 8, status: 'complete', elapsed: 45, duration: 45 },
            { id: 'b_init_2', type: 'mara_kumara', row: 15, col: 9, status: 'complete', elapsed: 60, duration: 60 }
          ],
          activeTasks: {
            kumara: { status: 'growing', elapsed: 10, duration: 150, playedMiniGame: false, bonusMult: 1.0 },
            fishing: { status: 'idle', elapsed: 0, duration: 150, playedMiniGame: false, bonusMult: 1.0 },
            timber: { status: 'idle', elapsed: 0, duration: 180, playedMiniGame: false, bonusMult: 1.0 },
            voyage: { status: 'idle', elapsed: 0, duration: 480, playedMiniGame: false, bonusMult: 1.0 }
          },
          milestonesReached: [],
          turningPointTriggered: false,
          turningPointProgress: 0, // 0 to 100 as ship approaches horizon
          turningPointComplete: false,
          chronicle: [
            { time: 'Year 1', text: 'Our waka hourua crossed Te Moana-nui-a-Kiwa and landed in this sheltered bay. Train new Tangata with Kai and assign Villagers, Hunters, Lumberjacks, and Explorers.' }
          ]
        };
      },

      loadState() {
        const def = this.defaultState();
        this.state = def;
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.resources) {
              Object.assign(this.state, parsed);
              this.state.resources = Object.assign({}, def.resources, parsed.resources);
              this.state.caps = Object.assign({}, def.caps, parsed.caps || {});
              const loadedJobs = Object.assign({}, def.jobs, parsed.jobs || {});
              if (loadedJobs.fisher) {
                loadedJobs.hunter = (loadedJobs.hunter || 0) + loadedJobs.fisher;
                delete loadedJobs.fisher;
              }
              this.state.jobs = loadedJobs;
              this.state.villagerTraining = Object.assign({}, def.villagerTraining, parsed.villagerTraining || {});

              // Merge activeTasks while ensuring new longer durations and mini-game fields exist
              const mergedTasks = {};
              for (const [k, defTask] of Object.entries(def.activeTasks)) {
                const pt = (parsed.activeTasks && parsed.activeTasks[k]) ? parsed.activeTasks[k] : {};
                mergedTasks[k] = {
                  status: pt.status || defTask.status,
                  elapsed: pt.elapsed || 0,
                  duration: Math.max(defTask.duration, pt.duration || defTask.duration),
                  playedMiniGame: Boolean(pt.playedMiniGame),
                  bonusMult: pt.bonusMult || 1.0
                };
              }
              this.state.activeTasks = mergedTasks;
            }
          }
        } catch (e) {
          console.warn('Storage read fallback:', e);
        }

        // Check offline elapsed time
        const now = Date.now();
        const elapsedSec = Math.floor((now - (this.state.lastSavedAt || now)) / 1000);
        if (elapsedSec > 60) {
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
          this.syncGridWithState();
          this.rebuildTerrainAndObjects();
          this.renderUI(true);
          this.saveState(true);
        }
      },

};

window.GameState = GameState;
