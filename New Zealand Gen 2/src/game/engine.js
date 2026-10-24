import { Application, Container, Graphics, Sprite, Assets, Texture } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import CoastalMap from './maps/coastal.json';

// Tiled Map Constants (Tiled uses 1-indexed Global IDs based on our terrain.tsx)
// 0 means Empty Tile in Tiled.
const TILE_WATER = 1;
const TILE_BEACH = 2;
const TILE_GRASS = 3;
const TILE_CLIFF = 4;
const TILE_PINE = 5;

export async function initGameEngine(state) {
  // Create application
  const app = new Application();
  await app.init({
    resizeTo: window,
    backgroundColor: '#161d24', // Dark fog / void color
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  
  // Preload assets
  const cliffTexture = await Assets.load('/tiles/cliff.svg');
  const pineTexture = await Assets.load('/tiles/pine.png');

  const container = document.getElementById('game-canvas-container');
  container.appendChild(app.canvas);

  // Initialize Viewport for zoom/pan
  const viewport = new Viewport({
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    worldWidth: 4000,
    worldHeight: 4000,
    events: app.renderer.events // Required for pixi-viewport interaction
  });

  app.stage.addChild(viewport);

  // Enable camera controls
  viewport
    .drag()
    .pinch()
    .wheel()
    .decelerate();

  // Master container for the world (NO SQUASHING, NO ROTATION! TRUE ISOMETRIC)
  const worldContainer = new Container();
  worldContainer.sortableChildren = true;
  viewport.addChild(worldContainer);

  const mapWidth = CoastalMap.width;
  const mapHeight = CoastalMap.height;
  const tileWidth = CoastalMap.tilewidth;   // e.g. 128
  const tileHeight = CoastalMap.tileheight; // e.g. 64

  // Center the map logically
  const gridOffsetX = 0; // We will center via the viewport moveCenter instead

  // Helper to draw a true diamond polygon for a tile
  function drawDiamond(g, x, y, color, strokeColor) {
    g.moveTo(x, y - tileHeight / 2); // Top
    g.lineTo(x + tileWidth / 2, y);  // Right
    g.lineTo(x, y + tileHeight / 2); // Bottom
    g.lineTo(x - tileWidth / 2, y);  // Left
    g.lineTo(x, y - tileHeight / 2); // Back to Top
    g.fill({ color: color });
    g.stroke({ color: strokeColor, width: 1 });
  }

  // Draw the true isometric diamond grid
  const terrainGraphics = new Graphics();
  // We place terrain at zIndex 0 so entities naturally sort on top of it (mostly)
  // Or we can just add it before entities. 
  terrainGraphics.zIndex = -1000;
  worldContainer.addChild(terrainGraphics);

  // Helper to convert grid (col, row) coords to true isometric screen coords
  function gridToIso(col, row) {
    // True Isometric Math (Tiled projection)
    const isoX = (col - row) * (tileWidth / 2);
    const isoY = (col + row) * (tileHeight / 2);
    return { x: isoX, y: isoY };
  }

  // Pre-calculate which grid cells are completely empty across all layers
  const hasTile = new Array(mapWidth * mapHeight).fill(false);
  CoastalMap.layers.forEach(layer => {
    if (layer.type !== 'tilelayer' || !layer.visible) return;
    for (let i = 0; i < layer.data.length; i++) {
      if (layer.data[i] !== 0) hasTile[i] = true;
    }
  });

  // Helper to find distance to nearest empty tile (or map edge), capped at a radius of 3
  function getDistToEmpty(col, row) {
    let minDist = Math.min(col, mapWidth - 1 - col, row, mapHeight - 1 - row);
    for (let r = -3; r <= 3; r++) {
      for (let c = -3; c <= 3; c++) {
        const checkCol = col + c;
        const checkRow = row + r;
        if (checkCol >= 0 && checkCol < mapWidth && checkRow >= 0 && checkRow < mapHeight) {
          const index = checkRow * mapWidth + checkCol;
          if (!hasTile[index]) {
            const dist = Math.sqrt(c*c + r*r);
            if (dist < minDist) minDist = dist;
          }
        }
      }
    }
    return minDist;
  }

  // --- Create Volumetric Fog Texture ---
  const fogCanvas = document.createElement('canvas');
  fogCanvas.width = 300;
  fogCanvas.height = 300;
  const ctx = fogCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(150, 150, 0, 150, 150, 150);
  gradient.addColorStop(0, 'rgba(22, 29, 36, 1)'); // Solid dark void
  gradient.addColorStop(0.4, 'rgba(22, 29, 36, 0.9)');
  gradient.addColorStop(0.7, 'rgba(22, 29, 36, 0.5)');
  gradient.addColorStop(1, 'rgba(22, 29, 36, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 300, 300);
  const fogCloudTexture = Texture.from(fogCanvas);

  // Helper to find distance to nearest non-tree tile
  function getDistToNonTree(col, row) {
    let minDist = 4;
    for (let r = -3; r <= 3; r++) {
      for (let c = -3; c <= 3; c++) {
        const checkCol = col + c;
        const checkRow = row + r;
        
        if (checkCol < 0 || checkCol >= mapWidth || checkRow < 0 || checkRow >= mapHeight) {
          const dist = Math.max(Math.abs(c), Math.abs(r));
          if (dist < minDist) minDist = dist;
          continue;
        }
        
        const index = checkRow * mapWidth + checkCol;
        let isPine = false;
        CoastalMap.layers.forEach(layer => {
          if (layer.type === 'tilelayer' && layer.visible && layer.data[index] === TILE_PINE) {
            isPine = true;
          }
        });
        
        if (!isPine) {
          const dist = Math.max(Math.abs(c), Math.abs(r));
          if (dist < minDist) minDist = dist;
        }
      }
    }
    return minDist;
  }

  // Parse all Tiled layers
  CoastalMap.layers.forEach(layer => {
    if (layer.type !== 'tilelayer' || !layer.visible) return;
    
    const mapData = layer.data;
    for (let i = 0; i < mapData.length; i++) {
      const tileType = mapData[i];
      if (tileType === 0) continue; // 0 means empty tile in Tiled!

      const col = i % mapWidth;
      const row = Math.floor(i / mapWidth);
      
      let tileColor;
      let strokeColor = 0x5a7a5b;
      
      if (tileType === TILE_WATER) {
        tileColor = (col + row) % 2 === 0 ? 0x227bb5 : 0x2582be;
        strokeColor = 0x1d6a9c;
      } else if (tileType === TILE_BEACH) {
        tileColor = (col + row) % 2 === 0 ? 0xedd698 : 0xe3cc91;
        strokeColor = 0xcfae67;
      } else {
        // Grass (TILE_GRASS)
        tileColor = (col + row) % 2 === 0 ? 0x7da27e : 0x6e916f; 
        strokeColor = 0x5a7a5b;
      }
      
      const pos = gridToIso(col, row);
      
      if (tileType === TILE_CLIFF) {
        // Render SVG Sprite
        const sprite = new Sprite(cliffTexture);
        sprite.anchor.set(0.5, 1); // Anchor bottom center
        sprite.x = pos.x;
        
        // Scale to exactly match the tile width to form a continuous wall
        sprite.width = tileWidth;
        sprite.scale.y = sprite.scale.x; // Maintain aspect ratio
        
        // Align perfectly with the bottom tip of the isometric diamond
        sprite.y = pos.y + (tileHeight / 2);
        
        sprite.zIndex = pos.y; // Correct isometric depth sorting!
        worldContainer.addChild(sprite);
      } else if (tileType === TILE_PINE) {
        // First draw the grass beneath it
        drawDiamond(terrainGraphics, pos.x, pos.y, 0x7da27e, 0x5a7a5b);
        
        // Draw a natural drop shadow for the tree (offset slightly to simulate sun)
        terrainGraphics.ellipse(pos.x + 15, pos.y, 40, 20);
        terrainGraphics.fill({ color: 0x000000, alpha: 0.4 });
        
        // Then render the Pine Tree Sprite
        const sprite = new Sprite(pineTexture);
        sprite.anchor.set(0.5, 1); // Anchor bottom center
        sprite.x = pos.x;
        
        // Scale to exactly match the tile width
        sprite.width = tileWidth;
        sprite.scale.y = sprite.scale.x; // Maintain aspect ratio
        
        // Align perfectly with the bottom tip of the isometric diamond
        sprite.y = pos.y + (tileHeight / 2);
        
        sprite.zIndex = pos.y; // Make sure it depth sorts correctly!
        worldContainer.addChild(sprite);
        
        // --- Deep Forest Fog ---
        const distToNonTree = getDistToNonTree(col, row);
        if (distToNonTree >= 2) {
          // If 2 tiles deep, light fog. If 3+ tiles deep, heavy fog.
          const forestFog = new Sprite(fogCloudTexture);
          forestFog.anchor.set(0.5, 0.5);
          forestFog.x = pos.x;
          forestFog.y = pos.y - 15; // Center over the tree
          forestFog.scale.set(0.5); // Smaller cloud just for the tree
          forestFog.alpha = Math.min(0.85, (distToNonTree - 1) * 0.35);
          forestFog.zIndex = pos.y + 1; // Overlay precisely on this tree
          worldContainer.addChild(forestFog);
        }
      } else {
        // Render flat diamond terrain
        drawDiamond(terrainGraphics, pos.x, pos.y, tileColor, strokeColor);
      }
    }
  });

  // --- Volumetric Edge Fog Pass ---
  for (let row = -3; row < mapHeight + 3; row++) {
    for (let col = -3; col < mapWidth + 3; col++) {
      let isEmpty = true;
      if (col >= 0 && col < mapWidth && row >= 0 && row < mapHeight) {
        const index = row * mapWidth + col;
        isEmpty = !hasTile[index];
      }
      
      // If the tile is empty (or off-map), check if it's near land
      if (isEmpty) {
        let nearLand = false;
        // Check only a 2-tile radius (keeps the fog tight to the coast)
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const checkCol = col + c;
            const checkRow = row + r;
            if (checkCol >= 0 && checkCol < mapWidth && checkRow >= 0 && checkRow < mapHeight) {
              const index = checkRow * mapWidth + checkCol;
              if (hasTile[index]) {
                nearLand = true;
                break;
              }
            }
          }
          if (nearLand) break;
        }
        
        // Spawn volumetric fog sprites that overlap onto the map edges
        if (nearLand) {
          const pos = gridToIso(col, row);
          const fogSprite = new Sprite(fogCloudTexture);
          fogSprite.anchor.set(0.5, 0.5);
          fogSprite.x = pos.x + (Math.random() * 30 - 15);
          fogSprite.y = pos.y + (Math.random() * 30 - 15);
          
          // Tighter scale so it bleeds exactly ~2 tiles inward
          fogSprite.scale.set(0.8 + Math.random() * 0.4);
          
          // Ensure it floats above the terrain but sorts correctly
          fogSprite.zIndex = pos.y + 300; 
          worldContainer.addChild(fogSprite);
        }
      }
    }
  }

  // Sort everything after initial load
  worldContainer.sortChildren();

  let buildingCount = 0;
  const entities = [];

  function addBuilding(type) {
    const b = new Graphics();
    
    // Draw 3D-looking isometric placeholder building directly in screen space
    
    // Left face
    b.moveTo(0, 0);
    b.lineTo(-30, -15);
    b.lineTo(-30, -45);
    b.lineTo(0, -30);
    b.fill({ color: 0x8b5a2b });
    b.stroke({ color: 0x5c3a19, width: 1 });
    
    // Right face
    b.moveTo(0, 0);
    b.lineTo(30, -15);
    b.lineTo(30, -45);
    b.lineTo(0, -30);
    b.fill({ color: 0x714820 });
    b.stroke({ color: 0x5c3a19, width: 1 });

    // Roof (simple pyramid)
    b.moveTo(-30, -45);
    b.lineTo(0, -30);
    b.lineTo(30, -45);
    b.lineTo(0, -70);
    b.lineTo(-30, -45);
    b.fill({ color: 0x9b6b3c });
    b.stroke({ color: 0x5c3a19, width: 1 });
    
    const col = 7 + (buildingCount % 3);
    const row = 7 + Math.floor(buildingCount / 3);
    
    const pos = gridToIso(col, row);
    b.x = pos.x;
    b.y = pos.y;
    
    // Critical: True Age of Empires Y-Sorting
    b.zIndex = b.y; 
    
    worldContainer.addChild(b);
    entities.push(b);
    buildingCount++;
    
    worldContainer.sortChildren();
  }

  // Restore buildings from state
  state.buildings.forEach(b => {
    addBuilding(b.type);
  });

  // Center the camera initially on the middle of the isometric grid (roughly 0, height/2)
  viewport.moveCenter(0, mapHeight * (tileHeight / 2));
  viewport.setZoom(1);

  // Handle resizing viewport
  window.addEventListener('resize', () => {
    viewport.resize(window.innerWidth, window.innerHeight, 4000, 4000);
  });

  return {
    addBuilding,
    viewport
  };
}
