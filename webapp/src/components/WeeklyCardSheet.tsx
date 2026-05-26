import { useEffect, useRef, useState } from 'react';
import { COLORS } from '../types';
import type { Need, DayHistory } from '../types';
import { GlyphArrowLeft } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { api } from '../api';
import { TherapyNote } from './TherapyNote';
import { fmtDate } from '../utils/format';

interface Props {
  needs: Need[];
  history: DayHistory[];
  onClose: () => void;
}

function calcWeekAvg(history: DayHistory[], needId: string): number | null {
  const vals = history.map(d => d.ratings[needId]).filter(v => v !== undefined) as number[];
  if (vals.length === 0) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function drawCard(canvas: HTMLCanvasElement, needs: Need[], history: DayHistory[], streak: number) {
  const W = 400;
  const ROW_H = 44;
  const NEED_SECTION_H = needs.length * ROW_H + 8;
  const H = 120 + NEED_SECTION_H + 96 + 56;

  const DPR = 2;
  canvas.width = W * DPR;
  canvas.height = H * DPR;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(DPR, DPR);

  const cs = getComputedStyle(document.documentElement);
  const bgColor = cs.getPropertyValue('--bg').trim() || '#060a12';
  const fgRgb = cs.getPropertyValue('--fg-rgb').trim() || '255, 255, 255';
  const fg = (alpha: number) => `rgba(${fgRgb},${alpha})`;
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, bgColor);
  bg.addColorStop(1, cs.getPropertyValue('--sheet-bg').trim() || '#141720');
  ctx.fillStyle = bg;
  ctx.beginPath();
  (ctx as any).roundRect(0, 0, W, H, 20);
  ctx.fill();

  const accentGrad = ctx.createLinearGradient(28, 0, W - 28, 0);
  accentGrad.addColorStop(0, 'var(--accent)');
  accentGrad.addColorStop(1, '#4fa3f7');
  ctx.strokeStyle = accentGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(28, 24);
  ctx.lineTo(W - 28, 24);
  ctx.stroke();

  ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = fg(0.95);
  ctx.textAlign = 'left';
  ctx.fillText('Трекер потребностей', 28, 56);

  const sorted = [...history].map(d => d.date).sort();
  const weekRange = sorted.length >= 2
    ? `${fmtDate(sorted[0])} — ${fmtDate(sorted[sorted.length - 1])}`
    : sorted.length === 1 ? fmtDate(sorted[0]) : '';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = fg(0.38);
  ctx.fillText(weekRange, 28, 76);

  ctx.strokeStyle = fg(0.07);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(28, 96);
  ctx.lineTo(W - 28, 96);
  ctx.stroke();

  const BAR_X = W - 28 - 100;
  const BAR_MAX_W = 100;
  const BAR_H = 7;

  needs.forEach((need, i) => {
    const rowY = 112 + i * ROW_H;
    const avg = calcWeekAvg(history, need.id);
    const color = (COLORS as Record<string, string>)[need.id] ?? '#888';

    ctx.font = '17px serif';
    ctx.fillStyle = fg(0.95);
    ctx.textAlign = 'left';
    ctx.fillText(need.emoji, 28, rowY + 20);

    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = fg(0.7);
    ctx.fillText(need.chartLabel, 52, rowY + 20);

    const valStr = avg !== null ? avg.toFixed(1) : '—';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.fillText(valStr, BAR_X - 12, rowY + 20);
    ctx.textAlign = 'left';

    ctx.fillStyle = fg(0.07);
    ctx.beginPath();
    (ctx as any).roundRect(BAR_X, rowY + 12, BAR_MAX_W, BAR_H, 3.5);
    ctx.fill();

    if (avg !== null && avg > 0) {
      const fillW = Math.max(4, (avg / 10) * BAR_MAX_W);
      const barGrad = ctx.createLinearGradient(BAR_X, 0, BAR_X + fillW, 0);
      barGrad.addColorStop(0, color + 'aa');
      barGrad.addColorStop(1, color);
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      (ctx as any).roundRect(BAR_X, rowY + 12, fillW, BAR_H, 3.5);
      ctx.fill();
    }
  });

  const statsDivY = 112 + needs.length * ROW_H + 8;
  ctx.strokeStyle = fg(0.07);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(28, statsDivY);
  ctx.lineTo(W - 28, statsDivY);
  ctx.stroke();

  const statsY = statsDivY + 20;
  const allAvgs = needs.map(n => calcWeekAvg(history, n.id)).filter(v => v !== null) as number[];
  const weekIndex = allAvgs.length > 0 ? allAvgs.reduce((s, v) => s + v, 0) / allAvgs.length : 0;

  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = fg(0.35);
  ctx.textAlign = 'left';
  ctx.fillText('Индекс недели', 28, statsY);

  ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = fg(0.95);
  ctx.fillText(weekIndex.toFixed(1), 28, statsY + 30);

  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = fg(0.28);
  const idxW = ctx.measureText(weekIndex.toFixed(1)).width;
  ctx.fillText('/10', 28 + idxW + 2, statsY + 24);

  if (streak > 0) {
    ctx.textAlign = 'right';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = fg(0.35);
    ctx.fillText('Серия дней', W - 28, statsY);

    ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = fg(0.95);
    ctx.fillText(`${streak} 🔥`, W - 28, statsY + 30);
    ctx.textAlign = 'left';
  }

  const footerDivY = H - 52;
  ctx.strokeStyle = fg(0.05);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(28, footerDivY);
  ctx.lineTo(W - 28, footerDivY);
  ctx.stroke();

  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = fg(0.25);
  ctx.textAlign = 'left';
  ctx.fillText('@SchemeHappens · Трекер потребностей', 28, footerDivY + 22);
}

