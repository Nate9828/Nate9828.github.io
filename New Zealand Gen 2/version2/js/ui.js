// =========================================================================
// UI CONTROLLER & TAB RENDERING
// =========================================================================

const GameUI = {
      setSpeed(mult) {
        this.speedMultiplier = mult;
        [1, 10, 60].forEach(m => {
          const btn = document.getElementById(`btn-speed-${m}`);
          if (btn) btn.classList.toggle('active', m === mult);
        });
      },

      toggleDayNight() {
        this.skyMode = (this.skyMode + 1) % 3;
        const labels = ['🌤️ Day', '🌇 Dusk', '✨ Night'];
        document.getElementById('btn-daynight').textContent = labels[this.skyMode];
      },

      toggleAudio() {
        SoundFX.enabled = !SoundFX.enabled;
        if (SoundFX.enabled) SoundFX.playHarvest();
        const btn = document.getElementById('btn-audio');
        btn.textContent = SoundFX.enabled ? '🔊 Audio' : '🔇 Audio';
        btn.classList.toggle('active', SoundFX.enabled);
      },

      togglePhotoMode() {
        document.body.classList.toggle('photo-mode');
        setTimeout(() => this.onResize(), 50);
      },

      downloadScreenshot() {
        if (!this.app || !this.app.view) return;
        const link = document.createElement('a');
        link.download = 'aotearoa-generations-scene.png';
        link.href = this.app.view.toDataURL('image/png');
        link.click();
      },

      switchTab(tabId) {
        this.activeTab = tabId;
        document.querySelectorAll('.tab-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        this.renderUI(true);
      },

      renderUI(fullRebuild = false) {
        const s = this.state;
        const rates = this.getRates();

        // 1. Update Era Header
        const eraNames = {
          1: 'Chapter 1 — Founding & Kāinga (Māori Era)',
          2: 'Chapter 2 — Harbour Trade & Coexistence',
          3: 'Chapter 2b — Township to Modern Horizon'
        };
        document.getElementById('hud-era-label').textContent = eraNames[s.chapter] || eraNames[1];

        // 2. Update Top Resource Pills
        const resItems = [
          { key: 'pop', icon: '👥', label: 'Tangata / Pop', val: Math.floor(s.population), cap: s.populationCap, rate: null },
          { key: 'kai', icon: '🍠', label: 'Kai (Food)', val: Math.floor(s.resources.kai), cap: s.caps.kai, rate: rates.kai },
          { key: 'rakau', icon: '🪵', label: 'Rākau (Timber)', val: Math.floor(s.resources.rakau), cap: s.caps.rakau, rate: rates.rakau },
          { key: 'whenua', icon: '🗺️', label: 'Whenua (Land)', val: Math.floor(s.resources.whenua), cap: (this.totalLandTiles || 413), rate: null }
        ];
        if (s.chapter >= 2) {
          resItems.push({ key: 'coin', icon: '🪙', label: 'Coin', val: Math.floor(s.resources.coin), cap: s.caps.coin, rate: rates.coin });
          resItems.push({ key: 'tradeGoods', icon: '📦', label: 'Trade Goods', val: Math.floor(s.resources.tradeGoods), cap: s.caps.tradeGoods, rate: rates.tradeGoods });
        }
        if (s.chapter >= 3) {
          resItems.push({ key: 'industry', icon: '⚙️', label: 'Industry', val: Math.floor(s.resources.industry), cap: s.caps.industry, rate: rates.industry });
        }

        const hudResEl = document.getElementById('hud-resources');
        hudResEl.innerHTML = resItems.map(r => `
          <div class="res-item">
            <span class="res-icon">${r.icon}</span>
            <div class="res-details">
              <span class="res-label">${r.label}</span>
              <div class="res-val-row">
                <span class="res-val">${r.val}</span>
                ${r.cap ? `<span class="res-cap">/${r.cap}</span>` : ''}
                ${r.rate !== null && r.rate > 0 ? `<span class="res-rate">+${r.rate.toFixed(1)}/s</span>` : ''}
              </div>
            </div>
          </div>
        `).join('');

        // 3. Update Milestone Progress Header
        const nextM = MILESTONES.find(m => !s.milestonesReached.includes(m.id));
        const reachedCount = s.milestonesReached.length;
        const pct = Math.min(100, Math.round((reachedCount / MILESTONES.length) * 100));
        document.getElementById('mh-progress-pct').textContent = `${pct}% (${reachedCount}/${MILESTONES.length})`;
        document.getElementById('mh-progress-bar').style.width = `${pct}%`;
        document.getElementById('mh-next-text').textContent = nextM
          ? `Next Goal: ${nextM.title}`
          : '✨ All Era Milestones Complete!';
        document.getElementById('mh-whenua-badge').textContent = `Whenua: ${Math.floor(s.resources.whenua)}/${this.totalLandTiles || 413} tiles`;

        // If not a full rebuild and active tab is actions, update timer bars smoothly in-place
        if (!fullRebuild && this.activeTab === 'actions') {
          this.updateActiveTaskBarsInPlace();
          return;
        }
        if (!fullRebuild) return;

        // 4. Render Active Tab Body
        const contentEl = document.getElementById('panel-content');
        if (this.activeTab === 'actions') {
          contentEl.innerHTML = this.renderActionsTab();
        } else if (this.activeTab === 'build') {
          contentEl.innerHTML = this.renderBuildTab();
        } else if (this.activeTab === 'villagers') {
          contentEl.innerHTML = this.renderVillagersTab();
        } else if (this.activeTab === 'chronicle') {
          contentEl.innerHTML = this.renderChronicleTab();
        }
      },

      updateActiveTaskBarsInPlace() {
        for (const [k, t] of Object.entries(this.state.activeTasks)) {
          const bar = document.getElementById(`task-bar-${k}`);
          const btn = document.getElementById(`task-btn-${k}`);
          if (bar) {
            const p = t.status === 'ready' ? 100 : Math.min(100, Math.round((t.elapsed / t.duration) * 100));
            bar.style.width = `${p}%`;
          }
          if (btn) {
            if (t.status === 'ready' && !btn.classList.contains('ready-harvest')) {
              this.renderUI(true);
              return;
            }
          }
        }
      },

      renderActionsTab() {
        const s = this.state;
        const tasks = [
          {
            key: 'kumara',
            title: 'Māra Kūmara Harvest',
            icon: '🍠',
            eraClass: 'chapter1-card',
            desc: 'Kūmara vines ripen automatically in the sun. Harvest when golden for a rich food surplus.',
            btnIdle: 'Growing Kūmara...',
            btnRun: 'Ripening in Sun...',
            btnReady: '🌾 Harvest Kūmara (+Kai)'
          },
          {
            key: 'fishing',
            title: 'Launch Waka Ama Fishing',
            icon: '🛶',
            eraClass: 'chapter1-card',
            desc: 'Paddle out into the sheltered bay to haul in fresh kahawai and tāmure.',
            btnIdle: '🛶 Launch Waka Ama',
            btnRun: 'Fishing at Sea...',
            btnReady: '🐟 Collect Catch (+Kai)'
          },
          {
            key: 'timber',
            title: 'Gather Native Rākau',
            icon: '🪵',
            eraClass: 'chapter1-card',
            desc: 'Select and fell seasoned timber from the ngahere for whare and waka construction.',
            btnIdle: '🪓 Gather Rākau Timber',
            btnRun: 'Gathering in Ngahere...',
            btnReady: '🪵 Collect Timber (+Rākau)'
          }
        ];

        if (s.chapter >= 2) {
          tasks.push({
            key: 'voyage',
            title: 'Harbour Trade Ship Voyage',
            icon: '⛵',
            eraClass: 'chapter2-card',
            desc: 'Dispatch a trading vessel across the Tasman to exchange flax and wool for Coin, Goods, and Immigrants.',
            btnIdle: '⚓ Dispatch Trade Ship',
            btnRun: 'Sailing on Voyage...',
            btnReady: '🪙 Welcome Returning Ship!'
          });
        }

        let html = `<div class="section-label"><span>Active Settlement Tasks</span><span>Tap to Collect</span></div>`;

        for (const item of tasks) {
          const t = s.activeTasks[item.key];
          const pct = t.status === 'ready' ? 100 : Math.min(100, Math.round((t.elapsed / t.duration) * 100));
          const isReady = t.status === 'ready';
          const isRunning = t.status === 'running' || t.status === 'growing';
          const label = isReady ? item.btnReady : (isRunning ? `${item.btnRun} (${Math.ceil(t.duration - t.elapsed)}s)` : item.btnIdle);

          html += `
            <div class="game-card ${item.eraClass}">
              <div class="card-top">
                <div class="card-title-group">
                  <div class="card-icon">${item.icon}</div>
                  <div>
                    <div class="card-title">${item.title}</div>
                    <div class="card-subtitle">${isReady ? 'Ready to collect!' : `${pct}% complete`}</div>
                  </div>
                </div>
              </div>
              <div class="card-desc">${item.desc}</div>
              <div class="timer-bar-wrap">
                <div class="timer-bar-fill" id="task-bar-${item.key}" style="width:${pct}%"></div>
              </div>
              <div class="card-actions">
                <button class="action-btn ${isReady ? 'ready-harvest' : ''}" id="task-btn-${item.key}"
                  ${(isRunning && !isReady) ? 'disabled' : ''}
                  onclick="Game.triggerTask('${item.key}')">${label}</button>
              </div>
            </div>
          `;
        }

        // Instant Expansion & Market Actions
        const canSurvey = s.resources.kai >= 15 && s.resources.rakau >= 10 && s.resources.whenua < (this.totalLandTiles || 413);
        html += `
          <div class="section-label"><span>Expansion &amp; Special Events</span></div>
          <div class="game-card chapter1-card">
            <div class="card-top">
              <div class="card-title-group">
                <div class="card-icon">🗺️</div>
                <div>
                  <div class="card-title">Survey New Whenua (Land)</div>
                  <div class="card-subtitle">Reveals +10 isometric tiles on the peninsula</div>
                </div>
              </div>
            </div>
            <div class="card-costs">
              <span class="cost-tag ${s.resources.kai >= 15 ? 'affordable' : 'unaffordable'}">15 Kai</span>
              <span class="cost-tag ${s.resources.rakau >= 10 ? 'affordable' : 'unaffordable'}">10 Rākau</span>
            </div>
            <div class="card-actions">
              <button class="action-btn" ${canSurvey ? '' : 'disabled'} onclick="Game.surveyWhenuaAction()">🧭 Send Survey Party (+10 Whenua)</button>
            </div>
          </div>
        `;

        if (s.chapter >= 2) {
          const canTrade = s.resources.tradeGoods >= 20;
          html += `
            <div class="game-card chapter2-card">
              <div class="card-top">
                <div class="card-title-group">
                  <div class="card-icon">⚖️</div>
                  <div>
                    <div class="card-title">Host Harbour Market Day</div>
                    <div class="card-subtitle">Exchange 20 Trade Goods for immediate Coin</div>
                  </div>
                </div>
              </div>
              <div class="card-actions">
                <button class="action-btn" ${canTrade ? '' : 'disabled'} onclick="Game.marketTradeAction()">🪙 Exchange 20 Goods for Coin</button>
              </div>
            </div>
          `;
        }

        // Turning Point manual trigger helper if player is close and wants to experience it
        if (!s.turningPointTriggered && this.countBuilding('pa_headland') >= 1) {
          html += `
            <div class="game-card chapter2-card">
              <div class="card-top">
                <div class="card-title-group">
                  <div class="card-icon">⛵</div>
                  <div>
                    <div class="card-title">Look to the Horizon (Turning Point)</div>
                    <div class="card-subtitle">Headland Pā complete — ready for Chapter 2</div>
                  </div>
                </div>
              </div>
              <div class="card-actions">
                <button class="action-btn ready-harvest" onclick="Game.startTurningPoint()">⛵ Spot Sails on the Horizon</button>
              </div>
            </div>
          `;
        }

        return html;
      },

      renderBuildTab() {
        const s = this.state;
        let html = `<div class="section-label"><span>Construct &amp; Expand Scene</span><span>Placed on Grid</span></div>`;

        for (const [type, def] of Object.entries(BUILDING_DEFS)) {
          if (def.era > s.chapter) continue;
          const builtCount = this.countBuilding(type, true);
          const totalCount = this.countBuilding(type, false);
          const inProgress = totalCount > builtCount;
          const cost = this.getBuildingCost(type);
          const affordable = this.canAfford(cost);
          const popLocked = def.unlockPop && s.population < def.unlockPop;
          const maxed = totalCount >= def.maxCount;

          const eraClass = def.era === 1 ? 'chapter1-card' : (def.era === 2 ? 'chapter2-card' : 'chapter2b-card');
          const costTags = Object.entries(cost).map(([k, v]) => {
            const has = (s.resources[k] || 0) >= v;
            const labels = { kai: 'Kai', rakau: 'Rākau', coin: 'Coin', tradeGoods: 'Goods', industry: 'Industry' };
            return `<span class="cost-tag ${has ? 'affordable' : 'unaffordable'}">${v} ${labels[k] || k}</span>`;
          }).join('');

          let btnText = `Build ${def.name.split(' (')[0]} (${def.buildTime}s)`;
          if (maxed) btnText = 'Maximum Built on Peninsula';
          else if (popLocked) btnText = `Requires ${def.unlockPop} Population`;
          else if (inProgress) btnText = 'Construction in Progress...';

          html += `
            <div class="game-card ${eraClass}">
              <div class="card-top">
                <div class="card-title-group">
                  <div class="card-icon">${def.icon}</div>
                  <div>
                    <div class="card-title">${def.name}</div>
                    <div class="card-subtitle">Era ${def.era === 1 ? 'I (Kāinga)' : (def.era === 2 ? 'II (Harbour)' : 'IIb (Township)')}</div>
                  </div>
                </div>
                <span class="card-badge">${builtCount} / ${def.maxCount}</span>
              </div>
              <div class="card-desc">${def.desc}</div>
              ${!maxed ? `<div class="card-costs">${costTags}</div>` : ''}
              <div class="card-actions">
                <button class="action-btn"
                  ${(!affordable || popLocked || maxed) ? 'disabled' : ''}
                  onclick="Game.startBuilding('${type}')">${btnText}</button>
              </div>
            </div>
          `;
        }
        return html;
      },

      renderVillagersTab() {
        const s = this.state;
        const totalPop = Math.floor(s.population);
        const totalAssigned = Object.values(s.jobs).reduce((a, b) => a + b, 0);
        const unassigned = Math.max(0, totalPop - totalAssigned);

        let html = `
          <div class="section-label">
            <span>Villager &amp; Settler Roles</span>
            <span style="color:var(--accent-pounamu-bright);">${unassigned} Unassigned / ${totalPop} Total</span>
          </div>
        `;

        for (const j of JOB_DEFS) {
          if (j.era > s.chapter) continue;
          const count = s.jobs[j.id] || 0;
          const eraClass = j.era === 1 ? 'chapter1-card' : (j.era === 2 ? 'chapter2-card' : 'chapter2b-card');
          html += `
            <div class="game-card ${eraClass}">
              <div class="card-top">
                <div class="card-title-group">
                  <div class="card-icon">${j.icon}</div>
                  <div>
                    <div class="card-title">${j.name}</div>
                    <div class="card-subtitle">${j.desc}</div>
                  </div>
                </div>
                <div class="job-stepper">
                  <button class="step-btn" ${count <= 0 ? 'disabled' : ''} onclick="Game.adjustJob('${j.id}', -1)">−</button>
                  <span class="job-count">${count}</span>
                  <button class="step-btn" ${unassigned <= 0 ? 'disabled' : ''} onclick="Game.adjustJob('${j.id}', 1)">＋</button>
                </div>
              </div>
            </div>
          `;
        }
        return html;
      },

      renderChronicleTab() {
        const s = this.state;
        let html = `<div class="section-label"><span>Era Milestones</span><span>${s.milestonesReached.length}/${MILESTONES.length}</span></div>`;

        for (const m of MILESTONES) {
          const done = s.milestonesReached.includes(m.id);
          html += `
            <div class="game-card ${done ? 'chapter1-card' : ''}" style="opacity:${done ? '1' : '0.78'}">
              <div class="card-top">
                <div class="card-title-group">
                  <div class="card-icon">${done ? '✅' : '🎯'}</div>
                  <div>
                    <div class="card-title">${m.title}</div>
                    <div class="card-subtitle">${m.rewardText}</div>
                  </div>
                </div>
              </div>
              <div class="card-desc">${m.desc}</div>
            </div>
          `;
        }

        html += `<div class="section-label"><span>Settlement Chronicle</span></div>`;
        for (const entry of s.chronicle) {
          html += `
            <div class="game-card" style="padding:8px 11px;">
              <div style="font-size:0.7rem; color:var(--accent-kowhai); font-weight:700;">${entry.time}</div>
              <div style="font-size:0.77rem; color:var(--text-cream);">${entry.text}</div>
            </div>
          `;
        }
        return html;
      }
};

window.GameUI = GameUI;
