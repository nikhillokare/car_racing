'use client'
import { useRef, useEffect, useState } from "react";

const LANE_COUNT = 3;
const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 600;
const LANE_WIDTH = CANVAS_WIDTH / LANE_COUNT;
const CAR_WIDTH = 50;
const CAR_HEIGHT = 90;
const OBSTACLE_WIDTH = 50;
const OBSTACLE_HEIGHT = 90;
const OBSTACLE_SPEED_START = 4;
const OBSTACLE_SPAWN_INTERVAL = 1000; // ms

// Add constants for fuel
const FUEL_MAX = 100;
const FUEL_DECREASE_RATE = 0.12; // per frame
const FUEL_PICKUP_AMOUNT = 35;
const FUEL_PICKUP_SIZE = 36;
const FUEL_PICKUP_CHANCE = 0.22; // chance to spawn a fuel pickup instead of an obstacle

// Add constants for shield and slow-mo power-ups
const SHIELD_DURATION = 4000; // ms
const SLOWMO_DURATION = 3000; // ms
const POWERUP_PICKUP_SIZE = 36;
const SHIELD_CHANCE = 0.09;
const SLOWMO_CHANCE = 0.09;

const DIFFICULTY_SETTINGS = {
  easy:    { speed: 3,   speedInc: 0.7, spawn: 1200, label: "Easy",  step: 7 },
  medium:  { speed: 4,   speedInc: 1.0, spawn: 900,  label: "Medium", step: 5 },
  hard:    { speed: 5,   speedInc: 1.5, spawn: 600,  label: "Hard",  step: 3 },
};

function drawLanes(ctx, stripeOffset = 0) {
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  // Draw animated stripes
  for (let i = 1; i < LANE_COUNT; i++) {
    ctx.save();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 6;
    ctx.setLineDash([32, 32]);
    ctx.lineDashOffset = stripeOffset;
    ctx.beginPath();
    ctx.moveTo(i * LANE_WIDTH, 0);
    ctx.lineTo(i * LANE_WIDTH, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function drawPlayerCar(ctx, lane, xOverride = null) {
  const x = xOverride !== null ? xOverride : lane * LANE_WIDTH + (LANE_WIDTH - CAR_WIDTH) / 2;
  const y = CANVAS_HEIGHT - CAR_HEIGHT - 20;
  // Car body
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, CAR_WIDTH, CAR_HEIGHT, 16);
  ctx.fillStyle = "#38bdf8"; // Blue player car
  ctx.shadowColor = '#0ea5e9';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 4;
  ctx.stroke();
  // Windshield
  ctx.beginPath();
  ctx.roundRect(x + 10, y + 16, CAR_WIDTH - 20, 24, 6);
  ctx.fillStyle = "#e0f2fe";
  ctx.fill();
  // Wheels
  ctx.fillStyle = "#222";
  ctx.fillRect(x + 6, y + 10, 8, 22);
  ctx.fillRect(x + CAR_WIDTH - 14, y + 10, 8, 22);
  ctx.fillRect(x + 6, y + CAR_HEIGHT - 32, 8, 22);
  ctx.fillRect(x + CAR_WIDTH - 14, y + CAR_HEIGHT - 32, 8, 22);
  ctx.restore();
}

function drawObstacle(ctx, lane, y, color = "#f87171") {
  const x = lane * LANE_WIDTH + (LANE_WIDTH - OBSTACLE_WIDTH) / 2;
  ctx.save();
  // Car body
  ctx.beginPath();
  ctx.roundRect(x, y, OBSTACLE_WIDTH, OBSTACLE_HEIGHT, 14);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 3;
  ctx.stroke();
  // Windshield
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 14, OBSTACLE_WIDTH - 16, 20, 5);
  ctx.fillStyle = "#fef9c3";
  ctx.fill();
  // Wheels
  ctx.fillStyle = "#222";
  ctx.fillRect(x + 5, y + 8, 7, 18);
  ctx.fillRect(x + OBSTACLE_WIDTH - 12, y + 8, 7, 18);
  ctx.fillRect(x + 5, y + OBSTACLE_HEIGHT - 26, 7, 18);
  ctx.fillRect(x + OBSTACLE_WIDTH - 12, y + OBSTACLE_HEIGHT - 26, 7, 18);
  ctx.restore();
}

function drawFuelBar(ctx, fuel) {
  const barWidth = 180;
  const barHeight = 16;
  const x = (CANVAS_WIDTH - barWidth) / 2;
  const y = 16;
  ctx.save();
  ctx.fillStyle = '#222';
  ctx.fillRect(x, y, barWidth, barHeight);
  ctx.fillStyle = fuel > 30 ? '#4ade80' : '#f87171';
  ctx.fillRect(x, y, (fuel / FUEL_MAX) * barWidth, barHeight);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, barWidth, barHeight);
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('FUEL', x + barWidth / 2, y + barHeight - 3);
  ctx.restore();
}

