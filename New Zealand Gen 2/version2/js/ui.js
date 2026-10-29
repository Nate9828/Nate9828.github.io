// =========================================================================
// UI CONTROLLER & TAB RENDERING
// =========================================================================

const GameUI = {
      formatDuration(sec) {
        const s = Math.max(0, Math.ceil(sec));
        if (s < 60) return `${s}s`;
        const m = Math.floor(s / 60);
        const remS = s % 60;
        if (m < 60) return remS > 0 ? `${m}m ${remS}s` : `${m}m`;
        const h = Math.floor(m / 60);
        const remM = m % 60;
        return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
      },

      formatRate(rate) {
        if (rate === null || rate === undefined || Math.abs(rate) < 0.001) return '';
        const sign = rate > 0 ? '+' : '';
        const colorStyle = rate < 0 ? 'style="color:#f28b82;"' : '';
        return `<span class="res-rate" ${colorStyle}>${sign}${rate.toFixed(2)}/s</span>`;
      },

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
          { key: 'whenua', icon: '🗺️', label: 'Whenua (Land)', val: Math.floor(s.resources.whenua), cap: (this.totalLandTiles || 413), rate: rates.whenuaProgress }
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
                ${this.formatRate(r.rate)}
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

        // If not a full rebuild, update active task, villager training, or construction timer bars smoothly in-place
        if (!fullRebuild) {
          if (this.activeTab === 'actions') {
            this.updateActiveTaskBarsInPlace();
          } else if (this.activeTab === 'build') {
            this.updateBuildTimersInPlace();
          } else if (this.activeTab === 'villagers') {
            this.updateVillagerTimersInPlace();
          }
          return;
        }

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
        const runLabels = {
          kumara: 'Ripening in Sun...',
          fishing: 'Fishing at Sea...',
          timber: 'Gathering in Ngahere...',
          voyage: 'Sailing on Voyage...'
        };
        for (const [k, t] of Object.entries(this.state.activeTasks)) {
          const bar = document.getElementById(`task-bar-${k}`);
          const btn = document.getElementById(`task-btn-${k}`);
          const sub = document.getElementById(`task-sub-${k}`);
          const remLabel = this.formatDuration(t.duration - t.elapsed);
          if (bar) {
            const p = t.status === 'ready' ? 100 : Math.min(100, Math.round((t.elapsed / t.duration) * 100));
            bar.style.width = `${p}%`;
            if (sub && t.status !== 'ready' && (t.status === 'running' || t.status === 'growing')) {
              sub.textContent = `${p}% complete (${remLabel})`;
            }
          }
          if (btn) {
            if (t.status === 'ready' && !btn.classList.contains('ready-harvest')) {
              this.renderUI(true);
              return;
            }
            if ((t.status === 'running' || t.status === 'growing') && t.playedMiniGame) {
              btn.textContent = `${runLabels[k] || 'In Progress...'} (${remLabel}) • 🌟 ${t.bonusMult}×`;
            }
          }
        }
      },

      updateBuildTimersInPlace() {
        const buildSpeed = this.getBuildSpeedMultiplier();
        for (const activeB of this.state.buildings) {
          if (activeB.status !== 'building') continue;
          const bar = document.getElementById(`build-bar-${activeB.type}`);
          const btn = document.getElementById(`build-btn-${activeB.type}`);
          if (bar) {
            const pct = Math.min(100, Math.round((activeB.elapsed / activeB.duration) * 100));
            bar.style.width = `${pct}%`;
          }
          if (btn) {
            const remRealSec = (activeB.duration - activeB.elapsed) / buildSpeed;
            btn.textContent = `Constructing... (${this.formatDuration(remRealSec)})`;
          }
        }
      },

      updateVillagerTimersInPlace() {
        const vt = this.state.villagerTraining;
        if (vt && vt.status === 'training') {
          const bar = document.getElementById('villager-train-bar');
          const btn = document.getElementById('villager-train-btn');
          const sub = document.getElementById('villager-train-sub');
          const pct = Math.min(100, Math.round((vt.elapsed / vt.duration) * 100));
          const rem = this.formatDuration(vt.duration - vt.elapsed);
          if (bar) bar.style.width = `${pct}%`;
          if (btn) btn.textContent = `⏳ Training Villager... (${rem})`;
          if (sub) sub.textContent = `Training in progress — ${pct}% (${rem} remaining)`;
        }
        const scoutBar = document.getElementById('explorer-scout-bar');
        const scoutLbl = document.getElementById('explorer-scout-lbl');
        if (scoutBar) {
          const sp = Math.min(100, Math.round((this.state.whenuaProgress || 0) * 100));
          scoutBar.style.width = `${sp}%`;
          if (scoutLbl) scoutLbl.textContent = `${sp}% toward next Whenua tile`;
        }
      },

      renderActionsTab() {
        const s = this.state;
        const kYield = this.getTaskFinalYield('kumara');
        const fYield = this.getTaskFinalYield('fishing');
        const tYield = this.getTaskFinalYield('timber');
        const vYield = this.getTaskFinalYield('voyage');

        const tasks = [
          {
            key: 'kumara',
            title: 'Māra Kūmara Harvest',
            icon: '🍠',
            eraClass: 'chapter1-card',
            desc: 'Kūmara vines ripen in the sun. Play the <strong>Mound Tending</strong> mini-game to skip <strong>20%–85% time</strong> and earn up to <strong>2.5× Kai</strong>!',
            btnIdle: 'Growing Kūmara...',
            btnRun: 'Ripening in Sun...',
            btnReady: `🌾 Harvest Kūmara (+${kYield.kai} Kai)`,
            rewardPreview: `+${kYield.kai} Kai`
          },
          {
            key: 'fishing',
            title: 'Launch Waka Ama Fishing',
            icon: '🛶',
            eraClass: 'chapter1-card',
            desc: 'Paddle into the bay for kahawai. Launch the Waka, then play the <strong>Fishing</strong> mini-game to skip <strong>20%–85% time</strong> and boost catch up to <strong>2.5× Kai</strong>!',
            btnIdle: '🛶 Launch Waka Ama',
            btnRun: 'Fishing at Sea...',
            btnReady: `🐟 Collect Catch (+${fYield.kai} Kai)`,
            rewardPreview: `+${fYield.kai} Kai`
          },
          {
            key: 'timber',
            title: 'Gather Native Rākau',
            icon: '🪵',
            eraClass: 'chapter1-card',
            desc: 'Fell seasoned timber in the ngahere. Start gathering, then play the <strong>5-Swing Toki</strong> mini-game to skip <strong>20%–85% time</strong> and boost <strong>Rākau up to 2.5×</strong>!',
            btnIdle: '🪓 Gather Rākau Timber',
            btnRun: 'Gathering in Ngahere...',
            btnReady: `🪵 Collect Timber (+${tYield.rakau} Rākau)`,
            rewardPreview: `+${tYield.rakau} Rākau`
          }
        ];

        if (s.chapter >= 2) {
          tasks.push({
            key: 'voyage',
            title: 'Harbour Trade Ship Voyage',
            icon: '⛵',
            eraClass: 'chapter2-card',
            desc: 'Dispatch a trading vessel across the Tasman, then play the <strong>Trade Winds</strong> mini-game to skip <strong>20%–85% time</strong> and boost <strong>Coin &amp; Trade Goods up to 2.5×</strong>!',
            btnIdle: '⚓ Dispatch Trade Ship',
            btnRun: 'Sailing on Voyage...',
            btnReady: `🪙 Welcome Ship (+${vYield.coin} Coin, +${vYield.tradeGoods} Goods)`,
            rewardPreview: `+${vYield.coin} Coin, +${vYield.tradeGoods} Goods`
          });
        }

        let html = `<div class="section-label"><span>Interactive Settlement Tasks</span><span>Start Task → Play Mini-Game</span></div>`;

        for (const item of tasks) {
          const t = s.activeTasks[item.key];
          const pct = t.status === 'ready' ? 100 : Math.min(100, Math.round((t.elapsed / t.duration) * 100));
          const isReady = t.status === 'ready';
          const isRunning = t.status === 'running' || t.status === 'growing';
          const remLabel = this.formatDuration(t.duration - t.elapsed);

          let btnClass = 'action-btn';
          let btnDisabled = '';
          let btnOnClick = `Game.triggerTask('${item.key}')`;
          let btnLabel = item.btnIdle;

          if (isReady) {
            btnClass = 'action-btn ready-harvest';
            btnLabel = item.btnReady;
          } else if (isRunning && !t.playedMiniGame) {
            btnClass = 'action-btn minigame-trigger-btn';
            btnOnClick = `Game.openTaskMiniGame('${item.key}')`;
            btnLabel = `🎮 Play Mini-Game (−20% to −85% Time & Boost)`;
          } else if (isRunning && t.playedMiniGame) {
            btnDisabled = 'disabled';
            btnLabel = `${item.btnRun} (${remLabel}) • 🌟 ${t.bonusMult}×`;
          }

          html += `
            <div class="game-card ${item.eraClass}" id="card-task-${item.key}">
              <div class="card-top">
                <div class="card-title-group">
                  <div class="card-icon">${item.icon}</div>
                  <div>
                    <div class="card-title">${item.title}</div>
                    <div class="card-subtitle" id="task-sub-${item.key}">${isReady ? 'Ready to collect!' : (isRunning ? `${pct}% complete (${remLabel})` : `Base Duration: ${this.formatDuration(t.duration)}`)}</div>
                  </div>
                </div>
                <span class="card-badge" style="${t.bonusMult > 1 ? 'color:var(--accent-kowhai); border-color:var(--accent-kowhai);' : ''}">
                  ${t.bonusMult > 1 ? `🌟 ${t.bonusMult}× (${item.rewardPreview})` : item.rewardPreview}
                </span>
              </div>
              <div class="card-desc">${item.desc}</div>
              <div class="timer-bar-wrap">
                <div class="timer-bar-fill" id="task-bar-${item.key}" style="width:${pct}%"></div>
              </div>
              <div class="card-actions">
                <button class="${btnClass}" id="task-btn-${item.key}" ${btnDisabled} onclick="${btnOnClick}">${btnLabel}</button>
              </div>
            </div>
          `;
        }

        // Progressive Survey Expedition & Market Actions
        const surveyCost = this.getSurveyCost();
        const explorerDiscPct = Math.round(this.getExplorerDiscount() * 100);
        const canSurvey = s.resources.kai >= surveyCost.kai && s.resources.rakau >= surveyCost.rakau && s.resources.whenua < (this.totalLandTiles || 413);
        html += `
          <div class="section-label"><span>Expansion &amp; Special Events</span></div>
          <div class="game-card chapter1-card">
            <div class="card-top">
              <div class="card-title-group">
                <div class="card-icon">🗺️</div>
                <div>
                  <div class="card-title">Survey New Whenua (Land)</div>
                  <div class="card-subtitle">Expedition #${(s.surveysCompleted || 0) + 1} ${explorerDiscPct > 0 ? `(${explorerDiscPct}% Explorer Discount!)` : ''}</div>
                </div>
              </div>
            </div>
            <div class="card-desc">Send an expedition across the peninsula to reveal <strong>+6 Whenua</strong> buildable land tiles. Assign <strong>Explorers</strong> to reduce <strong>Kai &amp; Rākau</strong> survey costs.</div>
            <div class="card-costs">
              <span class="cost-tag ${s.resources.kai >= surveyCost.kai ? 'affordable' : 'unaffordable'}">${surveyCost.kai} Kai</span>
              <span class="cost-tag ${s.resources.rakau >= surveyCost.rakau ? 'affordable' : 'unaffordable'}">${surveyCost.rakau} Rākau</span>
            </div>
            <div class="card-actions">
              <button class="action-btn" ${canSurvey ? '' : 'disabled'} onclick="Game.surveyWhenuaAction()">🧭 Send Survey Party (+6 Whenua)</button>
            </div>
          </div>
        `;

        if (s.chapter >= 2) {
          const canTrade = s.resources.tradeGoods >= 40;
          const posts = Math.max(1, this.countBuilding('trading_post'));
          const coinEarned = 30 + posts * 15;
          html += `
            <div class="game-card chapter2-card">
              <div class="card-top">
                <div class="card-title-group">
                  <div class="card-icon">⚖️</div>
                  <div>
                    <div class="card-title">Host Harbour Market Day</div>
                    <div class="card-subtitle">Coastal Exchange</div>
                  </div>
                </div>
              </div>
              <div class="card-desc">Exchange <strong>40 Trade Goods</strong> at the harbour market for an immediate payout of <strong>+${coinEarned} Coin</strong> (boosted by <strong>Trading Posts</strong>).</div>
              <div class="card-actions">
                <button class="action-btn" ${canTrade ? '' : 'disabled'} onclick="Game.marketTradeAction()">🪙 Exchange 40 Goods for +${coinEarned} Coin</button>
              </div>
            </div>
          `;
        }

        // Turning Point manual trigger helper once requirements are met
        if (!s.turningPointTriggered && this.countBuilding('pa_headland') >= 1 && s.population >= 36 && s.resources.whenua >= 65) {
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
              <div class="card-desc">Trigger the <strong>Sails on the Horizon</strong> Turning Point to unlock <strong>Chapter 2</strong>, <strong>Coin</strong>, <strong>Trade Goods</strong>, and harbour buildings!</div>
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
        const buildSpeed = this.getBuildSpeedMultiplier();
        const speedBonusPct = Math.round((buildSpeed - 1) * 100);
        const totalBuilders = s.jobs.gardener || 0;
        const busyBuilders = this.getBusyBuilderVillagers();
        const availBuilders = this.getAvailableBuilderVillagers();

        let html = `
          <div class="section-label">
            <span>Construct &amp; Expand Scene</span>
            <span style="color:var(--accent-pounamu-bright);">👷 Free Villagers: ${availBuilders}/${totalBuilders} ${speedBonusPct > 0 ? `(⚡ +${speedBonusPct}% Speed)` : ''}</span>
          </div>
        `;

        for (const [type, def] of Object.entries(BUILDING_DEFS)) {
          if (def.era > s.chapter) continue;
          const builtCount = this.countBuilding(type, true);
          const totalCount = this.countBuilding(type, false);
          const activeObj = s.buildings.find(b => b.type === type && b.status === 'building');
          const inProgress = Boolean(activeObj);
          const cost = this.getBuildingCost(type);
          const affordable = this.canAfford(cost);
          const popLocked = def.unlockPop && s.population < def.unlockPop;
          const maxed = totalCount >= def.maxCount;
          const reqV = def.reqVillagers || 2;
          const hasEnoughVillagers = availBuilders >= reqV;

          const eraClass = def.era === 1 ? 'chapter1-card' : (def.era === 2 ? 'chapter2-card' : 'chapter2b-card');
          const costTags = Object.entries(cost).map(([k, v]) => {
            const has = (s.resources[k] || 0) >= v;
            const cap = s.caps[k] || Infinity;
            const needsCap = v > cap;
            const labels = { kai: 'Kai', rakau: 'Rākau', coin: 'Coin', tradeGoods: 'Goods', industry: 'Industry' };
            return `<span class="cost-tag ${has ? 'affordable' : 'unaffordable'}" title="${needsCap ? 'Increase storage cap to hold this amount' : ''}">${v} ${labels[k] || k}${needsCap ? ' (Cap!)' : ''}</span>`;
          }).join('');

          const villagerTag = `<span class="cost-tag ${inProgress || hasEnoughVillagers ? 'affordable' : 'unaffordable'}" title="Requires ${reqV} available Kaimahi (Villagers & Builders)">👷 ${reqV} Villagers</span>`;

          const effectiveBuildSec = def.buildTime / buildSpeed;
          let btnText = `Build ${def.name.split(' (')[0]} (${this.formatDuration(effectiveBuildSec)})`;
          if (inProgress) {
            const remRealSec = (activeObj.duration - activeObj.elapsed) / buildSpeed;
            btnText = `Constructing... (${this.formatDuration(remRealSec)})`;
          } else if (maxed) {
            btnText = 'Maximum Built on Peninsula';
          } else if (popLocked) {
            btnText = `Requires ${def.unlockPop} Population`;
          } else if (!hasEnoughVillagers) {
            btnText = `Requires ${reqV} Free Villagers (${availBuilders}/${reqV} Available)`;
          }

          const progressPct = inProgress ? Math.min(100, Math.round((activeObj.elapsed / activeObj.duration) * 100)) : 0;

          html += `
            <div class="game-card ${eraClass}" id="card-build-${type}">
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
              ${inProgress ? `
                <div class="timer-bar-wrap">
                  <div class="timer-bar-fill" id="build-bar-${type}" style="width:${progressPct}%"></div>
                </div>
              ` : ''}
              ${!maxed ? `<div class="card-costs">${villagerTag}${costTags}</div>` : ''}
              <div class="card-actions">
                <button class="action-btn" id="build-btn-${type}"
                  ${(!affordable || popLocked || maxed || inProgress || !hasEnoughVillagers) ? 'disabled' : ''}
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

        const vt = s.villagerTraining || { status: 'idle', elapsed: 0, duration: 25 };
        const isTraining = vt.status === 'training';
        const trainCost = this.getTrainVillagerCost();
        const atPopCap = totalPop >= s.populationCap;
        const canTrain = !isTraining && !atPopCap && s.resources.kai >= trainCost;
        const trainPct = isTraining ? Math.min(100, Math.round((vt.elapsed / vt.duration) * 100)) : 0;
        const trainRem = this.formatDuration(vt.duration - vt.elapsed);

        let trainBtnLabel = `🍠 Train New Villager (${trainCost} Kai · ${vt.duration}s)`;
        if (isTraining) trainBtnLabel = `⏳ Training Villager... (${trainRem})`;
        else if (atPopCap) trainBtnLabel = `Housing Cap Reached (${totalPop}/${s.populationCap}) — Build Whare/Cottages`;

        const explorerCount = s.jobs.explorer || 0;
        const scoutPct = Math.min(100, Math.round((s.whenuaProgress || 0) * 100));
        const buildSpeedBonusPct = Math.round((this.getBuildSpeedMultiplier() - 1) * 100);
        const busyBuilders = this.getBusyBuilderVillagers();

        let html = `
          <div class="section-label">
            <span>Kāinga Town Center — Recruit Tangata</span>
            <span>Pop: ${totalPop} / ${s.populationCap}</span>
          </div>
          <div class="game-card chapter1-card" id="card-train-villager">
            <div class="card-top">
              <div class="card-title-group">
                <div class="card-icon">👥</div>
                <div>
                  <div class="card-title">Train New Villager (Tangata)</div>
                  <div class="card-subtitle" id="villager-train-sub">
                    ${isTraining ? `Training in progress — ${trainPct}% (${trainRem} remaining)` : 'Population only increases when you train villagers with Kai'}
                  </div>
                </div>
              </div>
              <span class="card-badge">${totalPop} / ${s.populationCap}</span>
            </div>
            <div class="card-desc">
              Spend <strong>Kai</strong> to recruit a new villager (+<strong>1 Population</strong>) at the Kāinga to assign as a <strong>Villager</strong>, <strong>Hunter</strong>, <strong>Lumberjack</strong>, or <strong>Explorer</strong>. Each villager above 6 consumes <strong>0.025 Kai/s</strong>.
            </div>
            <div class="card-costs">
              <span class="cost-tag ${s.resources.kai >= trainCost ? 'affordable' : 'unaffordable'}">${trainCost} Kai</span>
              ${buildSpeedBonusPct > 0 ? `<span class="cost-tag affordable">⚡ +${buildSpeedBonusPct}% Build Speed</span>` : ''}
            </div>
            <div class="timer-bar-wrap">
              <div class="timer-bar-fill" id="villager-train-bar" style="width:${trainPct}%"></div>
            </div>
            <div class="card-actions">
              <button class="action-btn ${canTrain ? 'ready-harvest' : ''}" id="villager-train-btn"
                ${canTrain ? '' : 'disabled'}
                onclick="Game.startTrainVillager()">${trainBtnLabel}</button>
            </div>
          </div>

          <div class="section-label">
            <span>Assign Roles (Age of Empires Style)</span>
            <span style="color:var(--accent-pounamu-bright);">${unassigned} Idle / ${totalPop} Total</span>
          </div>
        `;

        for (const j of JOB_DEFS) {
          if (j.era > s.chapter) continue;
          const count = s.jobs[j.id] || 0;
          const slotCap = this.getJobCap(j.id);
          const eraClass = j.era === 1 ? 'chapter1-card' : (j.era === 2 ? 'chapter2-card' : 'chapter2b-card');
          const hexColor = '#' + (j.unitColor || 0xe8b948).toString(16).padStart(6, '0');
          const minLocked = j.id === 'gardener' ? busyBuilders : 0;

          html += `
            <div class="game-card ${eraClass}" id="card-job-${j.id}">
              <div class="card-top">
                <div class="card-title-group">
                  <div class="card-icon" style="border: 1.5px solid ${hexColor};">${j.icon}</div>
                  <div>
                    <div class="card-title">${j.name}</div>
                    <div class="card-subtitle">${j.id === 'gardener' && busyBuilders > 0 ? `<span style="color:var(--accent-kowhai); font-weight:700;">🔨 ${busyBuilders}/${count} Busy Building (Locked)</span>` : 'Assigned Role'}</div>
                  </div>
                </div>
                <div class="job-stepper">
                  <button class="step-btn" ${count <= minLocked ? 'disabled' : ''} title="${count <= minLocked && minLocked > 0 ? `${minLocked} Villagers are currently busy constructing buildings` : ''}" onclick="Game.adjustJob('${j.id}', -1)">−</button>
                  <span class="job-count" style="min-width:38px; text-align:center;">${count}/${slotCap}</span>
                  <button class="step-btn" ${(unassigned <= 0 || count >= slotCap) ? 'disabled' : ''} onclick="Game.adjustJob('${j.id}', 1)">＋</button>
                </div>
              </div>
              <div class="card-desc">${j.desc}</div>
              ${j.id === 'explorer' ? `
                <div style="margin-top:6px;">
                  <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-muted); margin-bottom:3px;">
                    <span>🧭 Explorer Scouting Progress</span>
                    <span id="explorer-scout-lbl">${scoutPct}% toward next Whenua tile ${explorerCount > 0 ? `(-${Math.round(this.getExplorerDiscount()*100)}% Survey Cost)` : '(Assign an Explorer to scout)'}</span>
                  </div>
                  <div class="timer-bar-wrap" style="margin:0;">
                    <div class="timer-bar-fill" id="explorer-scout-bar" style="width:${scoutPct}%"></div>
                  </div>
                </div>
              ` : ''}
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
            <div class="game-card ${done ? 'chapter1-card' : ''}" id="card-milestone-${m.id}" style="opacity:${done ? '1' : '0.78'}">
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
