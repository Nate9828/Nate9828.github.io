// =========================================================================
// GAME ENGINE & SIMULATION (Rules, Tick, Actions, Timers, Milestones)
// =========================================================================

const GameEngine = {
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

      recalculateCaps() {
        let popCap = 10;
        let kaiCap = 200;
        let rakauCap = 180;
        let tradeCap = 250;
        let growth = 0;

        for (const b of this.state.buildings) {
          if (b.status !== 'complete') continue;
          const def = BUILDING_DEFS[b.type];
          if (!def) continue;
          if (def.effects.popCap) popCap += def.effects.popCap;
          if (def.effects.kaiCap) kaiCap += def.effects.kaiCap;
          if (def.effects.rakauCap) rakauCap += def.effects.rakauCap;
          if (def.effects.tradeCap) tradeCap += def.effects.tradeCap;
          if (def.effects.growthPoints) growth += def.effects.growthPoints;
        }

        this.state.populationCap = popCap;
        this.state.caps.kai = kaiCap;
        this.state.caps.rakau = rakauCap;
        this.state.caps.tradeGoods = tradeCap;
        this.state.growthMeter = growth + Math.floor(this.state.population * 1.2);
      },

      getRates() {
        const rates = { kai: 0, rakau: 0, whenuaProgress: 0.05, coin: 0, tradeGoods: 0, industry: 0 };

        // Building passive generation
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
        for (const j of JOB_DEFS) {
          const count = this.state.jobs[j.id] || 0;
          if (count > 0) {
            for (const [resKey, val] of Object.entries(j.rates)) {
              rates[resKey] = (rates[resKey] || 0) + val * count;
            }
          }
        }

        // Modest food consumption by population (always stays positive or manageable)
        const foodUpkeep = Math.max(0, (this.state.population - 4) * 0.12);
        rates.kai = Math.max(0.2, rates.kai - foodUpkeep);

        return rates;
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
                // Must be near revealed land
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
              // Chapter 1 structures cluster warmly around the SW bay/kāinga (col <= 11, row >= 11)
              // Chapter 2/3 structures expand from harbor (12, 16) toward NE township
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
        const count = this.countBuilding(type, false);
        if (count >= def.maxCount) return;

        const cost = this.getBuildingCost(type);
        if (!this.canAfford(cost)) return;

        const tile = this.findTileForBuilding(type);
        if (!tile) {
          this.pushBanner('Expand Whenua First', 'Assign Pathfinders or survey land in Tasks to reveal more buildable tiles on the peninsula.');
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
      // ACTIVE TASKS & TURNING POINT SCRIPTING
      // =======================================================================
      triggerTask(taskKey) {
        const t = this.state.activeTasks[taskKey];
        if (!t) return;

        if (taskKey === 'kumara') {
          if (t.status === 'ready') {
            const gardens = Math.max(1, this.countBuilding('mara_kumara'));
            const gain = 14 + gardens * 9;
            this.state.resources.kai = Math.min(this.state.caps.kai, this.state.resources.kai + gain);
            t.status = 'growing';
            t.elapsed = 0;
            t.duration = 7;
            SoundFX.playHarvest();
            const pos = this.isoToScreen(9, 15, 0.8);
            this.spawnSparkles(pos.x, pos.y - 12, 0xe8b948, 12);
          }
        } else if (taskKey === 'fishing') {
          if (t.status === 'idle') {
            t.status = 'running';
            t.elapsed = 0;
          } else if (t.status === 'ready') {
            const spots = this.countBuilding('waka_ama');
            const gain = 16 + spots * 11;
            this.state.resources.kai = Math.min(this.state.caps.kai, this.state.resources.kai + gain);
            t.status = 'idle';
            t.elapsed = 0;
            SoundFX.playHarvest();
            const pos = this.isoToScreen(7, 17, 0);
            this.spawnSparkles(pos.x, pos.y - 10, 0x52c7a1, 10);
          }
        } else if (taskKey === 'timber') {
          if (t.status === 'idle') {
            t.status = 'running';
            t.elapsed = 0;
          } else if (t.status === 'ready') {
            const mills = this.countBuilding('timber_mill');
            const gain = 15 + mills * 14;
            this.state.resources.rakau = Math.min(this.state.caps.rakau, this.state.resources.rakau + gain);
            t.status = 'idle';
            t.elapsed = 0;
            SoundFX.playHarvest();
            const pos = this.isoToScreen(10, 14, 1.0);
            this.spawnSparkles(pos.x, pos.y - 14, 0xd4a359, 10);
          }
        } else if (taskKey === 'voyage') {
          if (t.status === 'idle') {
            t.status = 'running';
            t.elapsed = 0;
          } else if (t.status === 'ready') {
            const wharves = Math.max(1, this.countBuilding('wharf_port'));
            const coinGain = 28 * wharves;
            const goodsGain = 18 * wharves;
            const immGain = Math.min(this.state.populationCap - this.state.population, 3 * wharves);
            this.state.resources.coin = Math.min(this.state.caps.coin, this.state.resources.coin + coinGain);
            this.state.resources.tradeGoods = Math.min(this.state.caps.tradeGoods, this.state.resources.tradeGoods + goodsGain);
            if (immGain > 0) this.state.population += immGain;
            t.status = 'idle';
            t.elapsed = 0;
            SoundFX.playMilestone();
            const pos = this.isoToScreen(11, 18, 0);
            this.spawnSparkles(pos.x, pos.y - 14, 0xe8b948, 16);
          }
        }

        this.renderUI(true);
        this.saveState();
      },

      surveyWhenuaAction() {
        const costKai = 15;
        const costRakau = 10;
        if (this.state.resources.kai < costKai || this.state.resources.rakau < costRakau) return;
        this.state.resources.kai -= costKai;
        this.state.resources.rakau -= costRakau;
        this.revealTiles(10);
        SoundFX.playHarvest();
        this.renderUI(true);
        this.saveState();
      },

      marketTradeAction() {
        if (this.state.resources.tradeGoods < 20) return;
        this.state.resources.tradeGoods -= 20;
        const posts = Math.max(1, this.countBuilding('trading_post'));
        const coinEarned = 35 + posts * 12;
        this.state.resources.coin = Math.min(this.state.caps.coin, this.state.resources.coin + coinEarned);
        SoundFX.playHarvest();
        this.renderUI(true);
        this.saveState();
      },

      adjustJob(jobId, delta) {
        const current = this.state.jobs[jobId] || 0;
        const totalAssigned = Object.values(this.state.jobs).reduce((a, b) => a + b, 0);
        const totalPop = Math.floor(this.state.population);

        if (delta > 0 && totalAssigned < totalPop) {
          this.state.jobs[jobId] = current + 1;
        } else if (delta < 0 && current > 0) {
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
        this.state.resources.coin += 35;
        this.state.resources.tradeGoods += 20;
        this.revealTiles(35);
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

        // 1. Resource generation
        s.resources.kai = Math.min(s.caps.kai, s.resources.kai + rates.kai * dtSeconds);
        s.resources.rakau = Math.min(s.caps.rakau, s.resources.rakau + rates.rakau * dtSeconds);
        if (s.chapter >= 2) {
          s.resources.coin = Math.min(s.caps.coin, s.resources.coin + rates.coin * dtSeconds);
          s.resources.tradeGoods = Math.min(s.caps.tradeGoods, s.resources.tradeGoods + rates.tradeGoods * dtSeconds);
        }
        if (s.chapter >= 3) {
          s.resources.industry = Math.min(s.caps.industry, s.resources.industry + rates.industry * dtSeconds);
        }

        // 2. Progressive Whenua reveal from Pathfinders
        s.whenuaProgress = (s.whenuaProgress || 0) + rates.whenuaProgress * dtSeconds;
        if (s.whenuaProgress >= 1) {
          const whole = Math.floor(s.whenuaProgress);
          s.whenuaProgress -= whole;
          this.revealTiles(whole);
        }

        // 3. Population growth (when fed and below cap)
        if (s.population < s.populationCap && s.resources.kai > 8) {
          const popGrowthRate = 0.09 + (s.chapter >= 2 ? 0.07 : 0) + (s.chapter >= 3 ? 0.12 : 0);
          const prevFloor = Math.floor(s.population);
          s.population = Math.min(s.populationCap, s.population + popGrowthRate * dtSeconds);
          if (Math.floor(s.population) > prevFloor) {
            // Auto-assign new villager to helpful job so idle play feels rewarding
            this.autoAssignIdleVillager();
            this.recalculateCaps();
          }
        }

        // 4. Construction timers
        let buildingCompleted = false;
        for (const b of s.buildings) {
          if (b.status === 'building') {
            b.elapsed += dtSeconds;
            if (b.elapsed >= b.duration) {
              b.status = 'complete';
              b.elapsed = b.duration;
              buildingCompleted = true;
              const def = BUILDING_DEFS[b.type];
              if (def) {
                this.addChronicle(`Completed ${def.name} at grid (${b.col}, ${b.row}).`);
                const pos = this.isoToScreen(b.col, b.row, this.grid[b.row][b.col].elevation);
                this.spawnSparkles(pos.x, pos.y - 16, 0xe8b948, 15);
              }
            }
          }
        }
        if (buildingCompleted) {
          SoundFX.playMilestone();
          this.syncGridWithState();
          this.rebuildTerrainAndObjects();
        }

        // 5. Active Task Timers
        for (const [k, task] of Object.entries(s.activeTasks)) {
          if (task.status === 'growing' || task.status === 'running') {
            task.elapsed += dtSeconds;
            if (task.elapsed >= task.duration) {
              task.elapsed = task.duration;
              task.status = 'ready';
            }
          }
        }

        // 6. Turning Point Horizon Ship Approach
        if (s.turningPointTriggered && !s.turningPointComplete) {
          s.turningPointProgress = Math.min(100, s.turningPointProgress + dtSeconds * 6.5);
          if (s.turningPointProgress >= 100) {
            this.completeTurningPoint();
          }
        }

        this.checkMilestones();
      },

      autoAssignIdleVillager() {
        const totalAssigned = Object.values(this.state.jobs).reduce((a, b) => a + b, 0);
        const free = Math.floor(this.state.population) - totalAssigned;
        if (free <= 0) return;
        if (this.state.chapter === 1) {
          const order = ['gardener', 'forester', 'fisher', 'explorer'];
          const pick = order[totalAssigned % order.length];
          this.state.jobs[pick] = (this.state.jobs[pick] || 0) + 1;
        } else if (this.state.chapter === 2) {
          const order = ['merchant', 'pastoralist', 'gardener', 'forester'];
          const pick = order[totalAssigned % order.length];
          this.state.jobs[pick] = (this.state.jobs[pick] || 0) + 1;
        } else {
          const order = ['artisan', 'merchant', 'pastoralist'];
          const pick = order[totalAssigned % order.length];
          this.state.jobs[pick] = (this.state.jobs[pick] || 0) + 1;
        }
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

        // Simulate in chunks so milestones & constructions complete naturally
        const step = 30;
        let rem = seconds;
        while (rem > 0) {
          const dt = Math.min(step, rem);
          this.tickSimulation(dt * 0.15); // Scaled smoothly for multi-week curve
          rem -= dt;
        }

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
            'Your kāinga and settlement continued working across the seasons. Here is what accumulated while you were away:';
          const gridEl = document.getElementById('modal-gains');
          gridEl.innerHTML = gains
            .map(g => `<div class="gain-item">${g.icon} +${Math.max(0, g.diff)} ${g.label}</div>`)
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
