/* ---------------------------------------------------------
   ESCAPE MODE (portrait) — endless survival, no win state
--------------------------------------------------------- */
const escapeGame = {
  state: 'idle', // idle | playing | over
  score:0, best:0, crystals:0,
  lives:3, maxLives:3,
  t:0, spawnTimer:0, spawnInterval:900,
  invuln:0,
  player:{x:0,y:0,r:16,vx:0,vy:0},
  rocks:[], gems:[], particles:[],

  start(){
    this.state='playing'; this.score=0; this.crystals=0; this.lives=this.maxLives;
    this.t=0; this.spawnTimer=0; this.spawnInterval=900; this.invuln=0;
    this.rocks=[]; this.gems=[]; this.particles=[];
    this.player.x = W/2; this.player.y = H - Math.max(90, H*0.14); this.player.vx=0; this.player.vy=0;
    renderHUD();
  },
  hit(){
    if(this.invuln>0) return;
    this.lives--; this.invuln=1400;
    for(let i=0;i<18;i++) this.particles.push(spark(this.player.x,this.player.y,'var(--player)'));
    if(this.lives<=0){
      this.state='over';
      this.score = Math.floor(this.score);
      this.best = Math.max(this.best, this.score);
      showEscapeGameOver();
    }
    renderHUD();
  },
  update(dt){
    if(this.state!=='playing') return;
    this.t += dt;
    if(this.invuln>0) this.invuln -= dt;

    // difficulty ramp
    this.spawnInterval = clamp(900 - this.t*0.02, 220, 900);
    this.spawnTimer += dt;
    if(this.spawnTimer > this.spawnInterval){
      this.spawnTimer = 0;
      const isGem = Math.random() < 0.22;
      const x = rand(30, W-30);
      if(isGem) this.gems.push({x,y:-20,r:9,vy:rand(140,200)});
      else {
        const r = rand(14,30);
        const pts = 7;
        const offsets = [];
        for(let i=0; i<pts; i++) offsets.push(rand(0.75, 1.08));
        this.rocks.push({x,y:-30,r,vy:rand(120,260)+this.t*0.01, rot:rand(0,7), vr:rand(-2,2), offsets});
      }
    }

    // player movement (follows mouse/finger or keyboard)
    const targetSpeed = 750;
    const keyActive = input.keys['arrowleft']||input.keys['a']||input.keys['arrowright']||input.keys['d']||input.keys['arrowup']||input.keys['w']||input.keys['arrowdown']||input.keys['s'];
    if(keyActive) input.mouseActive = false;

    if(!keyActive && input.mouseActive && input.x != null){
      const dx = input.x - this.player.x;
      this.player.vx = clamp(dx*10, -targetSpeed, targetSpeed);
    } else if(!keyActive){
      this.player.vx *= 0.9;
    }

    if(!keyActive && input.mouseActive && input.y != null){
      const dy = input.y - this.player.y;
      this.player.vy = clamp(dy*10, -targetSpeed, targetSpeed);
    } else if(!keyActive){
      this.player.vy = (this.player.vy||0) * 0.9;
    }

    if(keyActive){
      let kx = 0, ky = 0;
      if(input.keys['arrowleft']||input.keys['a']) kx -= 1;
      if(input.keys['arrowright']||input.keys['d']) kx += 1;
      if(input.keys['arrowup']||input.keys['w']) ky -= 1;
      if(input.keys['arrowdown']||input.keys['s']) ky += 1;

      const keySpeed = 460;
      const norm = (kx !== 0 && ky !== 0) ? Math.SQRT1_2 : 1;
      this.player.vx = kx * keySpeed * norm;
      this.player.vy = ky * keySpeed * norm;
    }

    this.player.x = clamp(this.player.x + this.player.vx*dt/1000, 24, W-24);
    this.player.y = clamp(this.player.y + (this.player.vy||0)*dt/1000, HUD_HEIGHT + 24, H-24);

    // score over time
    this.score += dt*0.01;

    // rocks & trail particles
    for(const r of this.rocks){
      r.y += r.vy*dt/1000; r.rot += r.vr*dt/1000;
      if(Math.random() < 0.3){
        this.particles.push({
          x: r.x + rand(-r.r*0.4, r.r*0.4),
          y: r.y - r.r*0.6,
          vx: rand(-15, 15),
          vy: -rand(30, 70),
          life: rand(160, 320),
          maxLife: 320,
          color: Math.random()<0.5 ? 'var(--hazard)' : 'var(--hazard-2)'
        });
      }
    }
    this.rocks = this.rocks.filter(r=>{
      if(r.y - r.r > H) return false;
      if(dist2(r.x,r.y,this.player.x,this.player.y) < (r.r+this.player.r*0.7)**2){
        this.hit(); return false;
      }
      return true;
    });

    // gems
    for(const g of this.gems){ g.y += g.vy*dt/1000; }
    this.gems = this.gems.filter(g=>{
      if(g.y - g.r > H) return false;
      if(dist2(g.x,g.y,this.player.x,this.player.y) < (g.r+this.player.r*0.7)**2){
        this.score += 40; this.crystals++;
        for(let i=0;i<10;i++) this.particles.push(spark(g.x,g.y,'var(--energy)'));
        return false;
      }
      return true;
    });

    updateParticles(this.particles, dt);
    if(Math.floor(this.t/150)%4===0) { /* noop, throttling placeholder */ }
    renderHUDNumbers();
  },
  draw(){
    // player ship
    const p=this.player;
    ctx.save();
    ctx.translate(p.x,p.y);
    const blink = this.invuln>0 && Math.floor(this.invuln/100)%2===0;
    ctx.globalAlpha = blink?0.35:1;
    ctx.rotate(clamp(p.vx*0.0009,-0.5,0.5));
    drawEscapeShip(ctx, p.r, getComputedColor('--player'), p.vx, p.vy, this.t/1000);
    ctx.restore();
    ctx.globalAlpha=1;

    for(const r of this.rocks){
      // Speed & Atmospheric Friction Trail (facing upward behind falling rock)
      ctx.save();
      ctx.translate(r.x, r.y);
      const streakLen = r.r * 1.5 + (r.vy * 0.08);
      const g = ctx.createLinearGradient(0, 0, 0, -streakLen);
      g.addColorStop(0, 'rgba(77, 216, 255, 0.28)');
      g.addColorStop(0.4, 'rgba(124, 92, 255, 0.16)');
      g.addColorStop(1, 'rgba(124, 92, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-r.r * 0.7, 0);
      ctx.lineTo(r.r * 0.7, 0);
      ctx.lineTo(r.r * 0.15, -streakLen);
      ctx.lineTo(-r.r * 0.15, -streakLen);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Rotating Rock Body
      ctx.save(); ctx.translate(r.x,r.y); ctx.rotate(r.rot);
      drawRock(ctx, r);
      ctx.restore();
    }
    for(const g of this.gems){
      drawGem(ctx, g.x, g.y, g.r);
    }
    drawParticles(ctx, this.particles);
  }
};

function renderHUDNumbers(){
  const s = document.getElementById('hv-score');
  if(s) s.textContent = Math.floor(escapeGame.score);
  const h = document.getElementById('hearts');
  if(h) h.innerHTML = heartsHTML(escapeGame.lives, escapeGame.maxLives);
}

function showEscapeGameOver(){
  panel.innerHTML = `
    <h1 class="title loss-title">RUN OVER</h1>
    <div id="gate">${gateSVG('escape')}</div>
    <div class="stat-row">
      <div class="stat"><span class="num">${escapeGame.score}</span><span class="lbl">Score</span></div>
      <div class="stat"><span class="num">${escapeGame.best}</span><span class="lbl">Best</span></div>
      <div class="stat"><span class="num">${escapeGame.crystals}</span><span class="lbl">Crystals</span></div>
    </div>
    <p class="desc">The wreckage got you this time. There's always another run.</p>
    <button id="btn-retry">Try Again</button>
  `;
  overlay.classList.remove('hidden');
  document.getElementById('btn-retry').addEventListener('click', ()=>{
    if (typeof requestFullscreenMode === 'function') requestFullscreenMode();
    overlay.classList.add('hidden'); escapeGame.start();
  });
}

/* ---------------------------------------------------------
   Sprite drawing for Escape Mode
--------------------------------------------------------- */
function drawEscapeShip(ctx, r, color, vx, vy, t){
  ctx.save();

  const pulse = Math.sin((t || 0) * 12) * 0.15 + 0.85;
  const accentColor = getComputedColor('--hazard'); // Cyan/Blue energy accent

  // Dual Thruster Plumes (Rear -Y direction facing down)
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 14 * pulse;
  ctx.fillStyle = color;
  ctx.beginPath();
  const flame1 = r * (0.8 + Math.random() * 0.4);
  const flame2 = r * (0.8 + Math.random() * 0.4);
  // Left Engine Flame
  ctx.moveTo(-r * 0.4, r * 0.6);
  ctx.lineTo(-r * 0.3, r * 0.6 + flame1);
  ctx.lineTo(-r * 0.2, r * 0.6);
  // Right Engine Flame
  ctx.moveTo(r * 0.2, r * 0.6);
  ctx.lineTo(r * 0.3, r * 0.6 + flame2);
  ctx.lineTo(r * 0.4, r * 0.6);
  ctx.fill();
  ctx.restore();

  // Main Outer Wing Silhouette & Metallic Armor
  ctx.shadowColor = color;
  ctx.shadowBlur = 18 * pulse;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.fillStyle = '#0a0b16';

  ctx.beginPath();
  ctx.moveTo(0, -r * 1.65);                 // Needle nose tip
  ctx.lineTo(-r * 0.35, -r * 0.6);
  ctx.lineTo(-r * 1.35, r * 0.7);          // Left wingtip
  ctx.lineTo(-r * 1.1, r * 0.85);         // Left stabilizer fin
  ctx.lineTo(-r * 0.45, r * 0.55);
  ctx.lineTo(0, r * 0.8);                   // Rear center tail
  ctx.lineTo(r * 0.45, r * 0.55);
  ctx.lineTo(r * 1.1, r * 0.85);          // Right stabilizer fin
  ctx.lineTo(r * 1.35, r * 0.7);           // Right wingtip
  ctx.lineTo(r * 0.35, -r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner Armor Panel Plates
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#26183b';
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.1);
  ctx.lineTo(-r * 0.6, r * 0.2);
  ctx.lineTo(0, r * 0.4);
  ctx.lineTo(r * 0.6, r * 0.2);
  ctx.closePath();
  ctx.fill();

  // Wing Neon Energy Lines
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, -r * 0.5); ctx.lineTo(-r * 1.1, r * 0.5);
  ctx.moveTo(r * 0.35, -r * 0.5); ctx.lineTo(r * 1.1, r * 0.5);
  ctx.stroke();

  // Glowing Cyan Cockpit Canopy
  ctx.shadowColor = accentColor;
  ctx.shadowBlur = 12;
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.7);
  ctx.lineTo(-r * 0.25, -r * 0.1);
  ctx.lineTo(0, r * 0.2);
  ctx.lineTo(r * 0.25, -r * 0.1);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawRock(ctx,rock){
  ctx.save();
  const r = typeof rock === 'object' ? rock.r : rock;
  const offsets = (typeof rock === 'object' && rock.offsets) ? rock.offsets : [0.9, 1.05, 0.8, 1.0, 0.85, 1.05, 0.95];
  const pts = offsets.length;

  ctx.fillStyle = '#4a4f68';
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for(let i=0;i<pts;i++){
    const a = (i/pts) * Math.PI * 2;
    const rr = r * offsets[i];
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Fixed inner crater detail lines
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.2);
  ctx.lineTo(r * 0.1, r * 0.1);
  ctx.lineTo(-r * 0.1, r * 0.4);
  ctx.stroke();

  ctx.restore();
}

function drawGem(ctx,x,y,r){
  ctx.save();
  ctx.translate(x,y);
  const c = getComputedColor('--energy');
  ctx.shadowColor=c; ctx.shadowBlur=14;
  ctx.fillStyle=c;
  ctx.beginPath();
  ctx.moveTo(0,-r); ctx.lineTo(r*0.8,0); ctx.lineTo(0,r); ctx.lineTo(-r*0.8,0);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
