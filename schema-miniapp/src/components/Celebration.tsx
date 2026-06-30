import { useEffect, useRef, useState } from 'react';

// Canvas fillStyle не понимает CSS-переменные — только hex
const COLORS = ['#ff6b9d', '#facc15', '#06d6a0', '#a78bfa', '#4fa3f7', '#ff9a3c'];

const MILESTONE_TEXT: Record<number, string> = {
  3:   'Хорошее начало — паттерн уже виден',
  7:   'Неделя подряд. Это настоящий сдвиг',
  14:  'Две недели подряд. Паттерн становится стабильным',
  21:  '21 день. Тело и ум уже запомнили этот ритм',
  30:  'Месяц. Ты видишь себя по-новому',
  60:  'Два месяца подряд. Это часть тебя',
  100: '100 дней. Это не просто привычка — это ты',
};

function getMilestoneText(streak: number): string {
  const milestones = [100, 60, 30, 21, 14, 7, 3];
  const hit = milestones.find(m => streak === m);
  if (hit) return MILESTONE_TEXT[hit];
  return streak === 1 ? 'Первый день — самый важный' : `${streak} ${pluralDays(streak)} подряд`;
}

function pluralDays(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return 'день';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'дня';
  return 'дней';
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  color: string; size: number; rotation: number; vr: number; opacity: number;
}

interface Props {
  streak: number;
  onDone: () => void;
}

export function Celebration({ streak, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
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
        p.x += p.vx; p.y += p.vy; p.rotation += p.vr;
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
      if (alive) { rafRef.current = requestAnimationFrame(draw); }
      else { onDone(); }
    }
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [onDone]);

  const isMilestone = [3, 7, 14, 21, 30, 60, 100].includes(streak);

  return (
    <div onClick={onDone} style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{
        position: 'relative', zIndex: 1, textAlign: 'center',
        background: 'var(--bg)', borderRadius: 24,
        padding: '32px 36px', margin: '0 32px',
        border: '1px solid rgba(var(--fg-rgb),0.12)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
        animation: 'sheet-up 400ms cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 12 }}>
          {isMilestone ? '🏆' : '🔥'}
        </div>
        <div style={{ fontSize: 52, fontWeight: 800, color: 'var(--text)', lineHeight: 1, marginBottom: 6 }}>
          {streak}
        </div>
        <div style={{ fontSize: 16, color: 'var(--text-sub)', marginBottom: 16 }}>
          {pluralDays(streak)} подряд
        </div>
        <div style={{ fontSize: 14, color: 'rgba(var(--fg-rgb),0.75)', lineHeight: 1.5, maxWidth: 220 }}>
          {getMilestoneText(streak)}
        </div>
        <button
          onClick={async (e) => {
            e.stopPropagation();
            const text = `🔥 ${streak} ${streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'} подряд в дневнике потребностей!\n\nОтслеживаю своё состояние каждый день. t.me/SchemaLabBot`;
            try {
              if (navigator.share) { await navigator.share({ text }); }
              else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
            } catch {
              try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
            }
          }}
          style={{
            marginTop: 16,
            padding: '10px 24px', border: 'none', borderRadius: 20,
            background: 'rgba(var(--fg-rgb),0.15)', color: 'var(--text)',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {copied ? 'Скопировано!' : 'Поделиться'}
        </button>
        <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 12 }}>
          нажми в другом месте, чтобы закрыть
        </div>
      </div>
    </div>
  );
}
