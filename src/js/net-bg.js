(function() {
  const canvas = document.getElementById('net-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let particles = [];
  let animationFrameId;
  let surge = 0; // Surge factor from 0 (resting) to 1.2 (peak energy trigger)

  // Configuration
  const particleCount = 65; // Balanced count for elegant density and high FPS
  const maxDistance = 120;  // Standard link distance
  const baseSpeed = 0.35;   // Slow, subtle drifting speed

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  class Particle {
    constructor() {
      this.x = Math.random() * window.innerWidth;
      this.y = Math.random() * window.innerHeight;
      this.vx = (Math.random() - 0.5) * baseSpeed;
      this.vy = (Math.random() - 0.5) * baseSpeed;
      this.radius = Math.random() * 1.2 + 0.8;
    }

    update() {
      // Speed up particles during a scroll surge
      const currentSpeedMultiplier = 1 + (surge * 4.5);
      this.x += this.vx * currentSpeedMultiplier;
      this.y += this.vy * currentSpeedMultiplier;

      // Bounce edges
      if (this.x < 0 || this.x > canvas.width) this.vx = -this.vx;
      if (this.y < 0 || this.y > canvas.height) this.vy = -this.vy;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      // Brighten nodes slightly during a surge
      const alpha = 0.25 + (surge * 0.3);
      ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
      ctx.fill();
    }
  }

  function init() {
    resizeCanvas();
    particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }
  }

  function drawLines() {
    // Expand link range slightly during a surge
    const currentMaxDistance = maxDistance * (1 + surge * 0.25);

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < currentMaxDistance) {
          // Increase line brightness and thickness during a surge
          const baseAlpha = (1 - dist / currentMaxDistance) * 0.08;
          const alpha = baseAlpha * (1 + surge * 2.2); 
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
          ctx.lineWidth = 0.8 + (surge * 0.4);
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Decay the scroll surge energy smoothly back to 0
    if (surge > 0) {
      surge -= 0.025; // Takes about 40-50 frames (~0.8 seconds) to decay fully
      if (surge < 0) surge = 0;
    }

    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();
    }

    drawLines();

    animationFrameId = requestAnimationFrame(animate);
  }

  // Event Listeners
  window.addEventListener('resize', () => {
    const prevWidth = canvas.width;
    const prevHeight = canvas.height;
    resizeCanvas();
    particles.forEach(p => {
      p.x = (p.x / prevWidth) * canvas.width;
      p.y = (p.y / prevHeight) * canvas.height;
    });
  });

  // Listen for the custom border-pulse scroll hit event
  window.addEventListener('border-pulse-trigger', () => {
    surge = 1.2; // Set surge to peak value (slight overshoot for dynamic entry)
  });

  // Init and Start
  init();
  animate();
})();
