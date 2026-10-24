    // =========================================================================
    // 2. ISOMETRIC MAP & LAND/WATER MASK DEFINITIONS (24x24 Grid)
    // =========================================================================
    const GRID_SIZE = 24;
    const TILE_W = 54;
    const TILE_H = 27;
    const ELEV_SCALE = 11;

    // Tile Types:
    // 'deep_water', 'shallow_water', 'sand', 'grass', 'forest', 'hill', 'road', 'farmland', 'town_floor'
    // Anchor landing coordinate for the founding Waka & Kāinga: (col: 8, row: 16)
    const LANDING_COL = 8;
    const LANDING_ROW = 16;

    function generatePeninsulaMap() {
      const grid = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        const rowArr = [];
        for (let c = 0; c < GRID_SIZE; c++) {
          // Create a natural coastal bay in SW (low col, high row) and a rising peninsula toward NE
          // Bay center around (5, 19)
          const distBay = Math.hypot((c - 5.2) * 1.05, (r - 19.2) * 0.95);
          // Outer ocean in SE/NW corners
          const distCenter = Math.hypot((c - 12.5) * 0.85, (r - 11.0) * 0.9);
          // Headland hill for Pā around (6, 10)
          const distPaHill = Math.hypot(c - 6.0, r - 10.0);
          // Upper civic ridge around (16, 6)
          const distRidge = Math.hypot(c - 16.5, r - 6.5);

          const waveNoise = Math.sin(c * 0.55 + r * 0.35) * 0.8 + Math.cos(c * 0.3 - r * 0.5) * 0.6;

          let type = 'deep_water';
          let elevation = 0;
          let isLand = false;

          // Determine water vs coast vs land
          if (distBay < 5.2 + waveNoise * 0.45 || r > 21 || c < 2 || (c < 5 && r > 14)) {
            if (distBay < 3.6 || r > 22 || c < 1) {
              type = 'deep_water';
              elevation = 0;
            } else {
              type = 'shallow_water';
              elevation = 0;
            }
          } else if (distCenter < 11.8 + waveNoise * 0.6) {
            isLand = true;
            // Check if near water -> sand beach
            if (distBay < 6.45 + waveNoise * 0.4 || r === 21 || c === 2) {
              type = 'sand';
              elevation = 0.25;
            } else if (distPaHill < 3.2) {
              type = 'hill';
              elevation = 2.2 + Math.max(0, (3.2 - distPaHill) * 0.65);
            } else if (distRidge < 3.6) {
              type = 'hill';
              elevation = 1.6 + Math.max(0, (3.6 - distRidge) * 0.5);
            } else {
              // Native forest vs lowland grass
              const forestFactor = Math.sin(c * 0.9 + r * 0.7) + Math.cos(c * 0.4 - r * 0.8);
              if (forestFactor > 0.35 && distBay > 8.2) {
                type = 'forest';
                elevation = 0.9 + (forestFactor * 0.25);
              } else {
                type = 'grass';
                elevation = 0.65 + Math.max(0, (12 - distBay) * 0.05);
              }
            }
          } else {
            type = distCenter < 13.0 ? 'shallow_water' : 'deep_water';
            elevation = 0;
          }

          // Compute reveal order distance from founding Kāinga landing spot (8, 16)
          const revealDist = Math.hypot(c - LANDING_COL, r - LANDING_ROW);

          rowArr.push({
            row: r,
            col: c,
            baseType: type,
            type: type,
            elevation: Number(elevation.toFixed(2)),
            isLand,
            revealDist,
            revealed: !isLand || revealDist <= 4.3, // Water always visible, initial coastal kāinga cluster revealed
            buildingId: null,
            buildingType: null,
            era: null
          });
        }
        grid.push(rowArr);
      }

      // Ensure specific key tiles have ideal terrain for founding settlement & harbor
      const forceTile = (c, r, t, elev) => {
        if (grid[r] && grid[r][c]) {
          grid[r][c].baseType = t;
          grid[r][c].type = t;
          grid[r][c].elevation = elev;
          grid[r][c].isLand = (t !== 'deep_water' && t !== 'shallow_water');
        }
      };

      // Founding Waka landing beach & bay
      forceTile(6, 17, 'shallow_water', 0);
      forceTile(7, 17, 'shallow_water', 0);
      forceTile(7, 16, 'sand', 0.25);
      forceTile(8, 16, 'sand', 0.3);
      forceTile(9, 16, 'sand', 0.3);
      forceTile(8, 15, 'grass', 0.65);
      forceTile(9, 15, 'grass', 0.7);
      forceTile(10, 15, 'grass', 0.75);
      forceTile(7, 14, 'grass', 0.8);
      forceTile(8, 14, 'grass', 0.8);
      forceTile(9, 14, 'grass', 0.85);
      forceTile(10, 14, 'forest', 0.95);
      forceTile(11, 14, 'forest', 1.0);
      // Pā Headland summit at (6, 10) & (6, 11)
      forceTile(6, 10, 'hill', 3.1);
      forceTile(6, 11, 'hill', 2.8);
      forceTile(7, 11, 'hill', 2.5);
      // Chapter 2 Deep Harbor Wharf site at (11, 18) -> (12, 17)
      forceTile(10, 18, 'shallow_water', 0);
      forceTile(11, 18, 'shallow_water', 0);
      forceTile(11, 17, 'sand', 0.3);
      forceTile(12, 17, 'sand', 0.35);
      forceTile(12, 16, 'grass', 0.75);
      forceTile(13, 16, 'grass', 0.8);

      return grid;
    }

    // =========================================================================
    // 3. BUILDINGS, ACTIVE TASKS, JOBS & MILESTONES CATALOG
    // =========================================================================
    const BUILDING_DEFS = {
      // --- CHAPTER 1: FOUNDING & KĀINGA (MĀORI ERA) ---
      whare: {
        id: 'whare',
        name: 'Wharepuni (Sleeping House)',
        era: 1,
        icon: '🛖',
        desc: 'Warm timber and raupō thatch dwelling. Increases Kāinga population capacity.',
        baseCost: { rakau: 12, kai: 8 },
        costScale: 1.45,
        buildTime: 8, // seconds at 1x early on
        maxCount: 10,
        effects: { popCap: 6, growthPoints: 8 },
        preferredTiles: ['grass', 'sand']
      },
      mara_kumara: {
        id: 'mara_kumara',
        name: 'Māra Kūmara (Garden Mounds)',
        era: 1,
        icon: '🌱',
        desc: 'Sun-warmed puke (soil mounds) producing steady Kai and periodic rich harvests.',
        baseCost: { rakau: 10, kai: 6 },
        costScale: 1.4,
        buildTime: 10,
        maxCount: 8,
        effects: { kaiPerSec: 1.2, growthPoints: 10 },
        preferredTiles: ['grass']
      },
      waka_ama: {
        id: 'waka_ama',
        name: 'Tauihu Waka & Fishing Rack',
        era: 1,
        icon: '🛶',
        desc: 'Outrigger waka mooring and coastal drying racks for abundant kaimoana (seafood).',
        baseCost: { rakau: 18, kai: 10 },
        costScale: 1.5,
        buildTime: 14,
        maxCount: 5,
        effects: { kaiPerSec: 1.8, growthPoints: 12 },
        preferredTiles: ['sand', 'shallow_water']
      },
      rua_kumara: {
        id: 'rua_kumara',
        name: 'Rua Kūmara (Hillside Store)',
        era: 1,
        icon: '🧺',
        desc: 'Earth-insulated storage pit carved into the slope. Expands Kai and Rākau storage caps.',
        baseCost: { rakau: 28, kai: 18 },
        costScale: 1.55,
        buildTime: 18,
        maxCount: 6,
        effects: { kaiCap: 250, rakauCap: 200, growthPoints: 14 },
        preferredTiles: ['grass', 'hill']
      },
      pa_headland: {
        id: 'pa_headland',
        name: 'Pā Tūwatawata (Headland Pā)',
        era: 1,
        icon: '🏯',
        desc: 'Major Chapter 1 landmark crowning the headland hill with timber palisades and carved wharenui.',
        baseCost: { rakau: 95, kai: 90 },
        costScale: 2.2,
        buildTime: 35,
        maxCount: 2,
        unlockPop: 22,
        effects: { popCap: 20, kaiCap: 400, rakauCap: 350, growthPoints: 45 },
        preferredTiles: ['hill']
      },

      // --- CHAPTER 2: TRADE & EARLY TOWNSHIP ---
      wharf_port: {
        id: 'wharf_port',
        name: 'Deepwater Timber Wharf',
        era: 2,
        icon: '⚓',
        desc: 'Enables ocean trading vessels to berth, exporting goods for Coin and welcoming new arrivals.',
        baseCost: { rakau: 75, kai: 60 },
        costScale: 1.7,
        buildTime: 28,
        maxCount: 3,
        effects: { coinPerSec: 0.8, tradeGoodsPerSec: 0.6, growthPoints: 25 },
        preferredTiles: ['sand', 'shallow_water']
      },
      trading_post: {
        id: 'trading_post',
        name: 'Coastal Trading Post',
        era: 2,
        icon: '⚖️',
        desc: 'Bustling exchange where kāinga produce, flax, and timber are traded for Coin and tools.',
        baseCost: { rakau: 65, kai: 50, coin: 15 },
        costScale: 1.6,
        buildTime: 25,
        maxCount: 4,
        effects: { coinPerSec: 1.5, tradeCap: 200, growthPoints: 20 },
        preferredTiles: ['grass', 'sand']
      },
      settler_cottage: {
        id: 'settler_cottage',
        name: 'Weatherboard Cottage',
        era: 2,
        icon: '🏡',
        desc: 'Timber cottage with garden fence, expanding township housing alongside the kāinga.',
        baseCost: { rakau: 45, coin: 18 },
        costScale: 1.45,
        buildTime: 20,
        maxCount: 10,
        effects: { popCap: 10, growthPoints: 15 },
        preferredTiles: ['grass', 'town_floor']
      },
      town_road: {
        id: 'town_road',
        name: 'Coach Road & Bridges',
        era: 2,
        icon: '🛤️',
        desc: 'Connects the harbour, kāinga, and inland pastures, revealing Whenua and speeding trade.',
        baseCost: { rakau: 35, coin: 12 },
        costScale: 1.35,
        buildTime: 14,
        maxCount: 12,
        effects: { whenuaBonus: 6, tradeGoodsPerSec: 0.5, growthPoints: 12 },
        preferredTiles: ['grass']
      },
      pastoral_farm: {
        id: 'pastoral_farm',
        name: 'Pastoral Homestead & Paddock',
        era: 2,
        icon: '🐑',
        desc: 'Fenced hillside pasture producing abundant food and wool trade goods.',
        baseCost: { rakau: 60, coin: 30 },
        costScale: 1.5,
        buildTime: 26,
        maxCount: 6,
        effects: { kaiPerSec: 3.0, tradeGoodsPerSec: 1.4, growthPoints: 22 },
        preferredTiles: ['grass', 'farmland']
      },
      timber_mill: {
        id: 'timber_mill',
        name: 'Waterwheel Sawmill & Workshop',
        era: 2,
        icon: '⚙️',
        desc: 'Early craft workshop converting timber into manufactured goods and steady Rākau supply.',
        baseCost: { rakau: 85, coin: 45, tradeGoods: 25 },
        costScale: 1.6,
        buildTime: 32,
        maxCount: 4,
        effects: { rakauPerSec: 2.2, industryPerSec: 0.9, growthPoints: 26 },
        preferredTiles: ['grass', 'forest']
      },

      // --- CHAPTER 2b: TOWNSHIP TO MODERN SKYLINE (ENDGAME) ---
      town_hall: {
        id: 'town_hall',
        name: 'Civic Town Hall & Clocktower',
        era: 3,
        icon: '🏛️',
        desc: 'Stone civic landmark anchoring the growing township and boosting population capacity.',
        baseCost: { rakau: 140, coin: 120, tradeGoods: 70 },
        costScale: 1.8,
        buildTime: 42,
        maxCount: 2,
        effects: { popCap: 35, coinPerSec: 3.2, industryPerSec: 1.5, growthPoints: 55 },
        preferredTiles: ['town_floor', 'grass']
      },
      high_street_shops: {
        id: 'high_street_shops',
        name: 'Heritage High Street & Rail Link',
        era: 3,
        icon: '🏪',
        desc: 'Two-storey brick merchants, bakery, and tram/rail depot fueling commercial prosperity.',
        baseCost: { rakau: 110, coin: 95, tradeGoods: 55 },
        costScale: 1.55,
        buildTime: 34,
        maxCount: 6,
        effects: { coinPerSec: 2.8, industryPerSec: 1.8, popCap: 15, growthPoints: 35 },
        preferredTiles: ['town_floor', 'grass']
      },
      modern_skyline: {
        id: 'modern_skyline',
        name: 'Modern Harbour Skyline & Tower',
        era: 3,
        icon: '🌆',
        desc: 'Contemporary civic towers and harbour lights rising on the upper ridge beside the enduring Kāinga and Pā.',
        baseCost: { rakau: 220, coin: 260, tradeGoods: 140, industry: 80 },
        costScale: 1.9,
        buildTime: 55,
        maxCount: 3,
        effects: { popCap: 60, coinPerSec: 6.0, industryPerSec: 4.0, growthPoints: 90 },
        preferredTiles: ['hill', 'town_floor', 'grass']
      }
    };

    const JOB_DEFS = [
      { id: 'gardener', name: 'Kaimahi Māra (Gardeners)', era: 1, icon: '🌿', desc: '+0.8 Kai/sec per villager tending kūmara mounds.', rates: { kai: 0.8 } },
      { id: 'fisher', name: 'Kaihao Ika (Coastal Fisherfolk)', era: 1, icon: '🐟', desc: '+0.65 Kai/sec & +0.15 Rākau/sec from coastal drift.', rates: { kai: 0.65, rakau: 0.15 } },
      { id: 'forester', name: 'Kaitārai Rākau (Timber Gatherers)', era: 1, icon: '🪵', desc: '+0.75 Rākau/sec harvested respectfully from the ngahere.', rates: { rakau: 0.75 } },
      { id: 'explorer', name: 'Kaitūhura (Land Pathfinders)', era: 1, icon: '🧭', desc: 'Reveals new Whenua tiles across the peninsula over time.', rates: { whenuaProgress: 0.35 } },
      { id: 'merchant', name: 'Harbour Merchants & Faktoren', era: 2, icon: '🪙', desc: '+0.9 Coin/sec & +0.4 Trade Goods/sec at the wharf.', rates: { coin: 0.9, tradeGoods: 0.4 } },
      { id: 'pastoralist', name: 'Pastoral Hands & Shearers', era: 2, icon: '🐑', desc: '+1.1 Kai/sec & +0.75 Trade Goods/sec.', rates: { kai: 1.1, tradeGoods: 0.75 } },
      { id: 'artisan', name: 'Township Millwrights & Engineers', era: 3, icon: '🏗️', desc: '+1.1 Industry/sec & +1.0 Coin/sec.', rates: { industry: 1.1, coin: 1.0 } }
    ];

    const MILESTONES = [
      {
        id: 'm_first_garden',
        title: 'First Māra Kūmara Planted',
        desc: 'Establish a kūmara garden and reach 10 Population in the coastal kāinga.',
        check: (g) => g.state.population >= 10 && g.countBuilding('mara_kumara') >= 1,
        rewardText: '+18 Whenua tiles revealed, unlocks Rua Kūmara storage',
        onReach: (g) => { g.revealTiles(18); g.state.resources.kai += 25; }
      },
      {
        id: 'm_growing_kainga',
        title: 'Thriving Coastal Kāinga',
        desc: 'Grow to 22 Population and build at least 3 Whare and 1 Waka Ama mooring.',
        check: (g) => g.state.population >= 22 && g.countBuilding('whare') >= 3 && g.countBuilding('waka_ama') >= 1,
        rewardText: '+28 Whenua tiles revealed, unlocks the Headland Pā!',
        onReach: (g) => { g.revealTiles(28); g.state.resources.rakau += 40; }
      },
      {
        id: 'm_pa_crowned',
        title: 'Te Pā Tūwatawata — Sails on the Horizon',
        desc: 'Construct the Headland Pā and reach 36 Population to trigger the Turning Point.',
        check: (g) => g.state.population >= 36 && g.countBuilding('pa_headland') >= 1,
        rewardText: 'Triggers "Sails on the Horizon" Turning Point & unlocks Chapter 2!',
        onReach: (g) => { g.startTurningPoint(); }
      },
      {
        id: 'm_harbour_trade',
        title: 'Coexistence & Harbour Trade',
        desc: 'Construct a Deepwater Wharf, a Trading Post, and reach 65 Population.',
        check: (g) => g.state.chapter >= 2 && g.state.population >= 65 && g.countBuilding('wharf_port') >= 1 && g.countBuilding('trading_post') >= 1,
        rewardText: '+45 Whenua tiles revealed & +60 Coin',
        onReach: (g) => { g.revealTiles(45); g.state.resources.coin += 60; }
      },
      {
        id: 'm_township_era',
        title: 'Heart of the Township (Chapter 2b)',
        desc: 'Build a Pastoral Farm, a Waterwheel Sawmill, and reach 110 Population.',
        check: (g) => g.state.chapter >= 2 && g.state.population >= 110 && g.countBuilding('pastoral_farm') >= 1 && g.countBuilding('timber_mill') >= 1,
        rewardText: 'Unlocks Chapter 2b: Civic Town Hall, High Street & Modern Skyline!',
        onReach: (g) => {
          g.state.chapter = 3;
          g.revealTiles(65);
          g.addChronicle('Chapter 2b Begun: From Kāinga & Port to a Connected Modern Town.');
          g.pushBanner('Chapter 2b Unlocked — Township to Modern Horizon', 'Civic architecture, rail links, and the modern skyline are now available in the Build menu while the founding Kāinga continues to thrive.');
        }
      },
      {
        id: 'm_aotearoa_generations',
        title: 'Aotearoa: Generations Complete Arc',
        desc: 'Construct the Modern Harbour Skyline and reach 180 Population across both connected traditions.',
        check: (g) => g.countBuilding('modern_skyline') >= 1 && g.state.population >= 180,
        rewardText: 'Full Peninsula Revealed & Golden Legacy Aura Unlocked!',
        onReach: (g) => {
          g.revealTiles(300);
          g.addChronicle('Generations Milestone Reached: The coastal kāinga, headland pā, port, and modern skyline stand together across one continuous landscape.');
          g.pushBanner('✨ Aotearoa: Generations — Full Horizon Achieved!', 'Look across the peninsula: the founding waka, whare, and headland pā thrive alongside the harbour port, farms, and modern skyline. Try Photo Mode (📷) to capture your settlement!');
        }
      }
    ];

    const STORAGE_KEY = 'aotearoa_generations_state_v1';

window.GRID_SIZE = GRID_SIZE;
window.TILE_W = TILE_W;
window.TILE_H = TILE_H;
window.ELEV_SCALE = ELEV_SCALE;
window.LANDING_COL = LANDING_COL;
window.LANDING_ROW = LANDING_ROW;
window.generatePeninsulaMap = generatePeninsulaMap;
window.BUILDING_DEFS = BUILDING_DEFS;
window.JOB_DEFS = JOB_DEFS;
window.MILESTONES = MILESTONES;
window.STORAGE_KEY = STORAGE_KEY;