export function WeeklyCardSheet({ needs, history, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streak, setStreak] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [fallbackCopied, setFallbackCopied] = useState(false);

  useEffect(() => {
    api.getStreak().then(s => setStreak(s.currentStreak)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!canvasRef.current || history.length === 0) return;
    drawCard(canvasRef.current, needs, history, streak);
  }, [needs, history, streak]);

  function buildShareText(detailed: boolean): { text: string; range: string; weekIndex: string } {
    const allAvgs = needs.map(n => calcWeekAvg(history, n.id)).filter(v => v !== null) as number[];
    const weekIndex = allAvgs.length > 0
      ? (allAvgs.reduce((s, v) => s + v, 0) / allAvgs.length).toFixed(1)
      : '—';
    const sorted = [...history].map(d => d.date).sort();
    const range = sorted.length >= 2
      ? `${fmtDate(sorted[0])} — ${fmtDate(sorted[sorted.length - 1])}`
      : sorted.length === 1 ? fmtDate(sorted[0]) : '';
    const streakSuffix = streak > 0 ? ` · Серия: ${streak} дней 🔥` : '';
    const text = detailed
      ? `Трекер потребностей · ${range}\n\n${needs.map(n => {
          const avg = calcWeekAvg(history, n.id);
          return `${n.emoji} ${n.chartLabel}: ${avg !== null ? avg.toFixed(1) : '—'}`;
        }).join('\n')}\n\nИндекс: ${weekIndex}/10${streakSuffix}\n\n@SchemeHappens`
      : `Мой трекер потребностей за неделю ${range}\nИндекс: ${weekIndex}/10${streakSuffix}\n@SchemeHappens`;
    return { text, range, weekIndex };
  }

  async function handleShare() {
    if (!canvasRef.current) return;
    setSharing(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvasRef.current!.toBlob(b => b ? resolve(b) : reject(new Error('canvas empty')), 'image/png');
      });
      const file = new File([blob], 'needs-week.png', { type: 'image/png' });
      const { text } = buildShareText(false);

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else if (navigator.share) {
        await navigator.share({ text });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'needs-week.png';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      const { text } = buildShareText(true);
      try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {}
      setFallbackText(text);
    } finally {
      setSharing(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '12px 24px' }}>
        <button className="ex-btn ex-btn-ghost" onClick={goBack} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px' }}>
          <GlyphArrowLeft /> Назад
        </button>
      </div>
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '36px 24px 80px' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', lineHeight: 1.15, marginBottom: 28 }}>
          Карточка недели
        </h1>

        {history.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-sub)', padding: '48px 0', fontSize: 15 }}>
            Нет данных за неделю
          </div>
        ) : (
          <>
            <div style={{
              borderRadius: 16, overflow: 'hidden',
              border: '1px solid rgba(var(--fg-rgb),0.06)',
              marginBottom: 24,
            }}>
              <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto' }} />
            </div>

            <button
              onClick={handleShare}
              disabled={sharing}
              style={{
                width: '100%', padding: '15px 0', borderRadius: 14, border: 'none',
                background: copied
                  ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)'
                  : 'linear-gradient(135deg, #a78bfa, #4fa3f7)',
                color: copied ? '#06d6a0' : '#fff',
                fontSize: 16, fontWeight: 600, cursor: 'pointer',
                opacity: sharing ? 0.6 : 1,
                transition: 'all 0.2s ease',
                marginBottom: 16,
              }}
            >
              {copied ? '✓ Скопировано' : sharing ? 'Подготовка...' : 'Поделиться'}
            </button>
            <TherapyNote compact />
          </>
        )}
      </div>

      {fallbackText && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => { setFallbackText(null); setFallbackCopied(false); }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '24px 24px 48px', width: '100%', maxWidth: 560, margin: '0 auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(var(--fg-rgb),0.12)', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Поделиться текстом</div>
            <pre style={{
              fontSize: 12, color: 'rgba(var(--fg-rgb),0.7)', lineHeight: 1.6,
              background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 12, padding: '12px 14px',
              overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              marginBottom: 14, userSelect: 'all', fontFamily: 'inherit',
            }}>
              {fallbackText}
            </pre>
            <button
              onClick={async () => {
                try { await navigator.clipboard.writeText(fallbackText); setFallbackCopied(true); setTimeout(() => setFallbackCopied(false), 2000); } catch {}
              }}
              style={{
                width: '100%', padding: '13px 0', border: 'none', borderRadius: 12,
                background: fallbackCopied ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)' : 'rgba(var(--fg-rgb),0.08)',
                color: fallbackCopied ? '#06d6a0' : 'rgba(var(--fg-rgb),0.7)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {fallbackCopied ? '✓ Скопировано' : 'Скопировать'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
