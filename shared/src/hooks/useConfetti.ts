// Canvas-конфетти Celebration (вынесено из парных копий обоих фронтендов —
// правило «одна механика — один компонент»). Возвращает ref для <canvas>;
// анимация сама останавливается и зовёт onDone.
// Нейроинклюзивность: при сниженной анимации (isReducedMotion) конфетти
// не запускается вовсе — карточка закрывается тапом.
import { useEffect, useRef } from 'react';
import { isReducedMotion } from '../utils/reducedMotion';

// Canvas fillStyle не понимает CSS-переменные — только hex
const COLORS = [
  '#ff6b9d',
  '#facc15',
  '#06d6a0',
  '#a78bfa',
  '#4fa3f7',
  '#ff9a3c',
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  vr: number;
  opacity: number;
}

export function useConfetti(onDone: () => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (isReducedMotion()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 100,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
      vr: (Math.random() - 0.5) * 8,
      opacity: 1,
    }));

    let frame = 0;
    function draw() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      frame++;
      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vr;
        if (frame > 60) p.opacity -= 0.015;
        if (p.opacity <= 0 || p.y > canvas!.height) continue;
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (alive) {
        rafRef.current = requestAnimationFrame(draw);
      } else {
        onDone();
      }
    }
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [onDone]);

  return canvasRef;
}
