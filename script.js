// --- CONSTANTS ---
const CONFIG = {
  GRAVITY: 800,
  JUMP_FORCE: 350,
  SPEED_INITIAL: 200,
  MAX_SPEED: 550,
  OBSTACLE_SPAWN_BG: 350, // Distance buffer
  GRAVITY_SWITCH_SECONDS: 12,
  GAP_SIZE: 160,
  COLORS: {
    ship: "#8b5a2b", // brown
    obstacle: "#a0522d", // medium brown / milk chocolate
    shield: "#aed581", // pastel mint/olive
    star: "#6d4c41", // dark coffee dust
    particle: "#e57373", // pastel red
    slow: "#81d4fa", // ice blue
    double: "#fff59d", // butter yellow
    bg: "#e8d8c8", // Latte / Light Mocha
  },
};

const $ = (id) => document.getElementById(id);
const randomRange = (min, max) => Math.random() * (max - min) + min;

// --- AUDIO MANAGER ---
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, vol = 0.1) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.01,
      this.ctx.currentTime + duration,
    );

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playJump() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(300, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playScore() {
    this.playTone(600, "sine", 0.1, 0.05);
  }

  playPowerup() {
    if (!this.ctx) return;
    this.playTone(440, "sine", 0.2, 0.1);
    setTimeout(() => this.playTone(554, "sine", 0.2, 0.1), 100);
    setTimeout(() => this.playTone(659, "sine", 0.4, 0.1), 200);
  }

  playCrash() {
    this.playTone(100, "sawtooth", 0.5, 0.3);
    this.playTone(50, "square", 0.5, 0.3);
  }
}

// --- CLASSES ---

class Particle {
  constructor(x, y, color, speed, direction, life) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = randomRange(2, 5);

    const angle =
      direction !== null
        ? direction + randomRange(-0.5, 0.5)
        : randomRange(0, Math.PI * 2);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    this.size *= 0.95;
  }

  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  spawn(x, y, color, count = 10, speed = 100, direction = null) {
    for (let i = 0; i < count; i++) {
      this.particles.push(
        new Particle(
          x,
          y,
          color,
          speed * randomRange(0.5, 1.5),
          direction,
          randomRange(0.5, 1.0),
        ),
      );
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(dt);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    this.particles.forEach((p) => p.draw(ctx));
  }
}

class PowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 15;
    this.active = true;

    const types = ["shield", "slow", "double"];
    this.type = types[Math.floor(Math.random() * types.length)];

    this.color = "#fff";
    if (this.type === "shield") this.color = CONFIG.COLORS.shield;
    if (this.type === "slow") this.color = CONFIG.COLORS.slow;
    if (this.type === "double") this.color = CONFIG.COLORS.double;

    this.bobOffset = Math.random() * 100;
  }

  update(dt, speed, time) {
    this.x -= speed * dt;
    this.y += Math.sin(time * 3 + this.bobOffset) * 30 * dt; // Bobbing (frame-rate independent)
  }

  draw(ctx) {
    if (!this.active) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;

    // Draw diamond shape
    ctx.beginPath();
    ctx.moveTo(0, -this.radius);
    ctx.lineTo(this.radius, 0);
    ctx.lineTo(0, this.radius);
    ctx.lineTo(-this.radius, 0);
    ctx.closePath();
    ctx.fill();

    // Icon
    ctx.fillStyle = "#000";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let label = "?";
    if (this.type === "shield") label = "S";
    if (this.type === "slow") label = "T";
    if (this.type === "double") label = "X2";
    ctx.fillText(label, 0, 0);

    ctx.restore();
  }
}

class Background {
  constructor(width, height) {
    this.stars = [];
    this.width = width;
    this.height = height;
    this.initStars();
  }