function drawFuelPickup(ctx, lane, y) {
  const x = lane * LANE_WIDTH + (LANE_WIDTH - FUEL_PICKUP_SIZE) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + FUEL_PICKUP_SIZE / 2, y + FUEL_PICKUP_SIZE / 2, FUEL_PICKUP_SIZE / 2, 0, 2 * Math.PI);
  ctx.fillStyle = '#fde047';
  ctx.shadowColor = '#facc15';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#b45309';
  ctx.textAlign = 'center';
  ctx.fillText('⛽', x + FUEL_PICKUP_SIZE / 2, y + FUEL_PICKUP_SIZE / 2 + 7);
  ctx.restore();
}

function drawShieldPickup(ctx, lane, y) {
  const x = lane * LANE_WIDTH + (LANE_WIDTH - POWERUP_PICKUP_SIZE) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + POWERUP_PICKUP_SIZE / 2, y + POWERUP_PICKUP_SIZE / 2, POWERUP_PICKUP_SIZE / 2, 0, 2 * Math.PI);
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#0ea5e9';
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('🛡️', x + POWERUP_PICKUP_SIZE / 2, y + POWERUP_PICKUP_SIZE / 2 + 7);
  ctx.restore();
}

function drawSlowmoPickup(ctx, lane, y) {
  const x = lane * LANE_WIDTH + (LANE_WIDTH - POWERUP_PICKUP_SIZE) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + POWERUP_PICKUP_SIZE / 2, y + POWERUP_PICKUP_SIZE / 2, POWERUP_PICKUP_SIZE / 2, 0, 2 * Math.PI);
  ctx.fillStyle = '#818cf8';
  ctx.shadowColor = '#6366f1';
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('⏳', x + POWERUP_PICKUP_SIZE / 2, y + POWERUP_PICKUP_SIZE / 2 + 7);
  ctx.restore();
}

function isCollision(playerLane, obstacles) {
  const playerY = CANVAS_HEIGHT - CAR_HEIGHT - 20;
  for (const obs of obstacles) {
    if (obs.lane === playerLane) {
      // Check vertical overlap
      if (
        obs.y + OBSTACLE_HEIGHT > playerY &&
        obs.y < playerY + CAR_HEIGHT
      ) {
        return true;
      }
    }
  }
  return false;
}

