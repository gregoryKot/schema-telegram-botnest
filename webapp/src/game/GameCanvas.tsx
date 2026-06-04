import { useRef, useEffect, useState, useCallback } from 'react';
import type { GameState, InputState } from './types';
import { createWorld, update, dismissEnemy } from './engine';
import { drawGame, CANVAS_W, CANVAS_H } from './draw';
import { PauseCard } from './PauseCard';
import { TouchControls } from './TouchControls';
import { obstacleMap, OBSTACLES } from './obstacles';

const isMobile = () => window.innerWidth < 700 || 'ontouchstart' in window;

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createWorld(1));
  const inputRef = useRef<InputState>({ left: false, right: false, jump: false, jumpPressed: false });
  const rafRef = useRef<number>(0);
  const lastTRef = useRef<number>(0);
  const onHitRef = useRef<(id: string) => void>(() => {});

  const [pausedId, setPausedId] = useState<string | null>(null);
  const [world, setWorld] = useState<1 | 2 | 3>(1);
  const [showVictory, setShowVictory] = useState(false);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') inputRef.current.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') inputRef.current.right = true;
      if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') && !e.repeat) {
        inputRef.current.jump = true;
        inputRef.current.jumpPressed = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') inputRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') inputRef.current.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') inputRef.current.jump = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Touch control handlers
  const setLeft = useCallback((v: boolean) => { inputRef.current.left = v; }, []);
  const setRight = useCallback((v: boolean) => { inputRef.current.right = v; }, []);
  const doJump = useCallback(() => { inputRef.current.jumpPressed = true; }, []);

  // Hit callback wired to React state
  onHitRef.current = (id: string) => setPausedId(id);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    function loop(t: number) {
      const dt = Math.min((t - lastTRef.current) / 1000, 0.05);
      lastTRef.current = t;

      const state = stateRef.current;

      if (state.phase === 'playing') {
        update(state, dt, inputRef.current, (id) => onHitRef.current(id));
        inputRef.current.jumpPressed = false; // consume edge
      }

      if (state.phase === 'victory') {
        // handled in React via useEffect below
      }

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      drawGame(ctx, state);

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Watch for victory
  useEffect(() => {
    const id = setInterval(() => {
      if (stateRef.current.phase === 'victory') {
        clearInterval(id);
        const nextWorld = (stateRef.current.world + 1) as 1 | 2 | 3;
        if (nextWorld > 3) {
          setShowVictory(true);
        } else {
          stateRef.current = createWorld(nextWorld);
          setWorld(nextWorld);
        }
      }
    }, 200);
    return () => clearInterval(id);
  }, [world]);

  function handleContinue() {
    dismissEnemy(stateRef.current);
    setPausedId(null);
  }

  const obstacle = pausedId ? obstacleMap[pausedId] : null;
  const worldEnemies = OBSTACLES.filter(o => o.world === stateRef.current.world);
  const understood = stateRef.current.enemies.filter(e => e.understood).length;

  if (showVictory) {
    return <VictoryScreen />;
  }

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: CANVAS_W }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ width: '100%', display: 'block', borderRadius: 12, imageRendering: 'pixelated' }}
      />
      {obstacle && (
        <PauseCard
          obstacle={obstacle}
          onContinue={handleContinue}
          understood={understood}
          total={worldEnemies.length}
        />
      )}
      {isMobile() && !pausedId && (
        <TouchControls onLeft={setLeft} onRight={setRight} onJump={doJump} />
      )}
    </div>
  );
}

function VictoryScreen() {
  return (
    <div style={{
      width: '100%', maxWidth: CANVAS_W,
      height: CANVAS_H, borderRadius: 12,
      background: 'linear-gradient(135deg, #f5f2eb 0%, #e8e0f0 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 32, textAlign: 'center',
    }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontSize: 28, fontWeight: 700, color: '#1c1916', margin: '0 0 12px' }}>
        Ты прошёл все три мира
      </h2>
      <p style={{ fontSize: 16, color: 'rgba(28,25,20,0.65)', lineHeight: 1.7, maxWidth: 360, margin: '0 0 28px' }}>
        Ты встретил 15 схем и барьеров на пути к терапии.
        В жизни они тоже встретятся — и теперь ты знаешь их имена.
      </p>
      <a
        href="https://schemalab.ru/#therapist"
        style={{
          padding: '14px 32px', background: '#4d4799', color: '#fff',
          borderRadius: 12, textDecoration: 'none',
          fontSize: 16, fontWeight: 700,
        }}
      >
        Найти своего терапевта →
      </a>
    </div>
  );
}
