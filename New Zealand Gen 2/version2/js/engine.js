// =========================================================================
// GAME ENGINE & SIMULATION (Rules, Tick, Actions, Mini-Games, AoE Roles)
// =========================================================================

const GameEngine = {
      miniGameState: null,

      syncGridWithState() {
        // Reset grid occupancy
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const tile = this.grid[r][c];
            tile.buildingId = null;
            tile.buildingType = null;
            tile.type = tile.baseType;
          }
        }

        // Reveal tiles up to state.resources.whenua count
        const landTiles = [];
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (this.grid[r][c].isLand) landTiles.push(this.grid[r][c]);
          }
        }
        landTiles.sort((a, b) => a.revealDist - b.revealDist);
        const revealCount = Math.min(landTiles.length, Math.max(24, Math.floor(this.state.resources.whenua)));
        this.state.resources.whenua = revealCount;
        for (let i = 0; i < landTiles.length; i++) {
          landTiles[i].revealed = (i < revealCount);
        }

        // Place buildings on grid & apply tile terrain evolution (road, farmland, town_floor)
        for (const b of this.state.buildings) {
          if (this.grid[b.row] && this.grid[b.row][b.col]) {
            const t = this.grid[b.row][b.col];
            t.revealed = true;
            t.buildingId = b.id;
            t.buildingType = b.type;
            if (b.type === 'town_road') {
              t.type = 'road';
            } else if (b.type === 'pastoral_farm') {
              t.type = 'farmland';
            } else if (['trading_post', 'settler_cottage', 'town_hall', 'high_street_shops', 'modern_skyline'].includes(b.type)) {
              t.type = 'town_floor';
            }
          }
        }

        this.recalculateCaps();
      },

      revealTiles(count) {
        const landTiles = [];
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (this.grid[r][c].isLand && !this.grid[r][c].revealed) {
              landTiles.push(this.grid[r][c]);
            }
          }
        }
        landTiles.sort((a, b) => a.revealDist - b.revealDist);
        const toReveal = landTiles.slice(0, count);
        toReveal.forEach((t, idx) => {
          t.revealed = true;
          if (idx < 8) {
            const pos = this.isoToScreen(t.col, t.row, t.elevation);
            this.spawnSparkles(pos.x, pos.y, 0x63d2ae, 4);
          }
        });
        // Count total revealed land tiles
        let totalRevealed = 0;
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (this.grid[r][c].isLand && this.grid[r][c].revealed) totalRevealed++;
          }
        }
        this.state.resources.whenua = totalRevealed;
        this.rebuildTerrainAndObjects();
      },

      countBuilding(type, onlyComplete = true) {
        return this.state.buildings.filter(b => b.type === type && (!onlyComplete || b.status === 'complete')).length;
      },

      hasActiveConstruction(type = null) {
        if (type) {
          return this.state.buildings.some(b => b.type === type && b.status === 'building');
        }
        return this.state.buildings.some(b => b.status === 'building');
      },

      getBusyBuilderVillagers() {
        let busy = 0;
        for (const b of this.state.buildings) {
          if (b.status === 'building') {
            const def = BUILDING_DEFS[b.type];
            busy += (def && def.reqVillagers) ? def.reqVillagers : 2;
          }
        }
        return busy;
      },

      getAvailableBuilderVillagers() {
        const totalVillagers = this.state.jobs.gardener || 0;
        return Math.max(0, totalVillagers - this.getBusyBuilderVillagers());
      },

      getJobCap(jobId) {
        const jobDef = JOB_DEFS.find(j => j.id === jobId);
        let slots = jobDef ? (jobDef.baseSlots || 0) : 0;
        for (const b of this.state.buildings) {
          if (b.status !== 'complete') continue;
          const def = BUILDING_DEFS[b.type];
          if (def && def.effects && def.effects.jobSlots && def.effects.jobSlots[jobId]) {
            slots += def.effects.jobSlots[jobId];
          }
        }
        return slots;
      },

      getBuildSpeedMultiplier() {
        let bonus = 0;
        for (const j of JOB_DEFS) {
          if (j.buildSpeedBonus) {
            bonus += (this.state.jobs[j.id] || 0) * j.buildSpeedBonus;
          }
        }
        return 1 + bonus;
      },

      getExplorerDiscount() {
        const explorers = this.state.jobs.explorer || 0;
        return Math.min(0.40, explorers * 0.08);
      },

      recalculateCaps() {
        let popCap = 6;
        let kaiCap = 150;
        let rakauCap = 120;
        let coinCap = 400;
        let tradeCap = 200;
        let industryCap = 200;
        let growth = 0;

        for (const b of this.state.buildings) {
          if (b.status !== 'complete') continue;
          const def = BUILDING_DEFS[b.type];
          if (!def) continue;
          if (def.effects.popCap) popCap += def.effects.popCap;
          if (def.effects.kaiCap) kaiCap += def.effects.kaiCap;
          if (def.effects.rakauCap) rakauCap += def.effects.rakauCap;
          if (def.effects.coinCap) coinCap += def.effects.coinCap;
          if (def.effects.tradeCap) tradeCap += def.effects.tradeCap;
          if (def.effects.industryCap) industryCap += def.effects.industryCap;
          if (def.effects.growthPoints) growth += def.effects.growthPoints;
        }

        this.state.populationCap = popCap;
        this.state.caps.kai = kaiCap;
        this.state.caps.rakau = rakauCap;
        this.state.caps.coin = coinCap;
        this.state.caps.tradeGoods = tradeCap;
        this.state.caps.industry = industryCap;
        this.state.growthMeter = growth + Math.floor(this.state.population * 1.2);

        // Ensure assigned jobs do not exceed available building job slots
        for (const j of JOB_DEFS) {
          const cap = this.getJobCap(j.id);
          if ((this.state.jobs[j.id] || 0) > cap) {
            this.state.jobs[j.id] = cap;
          }
        }
      },

      getRates() {
        const rates = { kai: 0, rakau: 0, whenuaProgress: 0, coin: 0, tradeGoods: 0, industry: 0 };

        // Building passive generation (Chapter 2+ infrastructure)
        for (const b of this.state.buildings) {
          if (b.status !== 'complete') continue;
          const def = BUILDING_DEFS[b.type];
          if (!def) continue;
          if (def.effects.kaiPerSec) rates.kai += def.effects.kaiPerSec;
          if (def.effects.rakauPerSec) rates.rakau += def.effects.rakauPerSec;
          if (def.effects.coinPerSec) rates.coin += def.effects.coinPerSec;
          if (def.effects.tradeGoodsPerSec) rates.tradeGoods += def.effects.tradeGoodsPerSec;
          if (def.effects.industryPerSec) rates.industry += def.effects.industryPerSec;
        }

        // Assigned villager jobs
        let totalAssigned = 0;
        for (const j of JOB_DEFS) {
          const count = this.state.jobs[j.id] || 0;
          if (count > 0) {
            totalAssigned += count;
            for (const [resKey, val] of Object.entries(j.rates)) {
              rates[resKey] = (rates[resKey] || 0) + val * count;
            }
          }
        }

        // Founding 6 villagers are self-sustaining when unassigned;
        // Population above 6 and actively working villagers consume Kai
        const extraPop = Math.max(0, Math.floor(this.state.population) - 6);
        const foodUpkeep = extraPop * 0.025 + totalAssigned * 0.015;
        rates.kai = rates.kai - foodUpkeep;

        return rates;
      },

      // =======================================================================
      // AGE OF EMPIRES-STYLE VILLAGER TRAINING (PURCHASED WITH KAI)
      // =======================================================================
      getTrainVillagerCost() {
        const extraPop = Math.max(0, Math.floor(this.state.population) - 6);
        return Math.round(25 * Math.pow(1.12, extraPop));
      },

      startTrainVillager() {
        const s = this.state;
        if (!s.villagerTraining) {
          s.villagerTraining = { status: 'idle', elapsed: 0, duration: 25 };
        }
        if (s.villagerTraining.status === 'training') return;
        if (Math.floor(s.population) >= s.populationCap) return;

        const cost = this.getTrainVillagerCost();
        if (s.resources.kai < cost) return;

        s.resources.kai -= cost;
        s.villagerTraining.status = 'training';
        s.villagerTraining.elapsed = 0;
        s.villagerTraining.duration = 25;

        SoundFX.playBuild();
        this.renderUI(true);
        this.saveState();
      },

      getBuildingCost(type) {
        const def = BUILDING_DEFS[type];
        const existingCount = this.countBuilding(type, false);
        const mult = Math.pow(def.costScale, existingCount);
        const cost = {};
        for (const [k, v] of Object.entries(def.baseCost)) {
          cost[k] = Math.round(v * mult);
        }
        return cost;
      },

      getSurveyCost() {
        const surveys = this.state.surveysCompleted || 0;
        const mult = Math.pow(1.38, surveys);
        const discount = 1 - this.getExplorerDiscount();
        return {
          kai: Math.max(10, Math.round(35 * mult * discount)),
          rakau: Math.max(8, Math.round(25 * mult * discount))
        };
      },

      canAfford(costObj) {
        for (const [k, v] of Object.entries(costObj)) {
          if ((this.state.resources[k] || 0) < v) return false;
        }
        return true;
      },

      findTileForBuilding(type) {
        const def = BUILDING_DEFS[type];
        // Gather all revealed unoccupied tiles
        const candidates = [];
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const t = this.grid[r][c];
            if (t.buildingId) continue;

            if (type === 'waka_ama' || type === 'wharf_port') {
              // Coastal sand or shallow water adjacent to revealed land
              if (t.baseType === 'sand' || t.baseType === 'shallow_water') {
                const adjLand = this.hasAdjacentRevealedLand(r, c);
                if (adjLand) candidates.push(t);
              }
            } else if (type === 'pa_headland') {
              if (t.revealed && t.baseType === 'hill' && c <= 11) {
                candidates.push(t);
              }
            } else if (type === 'modern_skyline') {
              if (t.revealed && (t.baseType === 'hill' || t.type === 'town_floor') && c >= 11) {
                candidates.push(t);
              }
            } else if (t.revealed && t.isLand) {
              candidates.push(t);
            }
          }
        }

        if (candidates.length === 0) return null;

        // Sort candidates by proximity to their era's natural focal point
        candidates.sort((a, b) => {
          const prefA = def.preferredTiles.includes(a.baseType) ? -3 : 0;
          const prefB = def.preferredTiles.includes(b.baseType) ? -3 : 0;

          let targetCol = 8, targetRow = 15;
          if (type === 'pa_headland') { targetCol = 6; targetRow = 10; }
          else if (type === 'wharf_port') { targetCol = 11; targetRow = 17; }
          else if (def.era === 2) { targetCol = 13; targetRow = 14; }
          else if (def.era === 3) { targetCol = 15; targetRow = 9; }

          const dA = Math.hypot(a.col - targetCol, a.row - targetRow) + prefA;
          const dB = Math.hypot(b.col - targetCol, b.row - targetRow) + prefB;
          return dA - dB;
        });

        return candidates[0];
      },

      hasAdjacentRevealedLand(r, c) {
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        for (const [dr, dc] of dirs) {
          const nr = r + dr, nc = c + dc;
          if (this.grid[nr] && this.grid[nr][nc] && this.grid[nr][nc].isLand && this.grid[nr][nc].revealed) {
            return true;
          }
        }
        return false;
      },

      startBuilding(type) {
        const def = BUILDING_DEFS[type];
        if (!def) return;
        // Allow multiple different buildings at once, up to 1 active construction per building type card
        if (this.hasActiveConstruction(type)) return;

        const reqV = def.reqVillagers || 2;
        if (this.getAvailableBuilderVillagers() < reqV) {
          this.pushBanner('Assign More Villagers (Kaimahi)', `Constructing ${def.name} requires ${reqV} available Kaimahi (Villagers & Builders) in the Tangata tab.`);
          return;
        }

        const count = this.countBuilding(type, false);
        if (count >= def.maxCount) return;

        const cost = this.getBuildingCost(type);
        if (!this.canAfford(cost)) return;

        const tile = this.findTileForBuilding(type);
        if (!tile) {
          this.pushBanner('Expand Whenua First', 'Assign Explorers or send a Survey Party in the Tasks tab to reveal more buildable tiles.');
          return;
        }

        // Deduct cost
        for (const [k, v] of Object.entries(cost)) {
          this.state.resources[k] -= v;
        }

        const newB = {
          id: 'b_' + Date.now() + '_' + Math.floor(Math.random() * 999),
          type,
          row: tile.row,
          col: tile.col,
          status: 'building',
          elapsed: 0,
          duration: def.buildTime
        };
        this.state.buildings.push(newB);
        SoundFX.playBuild();

        if (def.effects.whenuaBonus) {
          this.revealTiles(def.effects.whenuaBonus);
        }

        this.syncGridWithState();
        this.rebuildTerrainAndObjects();
        this.renderUI(true);
        this.saveState();
      },

      // =======================================================================
      // ACTIVE TASKS & INTERACTIVE MINI-GAMES (20%–85% SKIP & 1.15x–2.50x YIELD)
      // =======================================================================
      getTaskBaseYield(taskKey) {
        if (taskKey === 'kumara') {
          const gardens = Math.max(1, this.countBuilding('mara_kumara'));
          return { kai: 6 + gardens * 4 };
        } else if (taskKey === 'fishing') {
          const spots = this.countBuilding('waka_ama');
          return { kai: 6 + spots * 4 };
        } else if (taskKey === 'timber') {
          const mills = this.countBuilding('timber_mill');
          return { rakau: 7 + mills * 5 };
        } else if (taskKey === 'voyage') {
          const wharves = Math.max(1, this.countBuilding('wharf_port'));
          return { coin: 30 * wharves, tradeGoods: 18 * wharves };
        }
        return {};
      },

      getTaskFinalYield(taskKey) {
        const base = this.getTaskBaseYield(taskKey);
        const t = this.state.activeTasks[taskKey];
        const mult = (t && t.bonusMult) ? t.bonusMult : 1.0;
        const out = {};
        for (const [k, v] of Object.entries(base)) {
          out[k] = Math.round(v * mult);
        }
        return out;
      },

      triggerTask(taskKey) {
        const t = this.state.activeTasks[taskKey];
        if (!t) return;

        const yieldMap = this.getTaskFinalYield(taskKey);

        if (taskKey === 'kumara') {
          if (t.status === 'ready') {
            this.state.resources.kai = Math.min(this.state.caps.kai, this.state.resources.kai + (yieldMap.kai || 0));
            t.status = 'growing';
            t.elapsed = 0;
            t.duration = 150;
            t.playedMiniGame = false;
            t.bonusMult = 1.0;
            SoundFX.playHarvest();
            const pos = this.isoToScreen(9, 15, 0.8);
            this.spawnSparkles(pos.x, pos.y - 12, 0xe8b948, 12);
          }
        } else if (taskKey === 'fishing') {
          if (t.status === 'idle') {
            t.status = 'running';
            t.elapsed = 0;
            t.duration = 150;
            t.playedMiniGame = false;
            t.bonusMult = 1.0;
          } else if (t.status === 'ready') {
            this.state.resources.kai = Math.min(this.state.caps.kai, this.state.resources.kai + (yieldMap.kai || 0));
            t.status = 'idle';
            t.elapsed = 0;
            t.duration = 150;
            t.playedMiniGame = false;
            t.bonusMult = 1.0;
            SoundFX.playHarvest();
            const pos = this.isoToScreen(7, 17, 0);
            this.spawnSparkles(pos.x, pos.y - 10, 0x52c7a1, 10);
          }
        } else if (taskKey === 'timber') {
          if (t.status === 'idle') {
            t.status = 'running';
            t.elapsed = 0;
            t.duration = 180;
            t.playedMiniGame = false;
            t.bonusMult = 1.0;
          } else if (t.status === 'ready') {
            this.state.resources.rakau = Math.min(this.state.caps.rakau, this.state.resources.rakau + (yieldMap.rakau || 0));
            t.status = 'idle';
            t.elapsed = 0;
            t.duration = 180;
            t.playedMiniGame = false;
            t.bonusMult = 1.0;
            SoundFX.playHarvest();
            const pos = this.isoToScreen(10, 14, 1.0);
            this.spawnSparkles(pos.x, pos.y - 14, 0xd4a359, 10);
          }
        } else if (taskKey === 'voyage') {
          if (t.status === 'idle') {
            t.status = 'running';
            t.elapsed = 0;
            t.duration = 480;
            t.playedMiniGame = false;
            t.bonusMult = 1.0;
          } else if (t.status === 'ready') {
            this.state.resources.coin = Math.min(this.state.caps.coin, this.state.resources.coin + (yieldMap.coin || 0));
            this.state.resources.tradeGoods = Math.min(this.state.caps.tradeGoods, this.state.resources.tradeGoods + (yieldMap.tradeGoods || 0));
            t.status = 'idle';
            t.elapsed = 0;
            t.duration = 480;
            t.playedMiniGame = false;
            t.bonusMult = 1.0;
            SoundFX.playMilestone();
            const pos = this.isoToScreen(11, 18, 0);
            this.spawnSparkles(pos.x, pos.y - 14, 0xe8b948, 16);
          }
        }

        this.renderUI(true);
        this.saveState();
      },

      // =======================================================================
      // INTERACTIVE MINI-GAME MODAL CONTROLLER (60FPS SMOOTH RAF LOOP)
      // =======================================================================
      randomizeZone(mg, minGold = 6, maxGold = 15) {
        mg.goldWidth = Number((minGold + Math.random() * (maxGold - minGold)).toFixed(1));
        mg.goodWidth = Number((mg.goldWidth * 2.15).toFixed(1));
        const margin = Math.ceil(mg.goodWidth / 2) + 6;
        mg.zoneCenter = Number((margin + Math.random() * (100 - margin * 2)).toFixed(1));
      },

      openTaskMiniGame(taskKey) {
        const t = this.state.activeTasks[taskKey];
        if (!t) return;
        if (t.status === 'idle') {
          t.status = 'running';
          t.elapsed = 0;
          t.playedMiniGame = false;
          t.bonusMult = 1.0;
        }
        if (t.status === 'ready' || t.playedMiniGame) return;

        this.closeTaskMiniGame(false);

        const backdrop = document.getElementById('minigame-modal-backdrop');
        if (!backdrop) return;
        backdrop.classList.add('open');

        const mg = {
          taskKey,
          score: 0,
          timeLeft: taskKey === 'timber' ? 12.0 : 8.0,
          finished: false,
          rafId: null,
          lastFrameTime: performance.now(),
          // Kūmara mounds state
          mounds: Array(9).fill('empty'),
          moundTTL: Array(9).fill(0),
          spawnAccum: 0,
          // Fishing & Axe zone state
          fishPos: 20,
          fishVel: 68,
          targetFishVel: 68,
          nextShiftTimer: 0.75,
          zoneCenter: 50,
          goldWidth: 11,
          goodWidth: 24,
          // Axe 5-swing state
          chopPos: 10,
          chopDir: 1,
          chopSpeed: 135,
          swingsLeft: 5,
          maxSwings: 5,
          perfectHits: 0,
          // Voyage wind state
          shipPos: 50,
          windCenter: 50,
          windVel: 34,
          targetWindVel: 34,
          windShiftTimer: 0.85,
          crosswind: 14
        };
        this.miniGameState = mg;

        if (taskKey === 'fishing') {
          this.randomizeZone(mg, 7, 15);
        } else if (taskKey === 'timber') {
          this.randomizeZone(mg, 6, 15);
        } else if (taskKey === 'voyage') {
          mg.goldWidth = Number((10 + Math.random() * 6).toFixed(1));
        }

        const titles = {
          kumara: '🍠 Māra Kūmara — Tend the Puke Mounds',
          fishing: '🛶 Waka Ama — Haul the Kahawai',
          timber: '🪓 Ngahere — 5-Swing Toki Challenge',
          voyage: '⛵ Tasman Voyage — Ride the Shifting Gales'
        };
        const instructions = {
          kumara: '8s Speed Harvest: Click ONLY golden Kūmara (+10 pts) before they vanish! Clicking Weeds (🌿) or bare soil costs −12 pts!',
          fishing: '8s Erratic Kahawai: The fish surges and reverses! Gold = +15 pts, Green = +6 pts, Miss = −15 pts! (Up to 85% time skip)',
          timber: '5 Swings Only: You have 5 swings of the Toki! Hit all 5 in the randomized Gold grain (+20 pts each) for 100/100 and 85% skip!',
          voyage: '8s Gale Navigation: Crosswinds push your ship! Stay inside the narrow shifting Gold wind (+18/s) or lose score (−9/s) when off-course!'
        };

        document.getElementById('mg-title').textContent = titles[taskKey] || 'Settlement Task Mini-Game';
        document.getElementById('mg-instructions').textContent = instructions[taskKey] || '';
        this.renderMiniGameArena();

        if (taskKey === 'kumara') {
          this.spawnKumaraMoundItems();
        }

        // Smooth 60–144fps requestAnimationFrame loop
        const stepLoop = (now) => {
          if (!this.miniGameState || this.miniGameState.finished) return;
          const dt = Math.min(0.05, Math.max(0.001, (now - mg.lastFrameTime) / 1000));
          mg.lastFrameTime = now;
          mg.timeLeft = Math.max(0, mg.timeLeft - dt);

          if (mg.taskKey === 'kumara') {
            let changed = false;
            for (let i = 0; i < 9; i++) {
              if (mg.mounds[i] !== 'empty') {
                mg.moundTTL[i] -= dt;
                if (mg.moundTTL[i] <= 0) {
                  mg.mounds[i] = mg.mounds[i] === 'kumara' && Math.random() < 0.65 ? 'weed' : 'empty';
                  mg.moundTTL[i] = mg.mounds[i] === 'weed' ? 1.1 : 0;
                  changed = true;
                }
              }
            }
            mg.spawnAccum += dt;
            if (mg.spawnAccum >= 0.14) {
              mg.spawnAccum = 0;
              if (Math.random() < 0.85) {
                this.spawnKumaraMoundItems();
                changed = false;
              }
            }
            if (changed) {
              this.renderMiniGameArena();
            }
          } else if (mg.taskKey === 'fishing') {
            mg.nextShiftTimer -= dt;
            if (mg.nextShiftTimer <= 0) {
              // Cooldown of 0.6s–1.35s between random speed bursts & direction reversals so it glides smoothly
              mg.nextShiftTimer = 0.6 + Math.random() * 0.75;
              const flip = Math.random() < 0.42 ? -1 : 1;
              const currentSign = Math.sign(mg.targetFishVel || 1) * flip;
              const isFastBurst = Math.random() < 0.55;
              const spd = isFastBurst ? (120 + Math.random() * 52) : (52 + Math.random() * 30);
              mg.targetFishVel = currentSign * spd;
            }
            // Smooth acceleration toward target velocity (eliminates frame-to-frame twitching)
            mg.fishVel += (mg.targetFishVel - mg.fishVel) * Math.min(1, dt * 11);
            mg.fishPos += mg.fishVel * dt;

            if (mg.fishPos >= 95) {
              mg.fishPos = 95;
              const spd = 65 + Math.random() * 95;
              mg.fishVel = -spd;
              mg.targetFishVel = -spd;
              mg.nextShiftTimer = 0.55 + Math.random() * 0.6;
            } else if (mg.fishPos <= 5) {
              mg.fishPos = 5;
              const spd = 65 + Math.random() * 95;
              mg.fishVel = spd;
              mg.targetFishVel = spd;
              mg.nextShiftTimer = 0.55 + Math.random() * 0.6;
            }
          } else if (mg.taskKey === 'timber') {
            mg.chopPos += mg.chopDir * mg.chopSpeed * dt;
            if (mg.chopPos >= 96) { mg.chopPos = 96; mg.chopDir = -1; }
            if (mg.chopPos <= 4) { mg.chopPos = 4; mg.chopDir = 1; }
          } else if (mg.taskKey === 'voyage') {
            mg.windShiftTimer -= dt;
            if (mg.windShiftTimer <= 0) {
              mg.windShiftTimer = 0.65 + Math.random() * 0.75;
              mg.targetWindVel = (Math.random() < 0.5 ? -1 : 1) * (28 + Math.random() * 36);
              mg.goldWidth = Number((9.5 + Math.random() * 6.5).toFixed(1));
              mg.crosswind = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 14);
            }
            mg.windVel += (mg.targetWindVel - mg.windVel) * Math.min(1, dt * 9);
            mg.windCenter += mg.windVel * dt;
            if (mg.windCenter >= 86) {
              mg.windCenter = 86;
              mg.windVel = -Math.abs(mg.windVel);
              mg.targetWindVel = mg.windVel;
            } else if (mg.windCenter <= 14) {
              mg.windCenter = 14;
              mg.windVel = Math.abs(mg.windVel);
              mg.targetWindVel = mg.windVel;
            }
            // Crosswind pushes ship smoothly
            mg.shipPos = Math.max(6, Math.min(94, mg.shipPos + mg.crosswind * dt));
            const halfGold = mg.goldWidth / 2;
            const dist = Math.abs(mg.shipPos - mg.windCenter);
            if (dist <= halfGold) {
              mg.score = Math.min(100, mg.score + 18.0 * dt);
            } else if (dist <= halfGold + 7) {
              mg.score = Math.min(100, mg.score + 4.0 * dt);
            } else {
              mg.score = Math.max(0, mg.score - 9.5 * dt);
            }
          }

          this.updateMiniGameHUD();

          if (mg.score >= 100 || mg.timeLeft <= 0) {
            this.completeTaskMiniGame(Math.round(Math.min(100, mg.score)));
            return;
          }
          mg.rafId = requestAnimationFrame(stepLoop);
        };

        mg.rafId = requestAnimationFrame(stepLoop);
      },

      spawnKumaraMoundItems() {
        const mg = this.miniGameState;
        if (!mg) return;
        const emptyIndices = [];
        mg.mounds.forEach((v, i) => { if (v === 'empty') emptyIndices.push(i); });
        if (emptyIndices.length > 0) {
          const pick = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
          const isKumara = Math.random() < 0.52;
          mg.mounds[pick] = isKumara ? 'kumara' : 'weed';
          mg.moundTTL[pick] = isKumara ? (0.85 + Math.random() * 0.45) : (1.1 + Math.random() * 0.6);
        }
        this.renderMiniGameArena();
      },

      handleMiniGameAction(action, index = 0) {
        const mg = this.miniGameState;
        if (!mg || mg.finished) return;

        if (mg.taskKey === 'kumara' && action === 'mound') {
          const cur = mg.mounds[index];
          if (cur === 'kumara') {
            mg.score = Math.min(100, mg.score + 10);
            mg.mounds[index] = 'empty';
            mg.moundTTL[index] = 0;
            SoundFX.playHarvest();
          } else {
            mg.score = Math.max(0, mg.score - 12);
            mg.mounds[index] = 'empty';
            mg.moundTTL[index] = 0;
          }
          this.renderMiniGameArena();
        } else if (mg.taskKey === 'fishing' && action === 'strike') {
          const dist = Math.abs(mg.fishPos - mg.zoneCenter);
          const halfGold = mg.goldWidth / 2;
          const halfGood = mg.goodWidth / 2;
          const feedbackEl = document.getElementById('mg-feedback');

          if (dist <= halfGold) {
            mg.score = Math.min(100, mg.score + 15);
            SoundFX.playHarvest();
            if (feedbackEl) feedbackEl.textContent = '✨ Golden Strike! (+15 pts)';
          } else if (dist <= halfGood) {
            mg.score = Math.min(100, mg.score + 6);
            SoundFX.playBuild();
            if (feedbackEl) feedbackEl.textContent = '🐟 Partial Catch (+6 pts)';
          } else {
            mg.score = Math.max(0, mg.score - 15);
            if (feedbackEl) feedbackEl.textContent = '🌊 Missed Strike! (−15 pts)';
          }
          // Randomize gold zone width and position in-place without destroying the DOM marker!
          this.randomizeZone(mg, 7, 15);
          mg.targetFishVel = (Math.random() < 0.5 ? -1 : 1) * (65 + Math.random() * 100);
          mg.nextShiftTimer = 0.65 + Math.random() * 0.65;
          this.updateMiniGameHUD();
        } else if (mg.taskKey === 'timber' && action === 'chop') {
          if (mg.swingsLeft <= 0) return;
          const dist = Math.abs(mg.chopPos - mg.zoneCenter);
          const halfGold = mg.goldWidth / 2;
          const halfGood = mg.goodWidth / 2;
          mg.swingsLeft -= 1;

          let feedbackMsg = '';
          if (dist <= halfGold) {
            mg.score = Math.min(100, mg.score + 20);
            mg.perfectHits += 1;
            SoundFX.playHarvest();
            feedbackMsg = `🪓 PERFECT GRAIN HIT! (+20 pts) — ${mg.swingsLeft} swing${mg.swingsLeft === 1 ? '' : 's'} left`;
          } else if (dist <= halfGood) {
            mg.score = Math.min(100, mg.score + 8);
            SoundFX.playBuild();
            feedbackMsg = `🪵 Glancing Green Hit (+8 pts) — ${mg.swingsLeft} swing${mg.swingsLeft === 1 ? '' : 's'} left`;
          } else {
            feedbackMsg = `⚠️ Missed the grain! (0 pts) — ${mg.swingsLeft} swing${mg.swingsLeft === 1 ? '' : 's'} left`;
          }

          // Randomize gold zone width, position, and axe speed in-place!
          this.randomizeZone(mg, 6, 15);
          mg.chopSpeed = 120 + Math.random() * 55;
          const feedbackEl = document.getElementById('mg-feedback');
          if (feedbackEl) feedbackEl.textContent = feedbackMsg;
          const swingsEl = document.getElementById('mg-swings-lbl');
          if (swingsEl) swingsEl.textContent = `🪓 Swings Remaining: ${mg.swingsLeft} / ${mg.maxSwings}`;
          const perfEl = document.getElementById('mg-perfect-lbl');
          if (perfEl) perfEl.textContent = `✨ Perfect Hits: ${mg.perfectHits} / ${mg.maxSwings}`;
          const chopBtn = document.getElementById('mg-chop-btn');
          if (chopBtn) chopBtn.textContent = `🪓 Swing Toki (${mg.swingsLeft} left)`;

          this.updateMiniGameHUD();

          if (mg.swingsLeft <= 0) {
            this.completeTaskMiniGame(Math.round(Math.min(100, mg.score)));
            return;
          }
        } else if (mg.taskKey === 'voyage' && action === 'steer') {
          mg.shipPos = Math.max(6, Math.min(94, mg.shipPos + index));
        }

        this.updateMiniGameHUD();
        if (mg.score >= 100) {
          this.completeTaskMiniGame(100);
        }
      },

      renderMiniGameArena() {
        const mg = this.miniGameState;
        const arena = document.getElementById('mg-arena');
        if (!mg || !arena) return;

        if (mg.taskKey === 'kumara') {
          arena.innerHTML = `
            <div class="mg-mound-grid">
              ${mg.mounds.map((state, idx) => {
                const icon = state === 'kumara' ? '🍠' : (state === 'weed' ? '🌿' : '🟫');
                const label = state === 'kumara' ? 'Harvest (+10)' : (state === 'weed' ? 'Weed (−12!)' : 'Bare (−12!)');
                return `
                  <button class="mg-mound-btn ${state}" onclick="Game.handleMiniGameAction('mound', ${idx})">
                    <span class="mg-mound-icon">${icon}</span>
                    <span class="mg-mound-lbl">${label}</span>
                  </button>
                `;
              }).join('')}
            </div>
          `;
        } else if (mg.taskKey === 'fishing') {
          const goodLeft = Math.max(0, mg.zoneCenter - mg.goodWidth / 2);
          const goldLeft = Math.max(0, mg.zoneCenter - mg.goldWidth / 2);
          arena.innerHTML = `
            <div class="mg-gauge-wrap">
              <div class="mg-gauge-track">
                <div class="mg-gauge-zone-good" id="mg-fish-good" style="left:${goodLeft}%; width:${mg.goodWidth}%;"></div>
                <div class="mg-gauge-zone-gold" id="mg-fish-gold" style="left:${goldLeft}%; width:${mg.goldWidth}%;"></div>
                <div class="mg-gauge-marker" id="mg-fish-marker" style="left:${mg.fishPos}%;">🐟</div>
              </div>
              <div id="mg-feedback" class="mg-feedback">Gold (+15) • Green (+6) • Miss (−15) — Zone resizes each strike!</div>
              <button class="action-btn ready-harvest" style="max-width:240px; margin:8px auto 0;" onclick="Game.handleMiniGameAction('strike')">🎣 Strike Fishing Line!</button>
            </div>
          `;
        } else if (mg.taskKey === 'timber') {
          const goodLeft = Math.max(0, mg.zoneCenter - mg.goodWidth / 2);
          const goldLeft = Math.max(0, mg.zoneCenter - mg.goldWidth / 2);
          arena.innerHTML = `
            <div class="mg-gauge-wrap">
              <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--accent-kowhai); font-weight:700;">
                <span id="mg-swings-lbl">🪓 Swings Remaining: ${mg.swingsLeft} / ${mg.maxSwings}</span>
                <span id="mg-perfect-lbl">✨ Perfect Hits: ${mg.perfectHits} / ${mg.maxSwings}</span>
              </div>
              <div class="mg-gauge-track">
                <div class="mg-gauge-zone-good" id="mg-chop-good" style="left:${goodLeft}%; width:${mg.goodWidth}%;"></div>
                <div class="mg-gauge-zone-gold" id="mg-chop-gold" style="left:${goldLeft}%; width:${mg.goldWidth}%;"></div>
                <div class="mg-gauge-marker" id="mg-chop-marker" style="left:${mg.chopPos}%;">🪓</div>
              </div>
              <div id="mg-feedback" class="mg-feedback">Hit all 5 swings in the Gold zone (+20 pts each) for 100%!</div>
              <button class="action-btn ready-harvest" id="mg-chop-btn" style="max-width:240px; margin:8px auto 0;" onclick="Game.handleMiniGameAction('chop')">🪓 Swing Toki (${mg.swingsLeft} left)</button>
            </div>
          `;
        } else if (mg.taskKey === 'voyage') {
          const goldLeft = Math.max(0, mg.windCenter - mg.goldWidth / 2);
          arena.innerHTML = `
            <div class="mg-gauge-wrap">
              <div class="mg-gauge-track">
                <div class="mg-gauge-zone-gold" id="mg-wind-zone" style="left:${goldLeft}%; width:${mg.goldWidth}%;"></div>
                <div class="mg-gauge-marker" id="mg-ship-marker" style="left:${mg.shipPos}%;">⛵</div>
              </div>
              <div id="mg-feedback" class="mg-feedback">Fight the crosswind! Stay in the narrow Gold wind or lose score!</div>
              <div style="display:flex; gap:12px; justify-content:center; margin-top:10px;">
                <button class="action-btn" style="max-width:150px;" onclick="Game.handleMiniGameAction('steer', -8)">◀ Steer Port</button>
                <button class="action-btn" style="max-width:150px;" onclick="Game.handleMiniGameAction('steer', 8)">Steer Starboard ▶</button>
              </div>
            </div>
          `;
        }
        this.updateMiniGameHUD();
      },

      updateMiniGameHUD() {
        const mg = this.miniGameState;
        if (!mg) return;
        const scoreEl = document.getElementById('mg-score-val');
        const timeEl = document.getElementById('mg-time-val');
        if (scoreEl) scoreEl.textContent = `${Math.round(mg.score)} / 100`;
        if (timeEl) timeEl.textContent = `${mg.timeLeft.toFixed(1)}s`;

        const fishMarker = document.getElementById('mg-fish-marker');
        if (fishMarker) fishMarker.style.left = `${mg.fishPos.toFixed(2)}%`;
        const fishGold = document.getElementById('mg-fish-gold');
        if (fishGold) {
          fishGold.style.left = `${Math.max(0, mg.zoneCenter - mg.goldWidth / 2)}%`;
          fishGold.style.width = `${mg.goldWidth}%`;
        }
        const fishGood = document.getElementById('mg-fish-good');
        if (fishGood) {
          fishGood.style.left = `${Math.max(0, mg.zoneCenter - mg.goodWidth / 2)}%`;
          fishGood.style.width = `${mg.goodWidth}%`;
        }

        const chopMarker = document.getElementById('mg-chop-marker');
        if (chopMarker) chopMarker.style.left = `${mg.chopPos.toFixed(2)}%`;
        const chopGold = document.getElementById('mg-chop-gold');
        if (chopGold) {
          chopGold.style.left = `${Math.max(0, mg.zoneCenter - mg.goldWidth / 2)}%`;
          chopGold.style.width = `${mg.goldWidth}%`;
        }
        const chopGood = document.getElementById('mg-chop-good');
        if (chopGood) {
          chopGood.style.left = `${Math.max(0, mg.zoneCenter - mg.goodWidth / 2)}%`;
          chopGood.style.width = `${mg.goodWidth}%`;
        }

        const windZone = document.getElementById('mg-wind-zone');
        if (windZone) {
          windZone.style.left = `${Math.max(0, mg.windCenter - mg.goldWidth / 2).toFixed(2)}%`;
          windZone.style.width = `${mg.goldWidth}%`;
        }

        const shipMarker = document.getElementById('mg-ship-marker');
        if (shipMarker) shipMarker.style.left = `${mg.shipPos.toFixed(2)}%`;
      },

      completeTaskMiniGame(scorePct) {
        const mg = this.miniGameState;
        if (!mg || mg.finished) return;
        mg.finished = true;
        if (mg.rafId) cancelAnimationFrame(mg.rafId);

        const cleanScore = Math.max(0, Math.min(100, scorePct));
        const t = this.state.activeTasks[mg.taskKey];
        if (t) {
          t.playedMiniGame = true;
          // Base 20% skip even on a 0-score fail, scaling up to 85% skip at 100/100!
          const skipRatio = 0.20 + 0.65 * (cleanScore / 100);
          const skipSec = Math.round(t.duration * skipRatio);
          t.elapsed = Math.min(t.duration, t.elapsed + skipSec);
          if (t.elapsed >= t.duration) {
            t.status = 'ready';
            const taskInfo = this.getTaskToastMeta(mg.taskKey);
            this.pushToast({
              icon: taskInfo.icon,
              title: `${taskInfo.name} Ready!`,
              subtitle: 'Click to jump to task & collect boosted harvest',
              tab: 'actions',
              targetId: `card-task-${mg.taskKey}`
            });
          }
          // Resource multiplier scales from 1.15x (at 0 score) up to 2.50x (at 100 score)
          t.bonusMult = Number((1.15 + 1.35 * (cleanScore / 100)).toFixed(2));

          SoundFX.playMilestone();
          const arena = document.getElementById('mg-arena');
          if (arena) {
            const rank = cleanScore === 100 ? '🏆 Perfect Tohunga Mastery!' : (cleanScore >= 75 ? '🌟 Skilled Harvest!' : (cleanScore >= 35 ? '👍 Solid Effort' : '💨 Assisted Progress'));
            arena.innerHTML = `
              <div class="mg-result-box">
                <h3>${rank} (Score: ${cleanScore}/100)</h3>
                <p>⏩ <strong>Time Skipped:</strong> −${skipSec}s (${Math.round(skipRatio * 100)}% of task duration)</p>
                <p>🎁 <strong>Resource Yield Multiplier:</strong> <span style="color:var(--accent-kowhai); font-weight:700;">${t.bonusMult}× Resources</span></p>
                <button class="action-btn ready-harvest" style="max-width:220px; margin:12px auto 0;" onclick="Game.closeTaskMiniGame(true)">Return to Settlement</button>
              </div>
            `;
          }
        }
        this.renderUI(true);
        this.saveState();
      },

      closeTaskMiniGame(rebuildUI = true) {
        if (this.miniGameState && this.miniGameState.rafId) {
          cancelAnimationFrame(this.miniGameState.rafId);
        }
        this.miniGameState = null;
        const backdrop = document.getElementById('minigame-modal-backdrop');
        if (backdrop) backdrop.classList.remove('open');
        if (rebuildUI) this.renderUI(true);
      },

      surveyWhenuaAction() {
        const cost = this.getSurveyCost();
        if (this.state.resources.kai < cost.kai || this.state.resources.rakau < cost.rakau) return;
        if (this.state.resources.whenua >= (this.totalLandTiles || 413)) return;

        this.state.resources.kai -= cost.kai;
        this.state.resources.rakau -= cost.rakau;
        this.state.surveysCompleted = (this.state.surveysCompleted || 0) + 1;
        this.revealTiles(6);
        SoundFX.playHarvest();
        this.renderUI(true);
        this.saveState();
      },

      marketTradeAction() {
        if (this.state.resources.tradeGoods < 40) return;
        this.state.resources.tradeGoods -= 40;
        const posts = Math.max(1, this.countBuilding('trading_post'));
        const coinEarned = 30 + posts * 15;
        this.state.resources.coin = Math.min(this.state.caps.coin, this.state.resources.coin + coinEarned);
        SoundFX.playHarvest();
        this.renderUI(true);
        this.saveState();
      },

      adjustJob(jobId, delta) {
        const current = this.state.jobs[jobId] || 0;
        const cap = this.getJobCap(jobId);
        const totalAssigned = Object.values(this.state.jobs).reduce((a, b) => a + b, 0);
        const totalPop = Math.floor(this.state.population);

        if (delta > 0 && totalAssigned < totalPop && current < cap) {
          this.state.jobs[jobId] = current + 1;
        } else if (delta < 0 && current > 0) {
          if (jobId === 'gardener') {
            const minRequired = this.getBusyBuilderVillagers();
            if (current <= minRequired) {
              this.pushBanner('Villagers Busy Building', `${minRequired} Kaimahi are currently locked constructing active buildings and cannot be unassigned until construction finishes.`);
              return;
            }
          }
          this.state.jobs[jobId] = current - 1;
        }
        this.renderUI(true);
        this.saveState();
      },

      startTurningPoint() {
        if (this.state.turningPointTriggered) return;
        this.state.turningPointTriggered = true;
        this.state.turningPointProgress = 1;
        SoundFX.playMilestone();
        this.addChronicle('Sails on the Horizon: A tall-masted vessel approaches the bay.');
        this.pushBanner(
          '⛵ Turning Point — Sails on the Horizon',
          'Watch the outer bay: a tall sailing ship is approaching the headland. A new chapter of trade and township growth is beginning alongside your enduring Kāinga.'
        );
      },

      completeTurningPoint() {
        if (this.state.turningPointComplete) return;
        this.state.turningPointComplete = true;
        this.state.chapter = Math.max(this.state.chapter, 2);
        this.state.resources.coin = Math.min(this.state.caps.coin, this.state.resources.coin + 60);
        this.state.resources.tradeGoods = Math.min(this.state.caps.tradeGoods, this.state.resources.tradeGoods + 30);
        this.revealTiles(15);
        SoundFX.playMilestone();
        this.addChronicle('Chapter 2 Begun — Trade & Coexistence: New ships, wharves, and cottages join the thriving Kāinga.');
        this.pushBanner(
          '⚓ Chapter 2 Unlocked — Trade & Growth',
          'The ship has anchored in the deep harbour! You can now build the Deepwater Wharf, Trading Post, Cottages, Roads, and Farms while your founding Kāinga and Headland Pā continue to flourish.'
        );
        this.rebuildTerrainAndObjects();
        this.renderUI(true);
        this.saveState();
      },

      // =======================================================================
      // TICK LOOP & OFFLINE PROGRESS SIMULATION
      // =======================================================================
      tickSimulation(dtSeconds) {
        const s = this.state;
        const rates = this.getRates();

        // 1. Resource generation (clamped between 0 and storage cap)
        s.resources.kai = Math.max(0, Math.min(s.caps.kai, s.resources.kai + rates.kai * dtSeconds));
        s.resources.rakau = Math.max(0, Math.min(s.caps.rakau, s.resources.rakau + rates.rakau * dtSeconds));
        if (s.chapter >= 2) {
          s.resources.coin = Math.max(0, Math.min(s.caps.coin, s.resources.coin + rates.coin * dtSeconds));
          s.resources.tradeGoods = Math.max(0, Math.min(s.caps.tradeGoods, s.resources.tradeGoods + rates.tradeGoods * dtSeconds));
        }
        if (s.chapter >= 3) {
          s.resources.industry = Math.max(0, Math.min(s.caps.industry, s.resources.industry + rates.industry * dtSeconds));
        }

        // 2. Explorer Passive Scouting (Whenua Progress)
        if (rates.whenuaProgress > 0 && s.resources.whenua < (this.totalLandTiles || 413)) {
          s.whenuaProgress = (s.whenuaProgress || 0) + rates.whenuaProgress * dtSeconds;
          if (s.whenuaProgress >= 1) {
            const whole = Math.floor(s.whenuaProgress);
            s.whenuaProgress -= whole;
            this.revealTiles(whole);
          }
        }

        // 3. Age of Empires-style Villager Training Timer (Population only grows when purchased!)
        if (s.villagerTraining && s.villagerTraining.status === 'training') {
          s.villagerTraining.elapsed += dtSeconds;
          if (s.villagerTraining.elapsed >= s.villagerTraining.duration) {
            s.villagerTraining.status = 'idle';
            s.villagerTraining.elapsed = 0;
            if (s.population < s.populationCap) {
              s.population = Math.min(s.populationCap, Math.floor(s.population) + 1);
              this.recalculateCaps();
              SoundFX.playHarvest();
              const pos = this.isoToScreen(8, 15, 0.7);
              this.spawnSparkles(pos.x, pos.y - 12, 0x52c7a1, 12);
              this.addChronicle(`New Tangata villager trained at the Kāinga (Pop: ${Math.floor(s.population)}/${s.populationCap}).`);
              this.pushToast({
                icon: '👥',
                title: 'New Villager Trained!',
                subtitle: `Population is now ${Math.floor(s.population)}/${s.populationCap} — Click to assign role`,
                tab: 'villagers',
                targetId: 'card-train-villager',
                mapTile: { col: 8, row: 15, elev: 0.7 }
              });
              this.renderUI(true);
            }
          }
        }

        // 4. Construction timers (boosted by assigned Villagers & Engineers)
        const buildSpeedMult = this.getBuildSpeedMultiplier();
        let buildingCompleted = false;
        for (const b of s.buildings) {
          if (b.status === 'building') {
            b.elapsed += dtSeconds * buildSpeedMult;
            if (b.elapsed >= b.duration) {
              b.status = 'complete';
              b.elapsed = b.duration;
              buildingCompleted = true;
              const def = BUILDING_DEFS[b.type];
              if (def) {
                this.addChronicle(`Completed ${def.name} at grid (${b.col}, ${b.row}).`);
                const elev = (this.grid[b.row] && this.grid[b.row][b.col]) ? this.grid[b.row][b.col].elevation : 0.5;
                const pos = this.isoToScreen(b.col, b.row, elev);
                this.spawnSparkles(pos.x, pos.y - 16, 0xe8b948, 15);
                this.pushToast({
                  icon: def.icon || '🏗️',
                  title: `${def.name} Complete!`,
                  subtitle: 'Construction finished — Click to view building',
                  tab: 'build',
                  targetId: `card-build-${b.type}`,
                  mapTile: { col: b.col, row: b.row, elev }
                });
              }
            }
          }
        }
        if (buildingCompleted) {
          SoundFX.playMilestone();
          this.syncGridWithState();
          this.rebuildTerrainAndObjects();
          this.renderUI(true);
        }

        // 5. Active Task Timers
        let taskCompleted = false;
        for (const [k, task] of Object.entries(s.activeTasks)) {
          if (task.status === 'growing' || task.status === 'running') {
            task.elapsed += dtSeconds;
            if (task.elapsed >= task.duration) {
              task.elapsed = task.duration;
              task.status = 'ready';
              taskCompleted = true;
              const taskInfo = this.getTaskToastMeta(k);
              this.pushToast({
                icon: taskInfo.icon,
                title: `${taskInfo.name} Ready!`,
                subtitle: 'Click to jump to task & collect resources',
                tab: 'actions',
                targetId: `card-task-${k}`
              });
            }
          }
        }
        if (taskCompleted) {
          SoundFX.playHarvest();
          this.renderUI(true);
        }

        // 6. Turning Point Horizon Ship Approach
        if (s.turningPointTriggered && !s.turningPointComplete) {
          s.turningPointProgress = Math.min(100, s.turningPointProgress + dtSeconds * 1.6);
          if (s.turningPointProgress >= 100) {
            this.completeTurningPoint();
          }
        }

        this.checkMilestones();
      },

      getTaskToastMeta(taskKey) {
        const map = {
          kumara: { icon: '🍠', name: 'Māra Kūmara Harvest' },
          fishing: { icon: '🎣', name: 'Inshore Fishing Line' },
          timber: { icon: '🪓', name: 'Fell & Dress Timber' },
          voyage: { icon: '⛵', name: 'Harbour Schooner Voyage' }
        };
        return map[taskKey] || { icon: '✨', name: 'Settlement Task' };
      },

      simulateOfflineHours(hours = 2) {
        this.applyOfflineSimulation(hours * 3600, true);
      },

      applyOfflineSimulation(seconds, showModal = true) {
        const before = {
          pop: Math.floor(this.state.population),
          kai: Math.floor(this.state.resources.kai),
          rakau: Math.floor(this.state.resources.rakau),
          whenua: Math.floor(this.state.resources.whenua),
          coin: Math.floor(this.state.resources.coin),
          tradeGoods: Math.floor(this.state.resources.tradeGoods),
          industry: Math.floor(this.state.resources.industry)
        };

        // Simulate in chunks at 50% offline efficiency so milestones & constructions complete naturally
        this._isOfflineSim = true;
        const step = 30;
        let rem = seconds;
        while (rem > 0) {
          const dt = Math.min(step, rem);
          this.tickSimulation(dt * 0.5);
          rem -= dt;
        }
        this._isOfflineSim = false;

        this.syncGridWithState();
        this.rebuildTerrainAndObjects();
        this.renderUI(true);
        this.saveState();

        if (showModal) {
          const mins = Math.round(seconds / 60);
          const timeLabel = mins >= 60 ? `${(mins / 60).toFixed(1)} hours` : `${mins} minutes`;
          const gains = [
            { icon: '👥', label: 'Population', diff: Math.floor(this.state.population) - before.pop },
            { icon: '🍠', label: 'Kai (Food)', diff: Math.floor(this.state.resources.kai) - before.kai },
            { icon: '🪵', label: 'Rākau (Timber)', diff: Math.floor(this.state.resources.rakau) - before.rakau },
            { icon: '🗺️', label: 'Whenua (Land)', diff: Math.floor(this.state.resources.whenua) - before.whenua }
          ];
          if (this.state.chapter >= 2) {
            gains.push({ icon: '🪙', label: 'Coin', diff: Math.floor(this.state.resources.coin) - before.coin });
            gains.push({ icon: '📦', label: 'Trade Goods', diff: Math.floor(this.state.resources.tradeGoods) - before.tradeGoods });
          }

          document.getElementById('modal-title').textContent = `While You Were Away (${timeLabel})`;
          document.getElementById('modal-body').textContent =
            'Your kāinga and settlement continued working across the seasons (50% idle efficiency). Here is what accumulated while you were away:';
          const gridEl = document.getElementById('modal-gains');
          gridEl.innerHTML = gains
            .map(g => `<div class="gain-item">${g.icon} ${g.diff >= 0 ? '+' : ''}${g.diff} ${g.label}</div>`)
            .join('');
          document.getElementById('modal-backdrop').classList.add('open');
        }
      },

      closeModal() {
        document.getElementById('modal-backdrop').classList.remove('open');
      },

      checkMilestones() {
        let changed = false;
        for (const m of MILESTONES) {
          if (!this.state.milestonesReached.includes(m.id) && m.check(this)) {
            this.state.milestonesReached.push(m.id);
            m.onReach(this);
            this.addChronicle(`Milestone Reached: ${m.title} — ${m.rewardText}`);
            SoundFX.playMilestone();
            this.pushToast({
              icon: '🏆',
              title: `Milestone: ${m.title}`,
              subtitle: `${m.rewardText} — Click to view in Chronicle`,
              tab: 'chronicle',
              targetId: `card-milestone-${m.id}`
            });
            changed = true;
          }
        }
        if (changed) {
          this.syncGridWithState();
          this.rebuildTerrainAndObjects();
          this.renderUI(true);
          this.saveState();
        }
      },

      addChronicle(text) {
        const eraLabel = this.state.chapter === 1 ? 'Ch.1 Kāinga' : (this.state.chapter === 2 ? 'Ch.2 Harbour' : 'Ch.2b Township');
        this.state.chronicle.unshift({ time: eraLabel, text });
        if (this.state.chronicle.length > 30) this.state.chronicle.pop();
      },

      pushToast({ icon = '✨', title, subtitle = 'Click to view', tab = 'actions', targetId = '', mapTile = null }) {
        if (this._isOfflineSim) return;
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'completion-toast';
        toast.innerHTML = `
          <div class="completion-toast-icon">${icon}</div>
          <div class="completion-toast-body">
            <div class="completion-toast-title">${title}</div>
            <div class="completion-toast-sub">${subtitle}</div>
          </div>
          <button class="completion-toast-close" title="Dismiss" aria-label="Dismiss">✕</button>
        `;

        const dismissToast = () => {
          if (!toast.parentElement || toast.classList.contains('toast-out')) return;
          toast.classList.add('toast-out');
          setTimeout(() => {
            if (toast.parentElement) toast.remove();
          }, 260);
        };

        const closeBtn = toast.querySelector('.completion-toast-close');
        if (closeBtn) {
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dismissToast();
          });
        }

        toast.addEventListener('click', () => {
          this.focusToastTarget({ tab, targetId, mapTile });
          dismissToast();
        });

        container.prepend(toast);

        // Keep at most 3 stacked toasts
        const activeToasts = container.querySelectorAll('.completion-toast:not(.toast-out)');
        if (activeToasts.length > 3) {
          for (let i = 3; i < activeToasts.length; i++) {
            activeToasts[i].remove();
          }
        }

        // Auto-fade after 7 seconds
        setTimeout(() => {
          dismissToast();
        }, 7000);
      },

      focusToastTarget({ tab, targetId, mapTile }) {
        // 1. Switch to target sidebar tab and force a clean UI render
        if (tab) {
          this.switchTab(tab);
        }

        // 2. If a map tile is associated (e.g., completed building or villager at Kāinga), pan camera & sparkle
        if (mapTile && this.app && this.worldContainer) {
          const pos = this.isoToScreen(mapTile.col, mapTile.row, mapTile.elev || 0);
          this.camX = this.app.renderer.width * 0.5 - pos.x * this.camZoom;
          this.camY = this.app.renderer.height * 0.5 - pos.y * this.camZoom;
          this.applyCameraTransform();
          this.spawnSparkles(pos.x, pos.y - 16, 0xe8b948, 16);
        }

        // 3. Scroll target card into view and apply 3.5s glow effect to both the card and its action button
        requestAnimationFrame(() => {
          if (!targetId) return;
          const targetEl = document.getElementById(targetId);
          if (!targetEl) return;

          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetEl.classList.remove('toast-target-glow');
          void targetEl.offsetWidth; // trigger reflow so animation restarts cleanly
          targetEl.classList.add('toast-target-glow');

          const btn = targetEl.querySelector('.action-btn');
          if (btn) {
            btn.classList.remove('toast-target-glow');
            void btn.offsetWidth;
            btn.classList.add('toast-target-glow');
          }

          setTimeout(() => {
            targetEl.classList.remove('toast-target-glow');
            if (btn) btn.classList.remove('toast-target-glow');
          }, 3500);
        });
      },

      pushBanner(title, body) {
        const container = document.getElementById('event-banner-container');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'event-banner';
        div.innerHTML = `
          <div class="event-banner-text">
            <h4>${title}</h4>
            <p>${body}</p>
          </div>
          <button class="event-dismiss" onclick="this.parentElement.remove()">Dismiss</button>
        `;
        container.prepend(div);
        while (container.children.length > 2) {
          container.lastElementChild.remove();
        }
      },

};

window.GameEngine = GameEngine;