export default function Game() {
  const canvasRef = useRef(null);
  const [playerLane, setPlayerLane] = useState(1); // Start in center lane
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [difficulty, setDifficulty] = useState(null); // null = not chosen
  const [fuel, setFuel] = useState(FUEL_MAX);
  const [highScore, setHighScore] = useState(() => {
    if (typeof window !== 'undefined') {
      return Number(localStorage.getItem('highScore') || 0);
    }
    return 0;
  });
  const [shieldActive, setShieldActive] = useState(false);
  const [shieldEnd, setShieldEnd] = useState(0);
  const [slowmoActive, setSlowmoActive] = useState(false);
  const [slowmoEnd, setSlowmoEnd] = useState(0);
  const [carX, setCarX] = useState(() => 1 * LANE_WIDTH + (LANE_WIDTH - CAR_WIDTH) / 2);
  const carXRef = useRef(carX);

  // Obstacles state (not using React state for performance)
  const obstaclesRef = useRef([]);
  const fuelPickupsRef = useRef([]);
  const speedRef = useRef(4);
  const speedIncRef = useRef(0.05);
  const spawnIntervalRef = useRef(1000);
  const lastSpawnRef = useRef(Date.now());
  const animationRef = useRef();
  const startTimeRef = useRef();
  const playerLaneRef = useRef(playerLane);
  const fuelRef = useRef(fuel);
  const shieldPickupsRef = useRef([]);
  const slowmoPickupsRef = useRef([]);
  const stripeOffsetRef = useRef(0);

  useEffect(() => { fuelRef.current = fuel; }, [fuel]);

  // Keep playerLaneRef in sync with playerLane
  useEffect(() => {
    playerLaneRef.current = playerLane;
  }, [playerLane]);

  // Animate car X position on lane change
  useEffect(() => {
    const targetX = playerLane * LANE_WIDTH + (LANE_WIDTH - CAR_WIDTH) / 2;
    let animFrame;
    function animate() {
      const current = carXRef.current;
      const diff = targetX - current;
      if (Math.abs(diff) < 0.3) {
        carXRef.current = targetX;
        setCarX(targetX);
        return;
      }
      const next = current + diff * 0.55;
      carXRef.current = next;
      setCarX(next);
      animFrame = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(animFrame);
  }, [playerLane]);

  // Draw everything
  function draw() {
    const ctx = canvasRef.current.getContext("2d");
    drawLanes(ctx, stripeOffsetRef.current);
    drawFuelBar(ctx, fuelRef.current);
    // Draw obstacles
    for (const obs of obstaclesRef.current) {
      drawObstacle(ctx, obs.lane, obs.y, obs.color);
    }
    // Draw fuel pickups
    for (const fp of fuelPickupsRef.current) {
      drawFuelPickup(ctx, fp.lane, fp.y);
    }
    // Draw shield pickups
    for (const sp of shieldPickupsRef.current) {
      drawShieldPickup(ctx, sp.lane, sp.y);
    }
    // Draw slowmo pickups
    for (const smp of slowmoPickupsRef.current) {
      drawSlowmoPickup(ctx, smp.lane, smp.y);
    }
    // Draw player car (with shield effect)
    if (shieldActive) {
      ctx.save();
      const lane = playerLaneRef.current;
      const x = carXRef.current + CAR_WIDTH / 2;
      const y = CANVAS_HEIGHT - CAR_HEIGHT - 20 + CAR_HEIGHT / 2;
      ctx.beginPath();
      ctx.arc(x, y, CAR_WIDTH / 1.6, 0, 2 * Math.PI);
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#0ea5e9';
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    drawPlayerCar(ctx, playerLaneRef.current, carXRef.current);
    // Slow-mo overlay
    if (slowmoActive) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#818cf8';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  // Game loop
  useEffect(() => {
    if (gameOver || !difficulty) return;
    const settings = DIFFICULTY_SETTINGS[difficulty];
    obstaclesRef.current = [];
    fuelPickupsRef.current = [];
    shieldPickupsRef.current = [];
    slowmoPickupsRef.current = [];
    speedRef.current = settings.speed;
    speedIncRef.current = settings.speedInc;
    spawnIntervalRef.current = settings.spawn;
    lastSpawnRef.current = Date.now();
    startTimeRef.current = Date.now();
    setScore(0);
    setFuel(FUEL_MAX);
    setShieldActive(false);
    setSlowmoActive(false);
    setShieldEnd(0);
    setSlowmoEnd(0);
    stripeOffsetRef.current = 0;
    let dodged = 0;

    function loop() {
      const now = Date.now();
      // Move obstacles
      const speed = slowmoActive ? speedRef.current * 0.45 : speedRef.current;
      obstaclesRef.current.forEach(obs => {
        obs.y += speed;
      });
      // Move fuel pickups
      fuelPickupsRef.current.forEach(fp => {
        fp.y += speed;
      });
      // Move shield pickups
      shieldPickupsRef.current.forEach(sp => {
        sp.y += speed;
      });
      // Move slowmo pickups
      slowmoPickupsRef.current.forEach(smp => {
        smp.y += speed;
      });
      // Animate stripes
      stripeOffsetRef.current += speed;
      if (stripeOffsetRef.current > 64) stripeOffsetRef.current -= 64;
      // Remove off-screen obstacles
      let before = obstaclesRef.current.length;
      obstaclesRef.current = obstaclesRef.current.filter(obs => obs.y < CANVAS_HEIGHT);
      let after = obstaclesRef.current.length;
      if (before > after) {
        dodged += before - after;
        setScore(dodged);
        // Increase speed every N dodges (step)
        if (dodged % settings.step === 0) {
          speedRef.current += speedIncRef.current;
        }
      }
      // Remove off-screen pickups
      fuelPickupsRef.current = fuelPickupsRef.current.filter(fp => fp.y < CANVAS_HEIGHT);
      shieldPickupsRef.current = shieldPickupsRef.current.filter(sp => sp.y < CANVAS_HEIGHT);
      slowmoPickupsRef.current = slowmoPickupsRef.current.filter(smp => smp.y < CANVAS_HEIGHT);
      // Spawn new obstacle or pickup
      if (now - lastSpawnRef.current > spawnIntervalRef.current) {
        const lane = Math.floor(Math.random() * LANE_COUNT);
        const r = Math.random();
        if (r < FUEL_PICKUP_CHANCE) {
          fuelPickupsRef.current.push({ lane, y: -FUEL_PICKUP_SIZE });
        } else if (r < FUEL_PICKUP_CHANCE + SHIELD_CHANCE) {
          shieldPickupsRef.current.push({ lane, y: -POWERUP_PICKUP_SIZE });
        } else if (r < FUEL_PICKUP_CHANCE + SHIELD_CHANCE + SLOWMO_CHANCE) {
          slowmoPickupsRef.current.push({ lane, y: -POWERUP_PICKUP_SIZE });
        } else {
          const colors = ["#f87171", "#fbbf24", "#34d399", "#818cf8", "#f472b6"];
          const color = colors[Math.floor(Math.random() * colors.length)];
          obstaclesRef.current.push({ lane, y: -OBSTACLE_HEIGHT, color });
        }
        lastSpawnRef.current = now;
      }
      // Collision detection (obstacles)
      if (isCollision(playerLaneRef.current, obstaclesRef.current)) {
        if (shieldActive) {
          // Remove the first colliding obstacle
          const playerY = CANVAS_HEIGHT - CAR_HEIGHT - 20;
          for (let i = 0; i < obstaclesRef.current.length; i++) {
            const obs = obstaclesRef.current[i];
            if (
              obs.lane === playerLaneRef.current &&
              obs.y + OBSTACLE_HEIGHT > playerY &&
              obs.y < playerY + CAR_HEIGHT
            ) {
              obstaclesRef.current.splice(i, 1);
              break;
            }
          }
        } else {
          setGameOver(true);
          setHighScore(prev => {
            if (dodged > prev) {
              localStorage.setItem('highScore', dodged);
              return dodged;
            }
            return prev;
          });
          return;
        }
      }
      // Collision detection (fuel pickups)
      for (let i = 0; i < fuelPickupsRef.current.length; i++) {
        const fp = fuelPickupsRef.current[i];
        if (
          fp.lane === playerLaneRef.current &&
          fp.y + FUEL_PICKUP_SIZE > CANVAS_HEIGHT - CAR_HEIGHT - 20 &&
          fp.y < CANVAS_HEIGHT - 20
        ) {
          setFuel(fuel => Math.min(FUEL_MAX, fuel + FUEL_PICKUP_AMOUNT));
          fuelPickupsRef.current.splice(i, 1);
          break;
        }
      }
      // Collision detection (shield pickups)
      for (let i = 0; i < shieldPickupsRef.current.length; i++) {
        const sp = shieldPickupsRef.current[i];
        if (
          sp.lane === playerLaneRef.current &&
          sp.y + POWERUP_PICKUP_SIZE > CANVAS_HEIGHT - CAR_HEIGHT - 20 &&
          sp.y < CANVAS_HEIGHT - 20
        ) {
          setShieldActive(true);
          setShieldEnd(Date.now() + SHIELD_DURATION);
          shieldPickupsRef.current.splice(i, 1);
          break;
        }
      }
      // Collision detection (slowmo pickups)
      for (let i = 0; i < slowmoPickupsRef.current.length; i++) {
        const smp = slowmoPickupsRef.current[i];
        if (
          smp.lane === playerLaneRef.current &&
          smp.y + POWERUP_PICKUP_SIZE > CANVAS_HEIGHT - CAR_HEIGHT - 20 &&
          smp.y < CANVAS_HEIGHT - 20
        ) {
          setSlowmoActive(true);
          setSlowmoEnd(Date.now() + SLOWMO_DURATION);
          slowmoPickupsRef.current.splice(i, 1);
          break;
        }
      }
      // Decrease fuel
      setFuel(fuel => {
        const next = fuel - FUEL_DECREASE_RATE;
        if (next <= 0) {
          setGameOver(true);
          setHighScore(prev => {
            if (dodged > prev) {
              localStorage.setItem('highScore', dodged);
              return dodged;
            }
            return prev;
          });
          return 0;
        }
        return next;
      });
      // Power-up timers
      if (shieldActive && Date.now() > shieldEnd) setShieldActive(false);
      if (slowmoActive && Date.now() > slowmoEnd) setSlowmoActive(false);
      draw();
      animationRef.current = requestAnimationFrame(loop);
    }
    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
    // eslint-disable-next-line
  }, [gameOver, difficulty, shieldActive, slowmoActive]);

  // Redraw on lane change
  useEffect(() => {
    if (!gameOver && difficulty) draw();
    // eslint-disable-next-line
  }, [playerLane, gameOver, difficulty, fuel]);

  // Keyboard and swipe controls
  useEffect(() => {
    if (gameOver || !difficulty) return;
    function handleKeyDown(e) {
      if (e.key === "ArrowLeft") {
        setPlayerLane(lane => Math.max(0, lane - 1));
      } else if (e.key === "ArrowRight") {
        setPlayerLane(lane => Math.min(LANE_COUNT - 1, lane + 1));
      }
    }
    window.addEventListener("keydown", handleKeyDown);

    // Swipe controls
    let touchStartX = null;
    let touchStartY = null;
    function handleTouchStart(e) {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }
    function handleTouchEnd(e) {
      if (touchStartX === null) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) {
          setPlayerLane(lane => Math.max(0, lane - 1)); // swipe left
        } else {
          setPlayerLane(lane => Math.min(LANE_COUNT - 1, lane + 1)); // swipe right
        }
      }
      touchStartX = null;
      touchStartY = null;
    }
    const canvas = canvasRef.current;
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, [gameOver, difficulty]);

  // Arrow button handlers
  function handleLeft() {
    setPlayerLane(lane => Math.max(0, lane - 1));
  }
  function handleRight() {
    setPlayerLane(lane => Math.min(LANE_COUNT - 1, lane + 1));
  }

  // Restart game
  function handleRestart() {
    setGameOver(false);
    setPlayerLane(1);
    setScore(0);
    setFuel(FUEL_MAX);
  }

  function handleChooseDifficulty(mode) {
    setDifficulty(mode);
    setGameOver(false);
    setPlayerLane(1);
    setScore(0);
    setFuel(FUEL_MAX);
  }

  // Difficulty selection UI
  if (!difficulty) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-2xl font-bold mb-6">Choose Difficulty</div>
        <div className="flex gap-6">
          {Object.entries(DIFFICULTY_SETTINGS).map(([key, val]) => (
            <button
              key={key}
              className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg transition"
              onClick={() => handleChooseDifficulty(key)}
            >
              {val.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{ borderRadius: 16, boxShadow: "0 4px 32px #0007" }}
      />
      {/* Arrow buttons for mobile */}
      <div className="flex w-full justify-between max-w-[360px] mt-4 sm:hidden">
        <button
          aria-label="Move Left"
          className="bg-gray-800 text-white rounded-full w-16 h-16 flex items-center justify-center text-3xl shadow active:bg-gray-700"
          onClick={handleLeft}
        >
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="18" cy="18" r="18" fill="#222" />
            <path d="M22 10L14 18L22 26" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          aria-label="Move Right"
          className="bg-gray-800 text-white rounded-full w-16 h-16 flex items-center justify-center text-3xl shadow active:bg-gray-700"
          onClick={handleRight}
        >
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="18" cy="18" r="18" fill="#222" />
            <path d="M14 10L22 18L14 26" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      <div className="mt-4 text-white text-lg font-bold tracking-wide">Endless Traffic Dodger</div>
      <div className="mt-2 text-gray-400 text-sm">Use 1213 arrow keys to move</div>
      <div className="mt-2 text-yellow-300 text-xl font-mono">Score: {score}</div>
      <div className="mt-2 text-blue-300 text-base">Mode: {DIFFICULTY_SETTINGS[difficulty].label}</div>
      <div className="mt-2 text-green-300 text-base">High Score: {highScore}</div>
      <div className="mt-2 text-base flex gap-4">
        {shieldActive && <span className="text-cyan-300 font-bold">🛡️ Shield!</span>}
        {slowmoActive && <span className="text-indigo-300 font-bold">⏳ Slow-mo!</span>}
      </div>
      {gameOver && (
        <div className="mt-6 flex flex-col items-center">
          <div className="text-red-400 text-2xl font-bold mb-2">Game Over!</div>
          <button
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-full font-bold mt-2 shadow"
            onClick={handleRestart}
          >
            Restart
          </button>
          <div className="mt-4 flex gap-4">
            {Object.entries(DIFFICULTY_SETTINGS).map(([key, val]) => (
              <button
                key={key}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-base shadow"
                onClick={() => handleChooseDifficulty(key)}
              >
                {val.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 