  initStars() {
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.5 + 0.1,
        alpha: Math.random(),
      });
    }
  }

  update(dt, speed) {
    this.stars.forEach((star) => {
      star.x -= speed * star.speed * dt;
      if (star.x < 0) {
        star.x = this.width;
        star.y = Math.random() * this.height;
      }
    });
  }

  draw(ctx) {
    ctx.fillStyle = CONFIG.COLORS.star || "#6d4c41";
    this.stars.forEach((star) => {
      ctx.globalAlpha = star.alpha;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
  }
}

class Obstacle {
  constructor(x, height) {
    this.x = x;
    this.spawnY = height / 2;
    this.gapSize = CONFIG.GAP_SIZE;
    this.width = 60;
    this.passed = false;

    this.oscillationSpeed = randomRange(1, 2.5);
    this.oscillationAmp = randomRange(50, 150);
    this.timeOffset = randomRange(0, 100);

    this.rotation = 0;
    this.rotationSpeed = randomRange(-1.5, 1.5);

    this.polyTop = this.createAsteroidShape(35);
    this.polyBot = this.createAsteroidShape(35);
  }

  createAsteroidShape(radius) {
    const points = [];
    const res = 7;
    for (let i = 0; i < res; i++) {
      const angle = (i / res) * Math.PI * 2;
      const r = radius * randomRange(0.7, 1.3);
      points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    return points;
  }

  update(dt, speed, timeTotal) {
    this.x -= speed * dt;
    this.currentGapY =
      this.spawnY +
      Math.sin(timeTotal * this.oscillationSpeed + this.timeOffset) *
        this.oscillationAmp;
    this.rotation += this.rotationSpeed * dt;
  }

  draw(ctx) {
    ctx.fillStyle = CONFIG.COLORS.obstacle;
    ctx.shadowBlur = 10;
    ctx.shadowColor = CONFIG.COLORS.obstacle;

    this.drawAsteroid(ctx, this.x, this.currentGapY - this.gapSize / 2 - 30);
    this.drawAsteroid(ctx, this.x, this.currentGapY - this.gapSize / 2 - 120);

    this.drawAsteroid(ctx, this.x, this.currentGapY + this.gapSize / 2 + 30);
    this.drawAsteroid(ctx, this.x, this.currentGapY + this.gapSize / 2 + 120);
  }

  drawAsteroid(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.rotation);
    ctx.beginPath();
    this.polyTop.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  checkCollision(player) {
    const r = 28; // Slightly forgiving hitbox
    const hazards = [
      { x: this.x, y: this.currentGapY - this.gapSize / 2 - 30 },
      { x: this.x, y: this.currentGapY - this.gapSize / 2 - 120 },
      { x: this.x, y: this.currentGapY + this.gapSize / 2 + 30 },
      { x: this.x, y: this.currentGapY + this.gapSize / 2 + 120 },
    ];

    for (let h of hazards) {
      const dx = player.x - h.x;
      const dy = player.y - h.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < r + player.radius) return true;
    }
    return false;
  }
}

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.velocity = 0;
    this.radius = 12;
    this.angle = 0;
    this.gravityDirection = 1;
    this.shieldTime = 0;
  }

  jump() {
    this.velocity = -CONFIG.JUMP_FORCE * this.gravityDirection;
  }

  update(dt, height) {
    this.velocity += CONFIG.GRAVITY * this.gravityDirection * dt;
    this.y += this.velocity * dt;

    const targetAngle =
      (this.velocity / 600) * 45 * (Math.PI / 180) * this.gravityDirection;
    this.angle = targetAngle;

    if (this.shieldTime > 0) this.shieldTime -= dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Shield effect
    if (this.shieldTime > 0) {
      ctx.beginPath();
      ctx.strokeStyle = CONFIG.COLORS.shield;
      ctx.lineWidth = 2;
      ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowColor = CONFIG.COLORS.shield;
      ctx.shadowBlur = 10;
      if (this.shieldTime < 1 && Math.floor(Date.now() / 100) % 2 === 0) {
        ctx.lineWidth = 0; // Blink warning
        ctx.strokeStyle = "transparent";
      }
    }

    ctx.rotate(this.angle);

    // --- GRANO DE CAFE (Flat Design) ---

    // 1. Cuerpo del grano de café (marrón oscuro)
    ctx.fillStyle = "#4a2f1d"; // Color de café tostado
    ctx.shadowBlur = 0; // Removido el neón para flat design
    ctx.beginPath();
    // Dibujar un óvalo inclinado o curvado
    ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. La línea central (S-curve) característica del grano
    ctx.strokeStyle = "#2d180c"; // Sombra más oscura
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(12, 0); // Empieza en la punta derecha
    // Curva de Bezier para simular la "S" del grano
    ctx.bezierCurveTo(4, -6, -4, 6, -12, 0);
    ctx.stroke();

    // 3. Pequeño reflejo o brillo (opcional para darle volumen)
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.beginPath();
    ctx.ellipse(0, -6, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 4. (Opcional) Chispas de calor/fuego miniatura atrás
    if (Math.random() > 0.6) {
      ctx.fillStyle = "#ffaa00";
      ctx.beginPath();
      ctx.arc(
        -16 - Math.random() * 5,
        0,
        2 + Math.random() * 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.restore();
  }
}

class Game {
  constructor() {
    this.canvas = $("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.audio = new SoundManager();

    this.state = "START";
    this.paused = false;
    this.resize();

    this.bg = new Background(this.width, this.height);
    this.particles = new ParticleSystem();
    this.player = null;
    this.obstacles = [];
    this.powerups = [];

    this.score = 0;
    this.gameSpeed = CONFIG.SPEED_INITIAL;
    this.gravityTimer = 0;
    this.gravityDir = 1;
    this.distanceTraveled = 0;
    this.gameTime = 0;

    this.modifiers = {
      slowMoTimer: 0,
      doublePointsTimer: 0,
    };

    window.addEventListener("resize", () => this.resize());

    this.handleInput = this.handleInput.bind(this);
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        if (e.repeat) return;
        this.handleInput();
      }
      if (e.code === "KeyP") this.togglePause();
    });
    window.addEventListener(
      "touchstart",
      (e) => {
        // Mobile Fix: Don't preventDefault if targeting a button
        if (e.target.tagName === "BUTTON") return;
        e.preventDefault();
        this.handleInput();
      },
      { passive: false },
    );
    window.addEventListener("mousedown", (e) => {
      if (e.target.tagName !== "BUTTON") this.handleInput();
    });

    $("startBtn").addEventListener("click", () => this.startGame());
    $("restartBtn").addEventListener("click", () => this.resetGame());

    if (!localStorage.getItem("stellarDriftHighScore")) {
      localStorage.setItem("stellarDriftHighScore", 0);
    }

    this.lastTime = 0;
    requestAnimationFrame((t) => this.loop(t));
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    if (this.bg) {
      this.bg.width = this.width;
      this.bg.height = this.height;
    }
  }

  startGame() {
    this.audio.init();
    this.state = "PLAYING";
    this.paused = false;
    this.score = 0;
    this.gameSpeed = CONFIG.SPEED_INITIAL;
    this.gravityTimer = CONFIG.GRAVITY_SWITCH_SECONDS;
    this.gravityDir = 1;
    this.obstacles = [];
    this.powerups = [];
    this.distanceTraveled = 0;
    this.gameTime = 0;
    this.modifiers = { slowMoTimer: 0, doublePointsTimer: 0 };

    this.player = new Player(this.width * 0.2, this.height / 2);

    $("startScreen").classList.add("hidden");
    $("gameOverScreen").classList.add("hidden");
    $("hud").style.display = "block";
    this.updateUI();
  }

  resetGame() {
    this.startGame();
  }

  togglePause() {
    if (this.state === "PLAYING") {
      this.paused = !this.paused;
    }
  }

  handleInput() {
    if (this.state === "PLAYING" && !this.paused && this.player) {
      this.player.jump();
      this.particles.spawn(
        this.player.x - 10,
        this.player.y,
        "rgba(255, 255, 255, 0.6)",
        5,
        50,
        Math.PI,
      );
      this.audio.playJump();
    }
  }

  gameOver() {
    this.state = "GAMEOVER";
    this.audio.playCrash();
    this.particles.spawn(
      this.player.x,
      this.player.y,
      CONFIG.COLORS.particle,
      50,
      200,
    );

    const highScore =
      parseFloat(localStorage.getItem("stellarDriftHighScore")) || 0;
    if (this.score > highScore) {
      localStorage.setItem("stellarDriftHighScore", Math.floor(this.score));
    }

    $("gameOverScreen").classList.remove("hidden");
    $("finalScore").innerText = "Puntuación: " + Math.floor(this.score);
    $("highScoreDisplay").innerText =
      "Mejor: " + localStorage.getItem("stellarDriftHighScore");
    $("hud").style.display = "none";
  }

  updateUI() {
    $("scoreDisplay").innerText = Math.floor(this.score);

    // Powerup indicators
    $("pu-shield").style.display =
      this.player.shieldTime > 0 ? "inline-block" : "none";
    $("pu-slow").style.display =
      this.modifiers.slowMoTimer > 0 ? "inline-block" : "none";
    $("pu-double").style.display =
      this.modifiers.doublePointsTimer > 0 ? "inline-block" : "none";
  }

  update(dt) {
    if (this.paused) return;

    // Time Dilation (Slow Mo)
    let timeScale = 1;
    if (this.modifiers.slowMoTimer > 0) {
      this.modifiers.slowMoTimer -= dt;
      timeScale = 0.5;
    }
    const gameDt = dt * timeScale;

    this.particles.update(dt);

    if (this.state !== "PLAYING") return;

    this.gameTime += gameDt;
    if (this.modifiers.doublePointsTimer > 0)
      this.modifiers.doublePointsTimer -= dt;

    this.bg.update(gameDt, this.gameSpeed);
    this.player.update(gameDt, this.height);

    // Spawning
    this.distanceTraveled += this.gameSpeed * gameDt;
    if (
      this.obstacles.length === 0 ||
      this.width - this.obstacles[this.obstacles.length - 1].x >
        CONFIG.OBSTACLE_SPAWN_BG
    ) {
      this.obstacles.push(new Obstacle(this.width + 100, this.height));

      if (Math.random() < 0.25) {
        this.powerups.push(
          new PowerUp(
            this.width + 100 + CONFIG.OBSTACLE_SPAWN_BG / 2,
            this.height / 2,
          ),
        );
      }
    }

    // Obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.update(gameDt, this.gameSpeed, this.gameTime);

      if (obs.checkCollision(this.player)) {
        if (this.player.shieldTime > 0) {
          this.player.shieldTime = 0;
          this.particles.spawn(
            this.player.x,
            this.player.y,
            CONFIG.COLORS.shield,
            20,
            100,
          );
          this.obstacles.splice(i, 1);
          this.audio.playCrash();
          continue;
        } else {
          this.gameOver();
          return;
        }
      }

      if (!obs.passed && obs.x < this.player.x) {
        obs.passed = true;
        let pts = 10;
        if (this.modifiers.doublePointsTimer > 0) pts *= 2;
        this.score += pts;
        this.audio.playScore();
        // Scale difficulty
        if (this.gameSpeed < CONFIG.MAX_SPEED) {
          this.gameSpeed += 5;
        }
      }

      if (obs.x < -100) this.obstacles.splice(i, 1);
    }

    // Powerups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.update(gameDt, this.gameSpeed, this.gameTime);

      // Collision
      const dx = this.player.x - p.x;
      const dy = this.player.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.player.radius + p.radius) {
        this.audio.playPowerup();
        if (p.type === "shield") this.player.shieldTime = 5;
        if (p.type === "slow") this.modifiers.slowMoTimer = 4;
        if (p.type === "double") this.modifiers.doublePointsTimer = 5;

        this.particles.spawn(p.x, p.y, "#fff", 10, 50);
        this.powerups.splice(i, 1);
        continue;
      }

      if (p.x < -100) this.powerups.splice(i, 1);
    }

    if (
      this.player.y <= this.player.radius ||
      this.player.y >= this.height - this.player.radius
    ) {
      if (this.player.shieldTime > 0) {
        this.player.velocity *= -0.5;
        this.player.y =
          this.player.y <= this.player.radius
            ? this.player.radius + 1
            : this.height - this.player.radius - 1;
        this.player.shieldTime = 0;
        this.particles.spawn(
          this.player.x,
          this.player.y,
          CONFIG.COLORS.shield,
          20,
          100,
        );
        this.audio.playCrash();
      } else {
        this.gameOver();
        return;
      }
    }

    this.updateUI();
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    this.bg.draw(this.ctx);

    this.obstacles.forEach((obs) => obs.draw(this.ctx));
    this.powerups.forEach((p) => p.draw(this.ctx));
    this.particles.draw(this.ctx);

    if (this.state === "PLAYING") {
      if (this.player) this.player.draw(this.ctx);
    } else if (this.state === "GAMEOVER") {
      if (this.player) this.player.draw(this.ctx);
    }

    if (this.paused) {
      this.ctx.fillStyle = "rgba(0,0,0,0.5)";
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.ctx.fillStyle = "#fff";
      this.ctx.font = "30px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText("PAUSADO", this.width / 2, this.height / 2);
    }
  }

  loop(timestamp) {
    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    if (dt > 0.1) dt = 0.1;

    this.update(dt);
    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.onload = () => {
  const game = new Game();
};
