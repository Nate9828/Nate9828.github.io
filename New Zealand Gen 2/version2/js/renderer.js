// =========================================================================
// ISOMETRIC PIXI.JS SCENE RENDERER & VISUAL EFFECTS
// =========================================================================

const GameRenderer = {
      isoToScreen(col, row, elev = 0) {
        const sx = (col - row) * (TILE_W / 2);
        const sy = (col + row) * (TILE_H / 2) - elev * ELEV_SCALE;
        return { x: sx, y: sy };
      },

      screenToIso(screenX, screenY) {
        // Transform from canvas coords into worldContainer local coords
        const wx = (screenX - this.worldContainer.x) / this.camZoom;
        const wy = (screenY - this.worldContainer.y) / this.camZoom;
        // Approximate inverse ignoring elevation first, then refine by checking tiles
        let bestTile = null;
        let bestDist = 9999;
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const t = this.grid[r][c];
            const pos = this.isoToScreen(c, r, t.revealed ? t.elevation : 0);
            const dx = (wx - pos.x) / (TILE_W * 0.5);
            const dy = (wy - pos.y) / (TILE_H * 0.5);
            const d = Math.abs(dx) + Math.abs(dy);
            if (d < bestDist && d <= 1.25) {
              bestDist = d;
              bestTile = t;
            }
          }
        }
        return bestTile;
      },

      initPixiScene() {
        const container = document.getElementById('pixi-canvas-container');
        const rect = container.getBoundingClientRect();
        const w = Math.max(600, rect.width || 900);
        const h = Math.max(450, rect.height || 650);

        this.app = new PIXI.Application({
          width: w,
          height: h,
          backgroundColor: 0x152c38,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true
        });
        container.innerHTML = '';
        container.appendChild(this.app.view);

        this.worldContainer = new PIXI.Container();
        this.waterLayer = new PIXI.Graphics();
        this.terrainLayer = new PIXI.Container();
        this.terrainLayer.sortableChildren = true;
        this.objectLayer = new PIXI.Container();
        this.objectLayer.sortableChildren = true;
        this.fxLayer = new PIXI.Graphics();
        this.skyOverlay = new PIXI.Graphics();

        this.worldContainer.addChild(this.waterLayer);
        this.worldContainer.addChild(this.terrainLayer);
        this.worldContainer.addChild(this.objectLayer);
        this.worldContainer.addChild(this.fxLayer);
        this.app.stage.addChild(this.worldContainer);
        this.app.stage.addChild(this.skyOverlay);

        this.resetCamera();
        this.bindCanvasInteractions();

        // Spawn pool of animated unit sprites (up to 28 visible on map)
        for (let i = 0; i < 28; i++) {
          this.villagerSprites.push({
            col: 8 + (Math.random() - 0.5) * 2.5,
            row: 15 + (Math.random() - 0.5) * 2.5,
            targetCol: 8 + Math.random() * 3,
            targetRow: 14 + Math.random() * 2,
            speed: 0.42 + Math.random() * 0.28,
            role: 'idle',
            color: 0xe8b948
          });
        }

        // Main 60fps Game & Render Ticker
        this.app.ticker.add((delta) => {
          const dtSec = (delta / 60) * this.speedMultiplier;
          this.waveTime += delta * 0.035;
          this.tickSimulation(dtSec);
          this.renderDynamicFX(delta / 60);

          this.uiRefreshAccum += delta / 60;
          if (this.uiRefreshAccum >= 0.25) {
            this.uiRefreshAccum = 0;
            this.renderUI(false);
          }

          this.autosaveAccum += delta / 60;
          if (this.autosaveAccum >= 5.0) {
            this.autosaveAccum = 0;
            this.saveState(false);
          }
        });
      },

      onResize() {
        if (!this.app) return;
        const container = document.getElementById('pixi-canvas-container');
        const rect = container.getBoundingClientRect();
        if (rect.width > 50 && rect.height > 50) {
          this.app.renderer.resize(rect.width, rect.height);
          this.resetCamera();
        }
      },

      resetCamera() {
        if (!this.app) return;
        this.camZoom = 1.08;
        this.camX = this.app.renderer.width * 0.55;
        this.camY = this.app.renderer.height * 0.12;
        this.applyCameraTransform();
      },

      zoomCamera(factor) {
        this.camZoom = Math.max(0.55, Math.min(2.1, this.camZoom * factor));
        this.applyCameraTransform();
      },

      applyCameraTransform() {
        if (!this.worldContainer) return;
        this.worldContainer.x = this.camX;
        this.worldContainer.y = this.camY;
        this.worldContainer.scale.set(this.camZoom, this.camZoom);
      },

      bindCanvasInteractions() {
        const view = this.app.view;

        view.addEventListener('pointerdown', (e) => {
          this.isDragging = true;
          this.dragStartX = e.clientX - this.camX;
          this.dragStartY = e.clientY - this.camY;
        });

        window.addEventListener('pointerup', () => {
          this.isDragging = false;
        });

        view.addEventListener('pointermove', (e) => {
          const rect = view.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;

          if (this.isDragging) {
            this.camX = e.clientX - this.dragStartX;
            this.camY = e.clientY - this.dragStartY;
            this.applyCameraTransform();
            return;
          }

          const tile = this.screenToIso(sx, sy);
          if (tile !== this.hoveredTile) {
            this.hoveredTile = tile;
            this.updateTileInspector(tile);
          }
        });

        view.addEventListener('wheel', (e) => {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.1 : 0.9;
          this.zoomCamera(factor);
        }, { passive: false });
      },

      updateTileInspector(tile) {
        const nameEl = document.getElementById('ti-name');
        const coordEl = document.getElementById('ti-coords');
        const descEl = document.getElementById('ti-desc');
        if (!tile) {
          nameEl.textContent = 'Te Moana-nui-a-Kiwa';
          coordEl.textContent = 'Open Ocean';
          descEl.textContent = 'Drag to pan the peninsula or scroll to zoom in on your kāinga and township.';
          return;
        }

        coordEl.textContent = `Grid (${tile.col}, ${tile.row}) • Elev ${tile.elevation}m`;

        if (!tile.revealed) {
          nameEl.textContent = '☁️ Te Ao Kapua (Unclaimed Wilderness)';
          descEl.textContent = 'Expand your Whenua via Explorers (Kaitūhura), Milestones, or Survey Expeditions to reveal this land.';
          return;
        }

        if (tile.buildingId) {
          const b = this.state.buildings.find(x => x.id === tile.buildingId);
          const def = b ? BUILDING_DEFS[b.type] : null;
          if (def) {
            nameEl.textContent = `${def.icon} ${def.name}`;
            descEl.textContent = b.status === 'building'
              ? `Under Construction (${Math.floor((b.elapsed / b.duration) * 100)}%) — ${def.desc}`
              : def.desc;
            return;
          }
        }

        const terrainNames = {
          deep_water: ['🌊 Deep Harbour Water', 'Deep coastal channel where ocean-going waka and trading ships navigate.'],
          shallow_water: ['🐚 Tātahi (Shallow Bay)', 'Rich coastal waters teeming with kahawai, tāmure (snapper), and shellfish.'],
          sand: ['🏖️ Oneone (Sandy Beach)', 'Sheltered coastal landing beach ideal for Waka Ama moorings and wharves.'],
          grass: ['🌿 Mania (Coastal Lowland)', 'Fertile sun-warmed earth ready for Whare, Māra Kūmara, Cottages, or Farms.'],
          forest: ['🌲 Te Ngahere (Native Bush)', 'Ancient kauri, tōtara, and mamaku tree ferns providing Rākau timber.'],
          hill: ['⛰️ Pukepuke (Elevated Ridge)', 'Commanding headland and ridge overlooking the bay — ideal for the Pā or Skyline.'],
          road: ['🛤️ Township Coach Road', 'Gravel and cobblestone thoroughfare linking the harbour and settlement.'],
          farmland: ['🌾 Golden Pasture', 'Cultivated paddock supporting sheep and crop production.'],
          town_floor: ['🧱 Civic Quarter', 'Prepared foundation supporting township commerce and homes.']
        };
        const info = terrainNames[tile.type] || ['Whenua', 'Revealed land tile'];
        nameEl.textContent = info[0];
        descEl.textContent = info[1];
      },

      // =======================================================================
      // DRAWING THE ISOMETRIC TILES & STORYBOOK BUILDINGS
      // =======================================================================
      rebuildTerrainAndObjects() {
        if (!this.terrainLayer || !this.objectLayer) return;
        this.terrainLayer.removeChildren();
        this.objectLayer.removeChildren();

        const hw = TILE_W / 2;
        const hh = TILE_H / 2;

        const palette = {
          deep_water: { top: 0x1b4d63, left: 0x143b4d, right: 0x102f3d, stroke: 0x225c75 },
          shallow_water: { top: 0x2d7b8f, left: 0x226070, right: 0x1c4f5c, stroke: 0x3c91a6 },
          sand: { top: 0xdcc48e, left: 0xbfa670, right: 0xa68e5b, stroke: 0xe6d2a2 },
          grass: { top: 0x5c9652, left: 0x47783f, right: 0x3a6333, stroke: 0x6ba860 },
          forest: { top: 0x3d7344, left: 0x2f5c35, right: 0x244729, stroke: 0x4b8553 },
          hill: { top: 0x738c54, left: 0x5c6e46, right: 0x4a5938, stroke: 0x86a164 },
          road: { top: 0x9e927f, left: 0x7d7363, right: 0x665d50, stroke: 0xb5a894 },
          farmland: { top: 0x9ab054, left: 0x7a8c41, right: 0x627033, stroke: 0xadc462 },
          town_floor: { top: 0x8b867a, left: 0x6e695f, right: 0x57534b, stroke: 0xa19b8e },
          fog: { top: 0x293d47, left: 0x1f3038, right: 0x19272e, stroke: 0x354d59 }
        };

        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const tile = this.grid[r][c];
            const g = new PIXI.Graphics();
            const elev = tile.revealed ? tile.elevation : 0.15;
            const pos = this.isoToScreen(c, r, elev);
            g.x = pos.x;
            g.y = pos.y;
            g.zIndex = (r + c) * 10;

            const colors = tile.revealed ? (palette[tile.type] || palette.grass) : palette.fog;
            const skirtH = Math.max(4, elev * ELEV_SCALE + 5);

            // Left elevation skirt
            g.beginFill(colors.left);
            g.drawPolygon([-hw, 0, 0, hh, 0, hh + skirtH, -hw, skirtH]);
            g.endFill();

            // Right elevation skirt
            g.beginFill(colors.right);
            g.drawPolygon([0, hh, hw, 0, hw, skirtH, 0, hh + skirtH]);
            g.endFill();

            // Top diamond face
            g.lineStyle(1, colors.stroke, 0.55);
            g.beginFill(colors.top);
            g.drawPolygon([0, -hh, hw, 0, 0, hh, -hw, 0]);
            g.endFill();

            // Subtle shoreline foam or farmland furrows
            if (tile.revealed && tile.type === 'farmland') {
              g.lineStyle(1, 0xd8c86a, 0.6);
              g.moveTo(-10, -2); g.lineTo(0, -7);
              g.moveTo(-4, 2); g.lineTo(8, -4);
              g.moveTo(2, 6); g.lineTo(12, 0);
            } else if (tile.revealed && tile.type === 'road') {
              g.lineStyle(1.5, 0xc7bba6, 0.65);
              g.moveTo(-10, -5); g.lineTo(10, 5);
              g.moveTo(-10, 5); g.lineTo(10, -5);
            } else if (!tile.revealed && (r + c) % 3 === 0) {
              // Subtle atmospheric cloud wisps on every 3rd unrevealed tile
              g.lineStyle(0);
              g.beginFill(0x4a6b78, 0.22);
              g.drawEllipse(0, -2, 13, 5);
              g.endFill();
            }

            this.terrainLayer.addChild(g);

            // Add trees on unoccupied forest tiles or buildings on occupied tiles
            if (tile.revealed) {
              if (tile.buildingId) {
                const b = this.state.buildings.find(x => x.id === tile.buildingId);
                if (b) {
                  const objG = this.drawBuildingSprite(b, pos.x, pos.y, (r + c) * 10 + 5);
                  this.objectLayer.addChild(objG);
                }
              } else if (tile.type === 'forest') {
                const treeG = this.drawNativeTree(pos.x, pos.y, (r + c) * 10 + 4, (r * 7 + c * 13) % 3);
                this.objectLayer.addChild(treeG);
              }
            }
          }
        }

        // Always draw the Founding Waka Hourua moored in the sheltered bay at (6, 17)
        const wakaPos = this.isoToScreen(6.5, 17.2, 0);
        const wakaG = this.drawFoundingWaka(wakaPos.x, wakaPos.y, (17 + 6) * 10 + 6);
        this.objectLayer.addChild(wakaG);
      },

      drawNativeTree(x, y, z, variant) {
        const g = new PIXI.Graphics();
        g.x = x;
        g.y = y;
        g.zIndex = z;
        // Trunk
        g.beginFill(0x5c4028);
        g.drawRect(-2, -12, 4, 12);
        g.endFill();
        if (variant === 0) {
          // Kauri / Tōtara crown
          g.beginFill(0x275932);
          g.drawCircle(0, -18, 9);
          g.beginFill(0x3a7d47);
          g.drawCircle(-3, -21, 7);
          g.drawCircle(4, -19, 6);
          g.endFill();
        } else if (variant === 1) {
          // Rimu / Pōhutukawa coastal canopy
          g.beginFill(0x2f6939);
          g.drawEllipse(0, -16, 10, 7);
          g.beginFill(0xc84b31, 0.75); // Red pōhutukawa blossoms
          g.drawCircle(-4, -18, 2.5);
          g.drawCircle(3, -17, 2);
          g.endFill();
        } else {
          // Mamaku / Ponga Silver Fern
          g.lineStyle(2, 0x4f9458, 1);
          g.moveTo(0, -10); g.lineTo(-9, -17);
          g.moveTo(0, -10); g.lineTo(9, -17);
          g.moveTo(0, -11); g.lineTo(-6, -21);
          g.moveTo(0, -11); g.lineTo(6, -21);
        }
        return g;
      },

      drawFoundingWaka(x, y, z) {
        const g = new PIXI.Graphics();
        g.x = x;
        g.y = y;
        g.zIndex = z;
        // Double hull waka hourua
        g.beginFill(0x7a4928);
        g.drawPolygon([-18, 2, 16, -6, 22, -2, -12, 6]);
        g.endFill();
        g.beginFill(0x965b33);
        g.drawPolygon([-15, -3, 14, -10, 18, -7, -10, 0]);
        g.endFill();
        // Carved stern post (Taurapa)
        g.lineStyle(2, 0xb86f3d, 1);
        g.moveTo(-16, 1); g.lineTo(-20, -13);
        // Woven triangular Rā (sail)
        g.lineStyle(1.5, 0xdcc48e, 1);
        g.beginFill(0xebd8ab, 0.92);
        g.drawPolygon([0, -5, -4, -28, 13, -18]);
        g.endFill();
        return g;
      },

      drawBuildingSprite(b, x, y, z) {
        const g = new PIXI.Graphics();
        g.x = x;
        g.y = y;
        g.zIndex = z;

        if (b.status === 'building') {
          // Timber scaffolding visual during construction (progress bar is drawn live at 60fps in renderDynamicFX)
          g.lineStyle(1.5, 0xd4a359, 0.9);
          g.beginFill(0x8c673a, 0.45);
          g.drawRect(-12, -16, 24, 16);
          g.endFill();
          g.moveTo(-12, -16); g.lineTo(12, 0);
          g.moveTo(12, -16); g.lineTo(-12, 0);
          return g;
        }

        const t = b.type;
        if (t === 'whare') {
          // Wharepuni: warm thatch walls, pitched roof, carved red-ochre maihi (bargeboards) & tekoteko
          g.beginFill(0x8c6d46);
          g.drawPolygon([-11, 0, 0, 6, 11, 0, 11, -11, 0, -5, -11, -11]);
          g.endFill();
          // Roof
          g.beginFill(0x694e2f);
          g.drawPolygon([-14, -10, 0, -21, 14, -10, 0, -3]);
          g.endFill();
          // Carved red ochre maihi & tekoteko finial
          g.lineStyle(2, 0xb83e2c, 1);
          g.moveTo(-13, -9); g.lineTo(0, -21); g.lineTo(13, -9);
          g.moveTo(0, -21); g.lineTo(0, -26);
          // Warm glowing doorway
          g.lineStyle(0);
          g.beginFill(0xffb74d, 0.9);
          g.drawRect(-2, -6, 5, 6);
          g.endFill();
        } else if (t === 'mara_kumara') {
          // Mounded kūmara garden rows with leafy green vines (and golden glow when ready)
          const ready = this.state.activeTasks.kumara.status === 'ready';
          const positions = [[-8, -2], [0, -6], [8, -2], [-4, 2], [4, 2]];
          for (const [px, py] of positions) {
            g.beginFill(0x6e4e2e);
            g.drawEllipse(px, py, 5, 3);
            g.beginFill(ready ? 0xe8b948 : 0x4ca64c);
            g.drawCircle(px, py - 2, 3.2);
            g.endFill();
          }
        } else if (t === 'waka_ama') {
          // Coastal drying rack & outrigger canoe
          g.lineStyle(1.5, 0x8c6239, 1);
          g.moveTo(-10, 0); g.lineTo(-10, -12);
          g.moveTo(2, 0); g.lineTo(2, -12);
          g.moveTo(-11, -10); g.lineTo(3, -10);
          // Outrigger hull
          g.lineStyle(0);
          g.beginFill(0xa65e2e);
          g.drawPolygon([-6, 4, 14, -2, 16, 1, -4, 7]);
          g.endFill();
        } else if (t === 'rua_kumara') {
          // Earth-banked hillside storehouse with red-ochre carved door
          g.beginFill(0x4f7d44);
          g.drawEllipse(0, -4, 13, 8);
          g.beginFill(0x9e3625);
          g.drawRect(-4, -9, 8, 9);
          g.endFill();
        } else if (t === 'pa_headland') {
          // Fortified Headland Pā with timber palisade fence, watchtower & wharenui
          g.lineStyle(1.5, 0x735131, 1);
          for (let px = -16; px <= 16; px += 4) {
            g.moveTo(px, 4); g.lineTo(px, -10);
          }
          // Central Wharenui on summit
          g.lineStyle(0);
          g.beginFill(0x825936);
          g.drawRect(-9, -16, 18, 12);
          g.beginFill(0xb03a28);
          g.drawPolygon([-12, -15, 0, -26, 12, -15]);
          g.endFill();
          // Tekoteko
          g.lineStyle(2, 0xe8b948, 1);
          g.moveTo(0, -26); g.lineTo(0, -32);
        } else if (t === 'wharf_port') {
          // Timber pier & moored trade vessel
          g.beginFill(0x785638);
          g.drawPolygon([-16, -2, 12, -10, 18, -5, -10, 4]);
          g.endFill();
          // Wooden pilings
          g.lineStyle(2, 0x4a331f, 1);
          g.moveTo(-12, 2); g.lineTo(-12, 9);
          g.moveTo(0, -1); g.lineTo(0, 6);
          g.moveTo(12, -5); g.lineTo(12, 2);
          // Cargo crates
          g.lineStyle(0);
          g.beginFill(0xc99650);
          g.drawRect(-6, -8, 6, 5);
          g.endFill();
        } else if (t === 'trading_post') {
          // Colonial weatherboard trading post with verandah
          g.beginFill(0xd9ccb4);
          g.drawRect(-12, -15, 24, 14);
          g.beginFill(0x3b5c78);
          g.drawPolygon([-15, -15, 0, -25, 15, -15]);
          g.endFill();
          // Signboard
          g.beginFill(0xe8b948);
          g.drawRect(-7, -13, 14, 3);
          g.endFill();
        } else if (t === 'settler_cottage') {
          // Charming cream weatherboard cottage with red iron roof & brick chimney
          g.beginFill(0xebe3d2);
          g.drawRect(-9, -12, 18, 11);
          g.beginFill(0x9e3f33);
          g.drawPolygon([-11, -12, 0, -20, 11, -12]);
          g.beginFill(0x80352a);
          g.drawRect(5, -21, 3, 6);
          g.endFill();
        } else if (t === 'town_road') {
          // Streetlamp post on road
          g.lineStyle(1.5, 0x2c3a40, 1);
          g.moveTo(0, 0); g.lineTo(0, -12);
          g.lineStyle(0);
          g.beginFill(0xffe082, 0.9);
          g.drawCircle(0, -13, 2.5);
          g.endFill();
        } else if (t === 'pastoral_farm') {
          // Red barn + grazing white sheep dots
          g.beginFill(0x9c3d30);
          g.drawRect(-10, -12, 12, 9);
          g.beginFill(0x6e281f);
          g.drawPolygon([-12, -12, -4, -18, 4, -12]);
          g.beginFill(0xf7f5eb);
          g.drawCircle(6, -2, 2.5);
          g.drawCircle(11, 1, 2.5);
          g.drawCircle(3, 3, 2.2);
          g.endFill();
        } else if (t === 'timber_mill') {
          // Workshop with tall brick chimney & waterwheel
          g.beginFill(0x826142);
          g.drawRect(-12, -14, 20, 13);
          g.beginFill(0x4c5d69);
          g.drawPolygon([-14, -14, -2, -22, 10, -14]);
          // Chimney
          g.beginFill(0x7a3b2e);
          g.drawRect(7, -26, 4, 18);
          g.endFill();
        } else if (t === 'town_hall') {
          // Civic Town Hall with tall clocktower
          g.beginFill(0xd4c8b4);
          g.drawRect(-14, -18, 28, 17);
          g.beginFill(0x425b73);
          g.drawPolygon([-16, -18, 0, -27, 16, -18]);
          // Clocktower
          g.beginFill(0xe0d5c3);
          g.drawRect(-5, -36, 10, 20);
          g.beginFill(0x2c4257);
          g.drawPolygon([-7, -36, 0, -45, 7, -36]);
          g.beginFill(0xffe082);
          g.drawCircle(0, -30, 3);
          g.endFill();
        } else if (t === 'high_street_shops') {
          // Two-storey brick high street facades with colourful awnings
          g.beginFill(0xa85542);
          g.drawRect(-12, -20, 11, 19);
          g.beginFill(0x6b8299);
          g.drawRect(0, -17, 12, 16);
          g.beginFill(0xe8b948);
          g.drawRect(-12, -9, 24, 3);
          g.endFill();
        } else if (t === 'modern_skyline') {
          // Sleek modern glass towers + observation spire (Sky Tower / Civic Horizon homage)
          g.beginFill(0x3d6685);
          g.drawRect(-14, -38, 11, 36);
          g.beginFill(0x5288ad);
          g.drawRect(1, -30, 11, 28);
          // Observation tower spire
          g.beginFill(0xdbe4eb);
          g.drawRect(-3, -52, 4, 50);
          g.beginFill(0x52c7a1);
          g.drawEllipse(-1, -44, 7, 3.5);
          g.lineStyle(1.5, 0xe8b948, 1);
          g.moveTo(-1, -52); g.lineTo(-1, -62);
          g.endFill();
        }

        return g;
      },

      // =======================================================================
      // DYNAMIC FX: OCEAN WAVES, TURNING POINT SHIP, AOE ROLE UNITS, SMOKE
      // =======================================================================
      spawnSparkles(x, y, color = 0xe8b948, count = 10) {
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = 0.6 + Math.random() * 1.8;
          this.particles.push({
            x,
            y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 0.8,
            life: 1.0,
            color,
            size: 2 + Math.random() * 2.5
          });
        }
      },

      pickTargetTileForRole(role) {
        const matchingTiles = [];
        const activeBuild = this.state.buildings.find(b => b.status === 'building');

        if (role === 'gardener' && activeBuild && Math.random() < 0.6) {
          return { col: activeBuild.col + (Math.random() - 0.5) * 0.6, row: activeBuild.row + (Math.random() - 0.5) * 0.6 };
        }

        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const t = this.grid[r][c];
            if (!t.revealed || !t.isLand) continue;

            if (role === 'forester' && (t.type === 'forest' || t.buildingType === 'timber_mill' || t.buildingType === 'rua_kumara')) {
              matchingTiles.push(t);
            } else if (role === 'hunter' && (t.type === 'sand' || t.type === 'hill' || t.buildingType === 'waka_ama')) {
              matchingTiles.push(t);
            } else if (role === 'explorer') {
              // Check if adjacent to unrevealed land (fog edge)
              const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
              const nearFog = dirs.some(([dr, dc]) => {
                const nt = this.grid[r + dr] && this.grid[r + dr][c + dc];
                return nt && nt.isLand && !nt.revealed;
              });
              if (nearFog) matchingTiles.push(t);
            } else if (role === 'gardener' && (t.buildingType === 'mara_kumara' || t.buildingType === 'whare')) {
              matchingTiles.push(t);
            } else if (role === 'merchant' && (t.buildingType === 'wharf_port' || t.buildingType === 'trading_post' || t.type === 'road')) {
              matchingTiles.push(t);
            } else if (role === 'pastoralist' && (t.type === 'farmland' || t.buildingType === 'pastoral_farm')) {
              matchingTiles.push(t);
            } else if (role === 'artisan' && (t.type === 'town_floor' || t.buildingType === 'timber_mill')) {
              matchingTiles.push(t);
            }
          }
        }

        if (matchingTiles.length > 0) {
          const pick = matchingTiles[Math.floor(Math.random() * matchingTiles.length)];
          return { col: pick.col + (Math.random() - 0.5) * 0.5, row: pick.row + (Math.random() - 0.5) * 0.5 };
        }
        return { col: 8 + (Math.random() - 0.5) * 3, row: 15 + (Math.random() - 0.5) * 2 };
      },

      renderDynamicFX(dt) {
        if (!this.fxLayer || !this.waterLayer) return;
        this.fxLayer.clear();

        // 1. Gentle animated coastal waves in the bay
        for (let i = 0; i < 9; i++) {
          const col = 3 + (i * 1.3);
          const row = 17.5 + Math.sin(i * 1.1) * 1.8;
          const pos = this.isoToScreen(col, row, 0);
          const waveOffset = Math.sin(this.waveTime + i) * 4;
          this.fxLayer.lineStyle(1.5, 0x8cd3e6, 0.35 + 0.2 * Math.sin(this.waveTime + i));
          this.fxLayer.moveTo(pos.x - 10 + waveOffset, pos.y);
          this.fxLayer.lineTo(pos.x + 10 + waveOffset, pos.y - 3);
        }

        // 2. Cooking fire smoke rising gently from Whare, Cottages & Mills + Live 60fps Construction Progress Bars
        for (const b of this.state.buildings) {
          if (b.status === 'building') {
            const t = this.grid[b.row] && this.grid[b.row][b.col];
            if (t) {
              const pos = this.isoToScreen(b.col, b.row, t.elevation);
              const pct = Math.max(0, Math.min(1, b.elapsed / Math.max(1, b.duration)));
              const barW = 32;
              const barH = 6;
              const bx = pos.x - barW / 2;
              const by = pos.y - 26;

              // Outer track matching .timer-bar-wrap
              this.fxLayer.lineStyle(1, 0xd4b27c, 0.55);
              this.fxLayer.beginFill(0x0a1418, 0.82);
              this.fxLayer.drawRoundedRect(bx, by, barW, barH, 3);
              this.fxLayer.endFill();

              // Inner fill matching .timer-bar-fill (#52c7a1 -> #e8b948)
              if (pct > 0.01) {
                const fillW = Math.max(3, barW * pct);
                this.fxLayer.lineStyle(0);
                this.fxLayer.beginFill(0x52c7a1, 1);
                this.fxLayer.drawRoundedRect(bx, by, fillW, barH, 3);
                if (fillW > 8) {
                  this.fxLayer.beginFill(0xe8b948, 0.85);
                  this.fxLayer.drawRoundedRect(bx + fillW * 0.45, by, fillW * 0.55, barH, 3);
                }
                this.fxLayer.endFill();
              }
            }
          } else if (b.status === 'complete' && ['whare', 'settler_cottage', 'timber_mill'].includes(b.type)) {
            if (Math.random() < 0.08) {
              const t = this.grid[b.row][b.col];
              const pos = this.isoToScreen(b.col, b.row, t.elevation);
              this.particles.push({
                x: pos.x + (Math.random() - 0.5) * 4,
                y: pos.y - 20,
                vx: 0.15 + Math.random() * 0.15,
                vy: -0.45 - Math.random() * 0.25,
                life: 1.0,
                color: 0xdbe6e8,
                size: 2.8
              });
            }
          }
        }

        // 3. Draw & update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= dt * 0.85;
          if (p.life <= 0) {
            this.particles.splice(i, 1);
            continue;
          }
          this.fxLayer.lineStyle(0);
          this.fxLayer.beginFill(p.color, Math.max(0, p.life * 0.8));
          this.fxLayer.drawCircle(p.x, p.y, p.size * p.life);
          this.fxLayer.endFill();
        }

        // 4. AoE Role-Driven Units moving across revealed land tiles
        const roleList = [];
        for (const j of JOB_DEFS) {
          const c = this.state.jobs[j.id] || 0;
          for (let k = 0; k < c; k++) {
            roleList.push({ role: j.id, color: j.unitColor || 0xe8b948 });
          }
        }
        const totalPop = Math.floor(this.state.population);
        while (roleList.length < totalPop) {
          roleList.push({ role: 'idle', color: 0xb8c4c2 });
        }

        const visibleUnits = Math.min(this.villagerSprites.length, roleList.length);
        for (let i = 0; i < visibleUnits; i++) {
          const v = this.villagerSprites[i];
          const assigned = roleList[i];
          if (v.role !== assigned.role) {
            v.role = assigned.role;
            v.color = assigned.color;
            const tgt = this.pickTargetTileForRole(v.role);
            v.targetCol = tgt.col;
            v.targetRow = tgt.row;
          }

          const dx = v.targetCol - v.col;
          const dy = v.targetRow - v.row;
          const dist = Math.hypot(dx, dy);
          if (dist < 0.25) {
            // Alternate between role work site and Kāinga/Town center dropoff
            if (Math.random() < 0.35) {
              v.targetCol = 8 + (Math.random() - 0.5) * 2;
              v.targetRow = 15 + (Math.random() - 0.5) * 2;
            } else {
              const tgt = this.pickTargetTileForRole(v.role);
              v.targetCol = tgt.col;
              v.targetRow = tgt.row;
            }
          } else {
            v.col += (dx / dist) * v.speed * dt;
            v.row += (dy / dist) * v.speed * dt;
          }

          const rIdx = Math.min(GRID_SIZE - 1, Math.max(0, Math.round(v.row)));
          const cIdx = Math.min(GRID_SIZE - 1, Math.max(0, Math.round(v.col)));
          const tile = this.grid[rIdx][cIdx];
          if (tile && tile.revealed && tile.isLand) {
            const pos = this.isoToScreen(v.col, v.row, tile.elevation);
            if (v.role === 'explorer') {
              // Subtle pounamu scouting ring beneath Explorer units
              this.fxLayer.lineStyle(1, 0x52c7a1, 0.7);
              this.fxLayer.drawCircle(pos.x, pos.y - 3, 4.5);
              this.fxLayer.lineStyle(0);
            }
            this.fxLayer.beginFill(v.color, 0.96);
            this.fxLayer.drawCircle(pos.x, pos.y - 5, 2.8);
            this.fxLayer.beginFill(0xf6efe2, 0.96);
            this.fxLayer.drawCircle(pos.x, pos.y - 9, 1.9);
            this.fxLayer.endFill();
          }
        }

        // 5. Turning Point Tall Ship / Trade Ship on the Harbour
        if (this.state.turningPointTriggered) {
          const prog = this.state.turningPointComplete ? 1.0 : (this.state.turningPointProgress / 100);
          // Ship sails from outer horizon (2, 22) to harbour anchorage (10.5, 18.8)
          const shipCol = 2 + (10.5 - 2) * prog;
          const shipRow = 22 + (18.8 - 22) * prog;
          const bob = Math.sin(this.waveTime * 1.4) * 2;
          const shipPos = this.isoToScreen(shipCol, shipRow, 0);
          const sx = shipPos.x;
          const sy = shipPos.y + bob;

          // Tall-masted European sailing ship
          this.fxLayer.lineStyle(0);
          this.fxLayer.beginFill(0x4a2f1b, 1);
          this.fxLayer.drawPolygon([sx - 18, sy, sx + 16, sy - 5, sx + 22, sy + 2, sx - 12, sy + 7]);
          this.fxLayer.endFill();
          // Masts & white square sails
          this.fxLayer.lineStyle(1.5, 0x8c6239, 1);
          this.fxLayer.moveTo(sx - 4, sy + 2); this.fxLayer.lineTo(sx - 4, sy - 28);
          this.fxLayer.moveTo(sx + 7, sy - 1); this.fxLayer.lineTo(sx + 7, sy - 24);
          this.fxLayer.lineStyle(1, 0xd9ccb4, 1);
          this.fxLayer.beginFill(0xf7f2e6, 0.95);
          this.fxLayer.drawRect(sx - 11, sy - 25, 13, 10);
          this.fxLayer.drawRect(sx - 10, sy - 13, 12, 8);
          this.fxLayer.drawRect(sx + 2, sy - 21, 11, 10);
          this.fxLayer.endFill();
        }

        // 6. Hover highlight diamond on hovered tile
        if (this.hoveredTile) {
          const t = this.hoveredTile;
          const pos = this.isoToScreen(t.col, t.row, t.revealed ? t.elevation : 0.15);
          const hw = TILE_W / 2;
          const hh = TILE_H / 2;
          this.fxLayer.lineStyle(2, 0xe8b948, 0.9);
          this.fxLayer.beginFill(0xe8b948, 0.15);
          this.fxLayer.drawPolygon([pos.x, pos.y - hh, pos.x + hw, pos.y, pos.x, pos.y + hh, pos.x - hw, pos.y]);
          this.fxLayer.endFill();
        }

        // 7. Day / Dusk / Starlight Sky Tint Overlay
        this.skyOverlay.clear();
        if (this.skyMode === 1) {
          // Golden Tōnga (Sunset)
          this.skyOverlay.beginFill(0xd96b27, 0.16);
          this.skyOverlay.drawRect(0, 0, this.app.renderer.width, this.app.renderer.height);
          this.skyOverlay.endFill();
        } else if (this.skyMode === 2) {
          // Matariki Starlight Night
          this.skyOverlay.beginFill(0x091626, 0.36);
          this.skyOverlay.drawRect(0, 0, this.app.renderer.width, this.app.renderer.height);
          this.skyOverlay.endFill();
        }
      },
};

window.GameRenderer = GameRenderer;
