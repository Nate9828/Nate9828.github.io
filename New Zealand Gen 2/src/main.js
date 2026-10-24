import './style.css';
import { initGameEngine } from './game/engine.js';
import { initState, startGameLoop } from './game/state.js';
import { initUI } from './game/ui.js';

async function bootstrap() {
  console.log('Bootstrapping Aotearoa: Generations...');
  
  // 1. Initialize Game State
  const state = initState();
  
  // 2. Initialize PixiJS Engine
  const engine = await initGameEngine(state);
  
  // 3. Initialize UI Bindings
  initUI(state, engine);
  
  // 4. Start Core Loop
  startGameLoop(state, engine);
}

bootstrap();
