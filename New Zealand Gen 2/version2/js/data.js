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
        desc: 'Warm timber and raupō thatch dwelling. Increases <strong>Population Cap (+4)</strong> and unlocks <strong>+1 Villager</strong> &amp; <strong>+1 Explorer</strong> slots.',
        baseCost: { rakau: 25, kai: 20 },
        costScale: 1.55,
        buildTime: 45,
        reqVillagers: 2,
        maxCount: 10,
        effects: { popCap: 4, jobSlots: { gardener: 1, explorer: 1 }, growthPoints: 8 },
        preferredTiles: ['grass', 'sand']
      },
      mara_kumara: {
        id: 'mara_kumara',
        name: 'Māra Kūmara (Garden Mounds)',
        era: 1,
        icon: '🌱',
        desc: 'Sun-warmed puke (soil mounds). Unlocks <strong>+2 Villager (Kaimahi)</strong> slots and boosts <strong>Kūmara Harvest (+4 Kai)</strong> yields.',
        baseCost: { rakau: 30, kai: 25 },
        costScale: 1.55,
        buildTime: 60,
        reqVillagers: 2,
        maxCount: 8,
        effects: { jobSlots: { gardener: 2 }, growthPoints: 10 },
        preferredTiles: ['grass']
      },
      waka_ama: {
        id: 'waka_ama',
        name: 'Tauihu Waka & Hunting Rack',
        era: 1,
        icon: '🛶',
        desc: 'Outrigger waka mooring and drying racks. Unlocks <strong>+2 Hunter/Fisher</strong> &amp; <strong>+1 Explorer</strong> slots, and boosts <strong>Waka Fishing (+4 Kai)</strong>.',
        baseCost: { rakau: 55, kai: 40 },
        costScale: 1.6,
        buildTime: 90,
        reqVillagers: 2,
        maxCount: 5,
        effects: { jobSlots: { hunter: 2, explorer: 1 }, growthPoints: 12 },
        preferredTiles: ['sand', 'shallow_water']
      },
      rua_kumara: {
        id: 'rua_kumara',
        name: 'Rua Kūmara (Hillside Store)',
        era: 1,
        icon: '🧺',
        desc: 'Earth-insulated hillside storehouse. Expands <strong>Kai Cap (+250)</strong> &amp; <strong>Rākau Cap (+220)</strong>, and unlocks <strong>+1 Lumberjack</strong> &amp; <strong>+1 Hunter</strong> slots.',
        baseCost: { rakau: 85, kai: 65 },
        costScale: 1.65,
        buildTime: 180,
        reqVillagers: 2,
        maxCount: 6,
        effects: { kaiCap: 250, rakauCap: 220, jobSlots: { forester: 1, hunter: 1 }, growthPoints: 14 },
        preferredTiles: ['grass', 'hill']
      },
      pa_headland: {
        id: 'pa_headland',
        name: 'Pā Tūwatawata (Headland Pā)',
        era: 1,
        icon: '🏯',
        desc: 'Major Chapter 1 landmark. Boosts <strong>Population Cap (+16)</strong>, <strong>Kai Cap (+800)</strong>, <strong>Rākau Cap (+750)</strong>, and unlocks <strong>+3 Villager</strong> &amp; <strong>+2 Hunter/Lumberjack/Explorer</strong> slots.',
        baseCost: { rakau: 650, kai: 600 },
        costScale: 2.2,
        buildTime: 900,
        reqVillagers: 4,
        maxCount: 2,
        unlockPop: 24,
        effects: { popCap: 16, kaiCap: 800, rakauCap: 750, jobSlots: { gardener: 3, hunter: 2, forester: 2, explorer: 2 }, growthPoints: 45 },
        preferredTiles: ['hill']
      },

      // --- CHAPTER 2: TRADE & EARLY TOWNSHIP ---
      wharf_port: {
        id: 'wharf_port',
        name: 'Deepwater Timber Wharf',
        era: 2,
        icon: '⚓',
        desc: 'Ocean trading pier generating <strong>+0.04 Coin/s</strong> &amp; <strong>+0.03 Trade Goods/s</strong>. Expands <strong>Coin Cap (+1,200)</strong>, <strong>Goods Cap (+600)</strong>, and unlocks <strong>+3 Merchant</strong> slots.',
        baseCost: { rakau: 550, kai: 450 },
        costScale: 1.75,
        buildTime: 900,
        reqVillagers: 4,
        maxCount: 3,
        effects: { coinPerSec: 0.04, tradeGoodsPerSec: 0.03, coinCap: 1200, tradeCap: 600, jobSlots: { merchant: 3, explorer: 1 }, growthPoints: 25 },
        preferredTiles: ['sand', 'shallow_water']
      },
      trading_post: {
        id: 'trading_post',
        name: 'Coastal Trading Post',
        era: 2,
        icon: '⚖️',
        desc: 'Bustling exchange generating <strong>+0.06 Coin/s</strong>. Expands <strong>Coin Cap (+1,500)</strong>, <strong>Goods Cap (+800)</strong>, <strong>Kai/Rākau Caps (+600)</strong>, and unlocks <strong>+2 Merchant</strong> slots.',
        baseCost: { rakau: 700, kai: 550, coin: 180 },
        costScale: 1.7,
        buildTime: 720,
        reqVillagers: 4,
        maxCount: 4,
        effects: { coinPerSec: 0.06, coinCap: 1500, tradeCap: 800, kaiCap: 600, rakauCap: 600, jobSlots: { merchant: 2 }, growthPoints: 20 },
        preferredTiles: ['grass', 'sand']
      },
      settler_cottage: {
        id: 'settler_cottage',
        name: 'Weatherboard Cottage',
        era: 2,
        icon: '🏡',
        desc: 'Timber cottage expanding <strong>Population Cap (+8)</strong>, <strong>Kai/Rākau Caps (+300)</strong>, and unlocking <strong>+2 Villager (Kaimahi)</strong> builder slots.',
        baseCost: { rakau: 420, coin: 140 },
        costScale: 1.55,
        buildTime: 360,
        reqVillagers: 3,
        maxCount: 10,
        effects: { popCap: 8, kaiCap: 300, rakauCap: 300, jobSlots: { gardener: 2 }, growthPoints: 15 },
        preferredTiles: ['grass', 'town_floor']
      },
      town_road: {
        id: 'town_road',
        name: 'Coach Road & Bridges',
        era: 2,
        icon: '🛤️',
        desc: 'Connects harbour and inland pastures, revealing <strong>+3 Whenua</strong>, generating <strong>+0.02 Trade Goods/s</strong>, and unlocking <strong>+1 Explorer</strong> slot.',
        baseCost: { rakau: 320, coin: 110 },
        costScale: 1.5,
        buildTime: 240,
        reqVillagers: 3,
        maxCount: 12,
        effects: { whenuaBonus: 3, tradeGoodsPerSec: 0.02, coinCap: 400, tradeCap: 250, jobSlots: { explorer: 1 }, growthPoints: 12 },
        preferredTiles: ['grass']
      },
      pastoral_farm: {
        id: 'pastoral_farm',
        name: 'Pastoral Homestead & Paddock',
        era: 2,
        icon: '🐑',
        desc: 'Hillside pasture producing <strong>+0.12 Kai/s</strong> &amp; <strong>+0.05 Trade Goods/s</strong>. Expands <strong>Kai Cap (+1,200)</strong>, <strong>Goods Cap (+700)</strong>, and unlocks <strong>+3 Pastoralist</strong> slots.',
        baseCost: { rakau: 950, coin: 420 },
        costScale: 1.65,
        buildTime: 1200,
        reqVillagers: 4,
        maxCount: 6,
        effects: { kaiPerSec: 0.12, tradeGoodsPerSec: 0.05, kaiCap: 1200, tradeCap: 700, jobSlots: { pastoralist: 3 }, growthPoints: 22 },
        preferredTiles: ['grass', 'farmland']
      },
      timber_mill: {
        id: 'timber_mill',
        name: 'Waterwheel Sawmill & Workshop',
        era: 2,
        icon: '⚙️',
        desc: 'Waterwheel workshop generating <strong>+0.10 Rākau/s</strong> &amp; <strong>+0.04 Industry/s</strong>. Expands <strong>Rākau Cap (+1,800)</strong>, <strong>Industry Cap (+800)</strong>, and unlocks <strong>+3 Lumberjack</strong> &amp; <strong>+1 Engineer</strong> slots.',
        baseCost: { rakau: 1400, coin: 680, tradeGoods: 380 },
        costScale: 1.7,
        buildTime: 1800,
        reqVillagers: 5,
        maxCount: 4,
        effects: { rakauPerSec: 0.10, industryPerSec: 0.04, rakauCap: 1800, industryCap: 800, jobSlots: { forester: 3, artisan: 1 }, growthPoints: 26 },
        preferredTiles: ['grass', 'forest']
      },

      // --- CHAPTER 2b: TOWNSHIP TO MODERN SKYLINE (ENDGAME) ---
      town_hall: {
        id: 'town_hall',
        name: 'Civic Town Hall & Clocktower',
        era: 3,
        icon: '🏛️',
        desc: 'Civic landmark boosting <strong>Population Cap (+30)</strong>, <strong>+0.25 Coin/s</strong>, <strong>+0.10 Industry/s</strong>, expanding <strong>Coin/Goods/Industry Caps</strong>, and unlocking <strong>+3 Villager/Engineer/Merchant</strong> slots.',
        baseCost: { rakau: 4800, coin: 4200, tradeGoods: 2400 },
        costScale: 1.9,
        buildTime: 5400,
        reqVillagers: 7,
        maxCount: 2,
        effects: { popCap: 30, coinPerSec: 0.25, industryPerSec: 0.10, coinCap: 8000, tradeCap: 4500, industryCap: 3000, jobSlots: { gardener: 3, artisan: 3, merchant: 3 }, growthPoints: 55 },
        preferredTiles: ['town_floor', 'grass']
      },
      high_street_shops: {
        id: 'high_street_shops',
        name: 'Heritage High Street & Rail Link',
        era: 3,
        icon: '🏪',
        desc: 'Commercial rail precinct adding <strong>Population Cap (+14)</strong>, <strong>+0.20 Coin/s</strong>, <strong>+0.12 Industry/s</strong>, expanding <strong>Storage Caps</strong>, and unlocking <strong>+2 Villager</strong>, <strong>+3 Engineer</strong> &amp; <strong>+2 Merchant</strong> slots.',
        baseCost: { rakau: 3600, coin: 3200, tradeGoods: 1800, industry: 600 },
        costScale: 1.7,
        buildTime: 3600,
        reqVillagers: 6,
        maxCount: 6,
        effects: { coinPerSec: 0.20, industryPerSec: 0.12, popCap: 14, rakauCap: 3500, coinCap: 5000, tradeCap: 3000, industryCap: 2000, jobSlots: { gardener: 2, artisan: 3, merchant: 2 }, growthPoints: 35 },
        preferredTiles: ['town_floor', 'grass']
      },
      modern_skyline: {
        id: 'modern_skyline',
        name: 'Modern Harbour Skyline & Tower',
        era: 3,
        icon: '🌆',
        desc: 'Contemporary civic towers boosting <strong>Population Cap (+50)</strong>, <strong>+0.60 Coin/s</strong>, <strong>+0.40 Industry/s</strong>, <strong>Coin Cap (+15,000)</strong>, and <strong>Industry Cap (+8,000)</strong>.',
        baseCost: { rakau: 16000, coin: 22000, tradeGoods: 12000, industry: 7500 },
        costScale: 2.0,
        buildTime: 10800,
        reqVillagers: 8,
        maxCount: 3,
        effects: { popCap: 50, coinPerSec: 0.60, industryPerSec: 0.40, coinCap: 15000, industryCap: 8000, jobSlots: { artisan: 5, merchant: 4 }, growthPoints: 90 },
        preferredTiles: ['hill', 'town_floor', 'grass']
      }
    };

    const JOB_DEFS = [
      {
        id: 'gardener',
        name: 'Kaimahi (Villagers & Builders)',
        era: 1,
        baseSlots: 2,
        icon: '🌾',
        desc: 'Generates <strong>+0.07 Kai/s</strong>, boosts <strong>Build Speed (+8%)</strong>, and is <strong>required to construct buildings</strong>.',
        rates: { kai: 0.07 },
        buildSpeedBonus: 0.08,
        unitColor: 0xe8b948
      },
      {
        id: 'hunter',
        name: 'Kaiwhai (Hunters & Fisherfolk)',
        era: 1,
        baseSlots: 1,
        icon: '🏹',
        desc: 'Generates <strong>+0.11 Kai/s</strong> hunting forest game and hauling coastal kaimoana.',
        rates: { kai: 0.11 },
        unitColor: 0xc86446
      },
      {
        id: 'forester',
        name: 'Kaitārai (Lumberjacks)',
        era: 1,
        baseSlots: 1,
        icon: '🪓',
        desc: 'Generates <strong>+0.08 Rākau/s</strong> felled from the native ngahere (forest).',
        rates: { rakau: 0.08 },
        unitColor: 0x8c6239
      },
      {
        id: 'explorer',
        name: 'Kaitūhura (Explorers & Scouts)',
        era: 1,
        baseSlots: 1,
        icon: '🧭',
        desc: 'Passively scouts <strong>Whenua (+0.004 tiles/s)</strong> &amp; reduces <strong>Survey Costs (−8%)</strong> per Explorer.',
        rates: { whenuaProgress: 0.004 },
        surveyDiscount: 0.08,
        unitColor: 0x52c7a1
      },
      {
        id: 'merchant',
        name: 'Harbour Merchants & Faktoren',
        era: 2,
        baseSlots: 0,
        icon: '🪙',
        desc: 'Generates <strong>+0.12 Coin/s</strong> &amp; <strong>+0.06 Trade Goods/s</strong> at the wharf and trading post.',
        rates: { coin: 0.12, tradeGoods: 0.06 },
        unitColor: 0x5b8ec9
      },
      {
        id: 'pastoralist',
        name: 'Pastoral Hands & Shearers',
        era: 2,
        baseSlots: 0,
        icon: '🐑',
        desc: 'Generates <strong>+0.15 Kai/s</strong> &amp; <strong>+0.10 Trade Goods/s</strong> across fenced hillside paddocks.',
        rates: { kai: 0.15, tradeGoods: 0.10 },
        unitColor: 0x9ec968
      },
      {
        id: 'artisan',
        name: 'Township Engineers & Millwrights',
        era: 3,
        baseSlots: 0,
        icon: '🏗️',
        desc: 'Generates <strong>+0.18 Industry/s</strong>, <strong>+0.20 Coin/s</strong> &amp; boosts <strong>Build Speed (+12%)</strong>.',
        rates: { industry: 0.18, coin: 0.20 },
        buildSpeedBonus: 0.12,
        unitColor: 0xa67cd9
      }
    ];

    const MILESTONES = [
      {
        id: 'm_first_garden',
        title: 'Established Coastal Kāinga',
        desc: 'Recruit to <strong>10 Population</strong> and construct at least <strong>2 Māra Kūmara</strong> gardens and <strong>2 Wharepuni</strong>.',
        check: (g) => g.state.population >= 10 && g.countBuilding('mara_kumara') >= 2 && g.countBuilding('whare') >= 2,
        rewardText: '+8 Whenua tiles revealed & +30 Kai',
        onReach: (g) => { g.revealTiles(8); g.state.resources.kai = Math.min(g.state.caps.kai, g.state.resources.kai + 30); }
      },
      {
        id: 'm_growing_kainga',
        title: 'Thriving Kāinga & Storage Pits',
        desc: 'Recruit to <strong>24 Population</strong> and construct <strong>4 Wharepuni</strong>, <strong>2 Waka Ama</strong> moorings, and <strong>2 Rua Kūmara</strong> stores.',
        check: (g) => g.state.population >= 24 && g.countBuilding('whare') >= 4 && g.countBuilding('waka_ama') >= 2 && g.countBuilding('rua_kumara') >= 2,
        rewardText: '+12 Whenua tiles revealed & unlocks the Headland Pā!',
        onReach: (g) => { g.revealTiles(12); g.state.resources.rakau = Math.min(g.state.caps.rakau, g.state.resources.rakau + 80); }
      },
      {
        id: 'm_pa_crowned',
        title: 'Te Pā Tūwatawata — Sails on the Horizon',
        desc: 'Construct the <strong>Headland Pā</strong>, recruit to <strong>36 Population</strong>, and expand to at least <strong>65 Whenua</strong> tiles.',
        check: (g) => g.state.population >= 36 && g.countBuilding('pa_headland') >= 1 && g.state.resources.whenua >= 65,
        rewardText: 'Triggers "Sails on the Horizon" Turning Point & unlocks Chapter 2!',
        onReach: (g) => { g.startTurningPoint(); }
      },
      {
        id: 'm_harbour_trade',
        title: 'Coexistence & Harbour Trade',
        desc: 'Construct a <strong>Deepwater Wharf</strong>, a <strong>Trading Post</strong>, <strong>3 Weatherboard Cottages</strong>, and <strong>3 Coach Roads</strong> at <strong>65+ Population</strong>.',
        check: (g) => g.state.chapter >= 2 && g.state.population >= 65 && g.countBuilding('wharf_port') >= 1 && g.countBuilding('trading_post') >= 1 && g.countBuilding('settler_cottage') >= 3 && g.countBuilding('town_road') >= 3,
        rewardText: '+18 Whenua tiles revealed & +150 Coin',
        onReach: (g) => { g.revealTiles(18); g.state.resources.coin = Math.min(g.state.caps.coin, g.state.resources.coin + 150); }
      },
      {
        id: 'm_township_era',
        title: 'Heart of the Township (Chapter 2b)',
        desc: 'Build <strong>3 Pastoral Farms</strong>, <strong>2 Waterwheel Sawmills</strong>, reach <strong>110 Population</strong>, and scout at least <strong>140 Whenua</strong> tiles.',
        check: (g) => g.state.chapter >= 2 && g.state.population >= 110 && g.countBuilding('pastoral_farm') >= 3 && g.countBuilding('timber_mill') >= 2 && g.state.resources.whenua >= 140,
        rewardText: 'Unlocks Chapter 2b: Civic Town Hall, High Street & Modern Skyline!',
        onReach: (g) => {
          g.state.chapter = 3;
          g.revealTiles(24);
          g.addChronicle('Chapter 2b Begun: From Kāinga & Port to a Connected Modern Town.');
          g.pushBanner('Chapter 2b Unlocked — Township to Modern Horizon', 'Civic architecture, rail links, and the modern skyline are now available in the Build menu while the founding Kāinga continues to thrive.');
        }
      },
      {
        id: 'm_aotearoa_generations',
        title: 'Aotearoa: Generations Complete Arc',
        desc: 'Construct a <strong>Civic Town Hall</strong>, <strong>3 High Street Shops</strong>, the <strong>Modern Harbour Skyline</strong>, and reach <strong>180 Population</strong>.',
        check: (g) => g.countBuilding('town_hall') >= 1 && g.countBuilding('high_street_shops') >= 3 && g.countBuilding('modern_skyline') >= 1 && g.state.population >= 180,
        rewardText: 'Full Peninsula Revealed & Golden Legacy Aura Unlocked!',
        onReach: (g) => {
          g.revealTiles(300);
          g.addChronicle('Generations Milestone Reached: The coastal kāinga, headland pā, port, and modern skyline stand together across one continuous landscape.');
          g.pushBanner('✨ Aotearoa: Generations — Full Horizon Achieved!', 'Look across the peninsula: the founding waka, whare, and headland pā thrive alongside the harbour port, farms, and modern skyline. Try Photo Mode (📷) to capture your settlement!');
        }
      }
    ];

    const STORAGE_KEY = 'aotearoa_generations_state_v2';

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
