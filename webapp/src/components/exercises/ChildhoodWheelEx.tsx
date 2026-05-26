import { useState, useRef } from 'react';
import { api } from '../../api';
import { ExScreen, GlyphArrowRight } from './ExScreen';

const NEEDS = [
  { id: 'attachment',  label: 'Привязанность',    color: 'var(--c-rose)',
    question: 'Был ли рядом взрослый, который замечал когда тебе плохо и откликался?',
    low: 'Взрослый отсутствовал или был непредсказуем. В трудный момент некому было обратиться.',
    high: 'Был стабильный взрослый, которому можно было доверять. Ты чувствовал себя нужным.' },
  { id: 'autonomy',    label: 'Автономия',         color: 'var(--c-clay)',
    question: 'Доверяли ли тебе — иметь своё мнение, делать выборы по возрасту, ошибаться?',
    low: 'Контролировали, решали за тебя, критиковали. Ошибка была катастрофой.',
    high: 'Поощряли пробовать самому. Мнение уважали. Ошибки — часть взросления.' },
  { id: 'expression',  label: 'Выражение чувств', color: 'var(--c-moss)',
    question: 'Было ли безопасно выражать злость, страх, грусть — без наказания или стыда?',
    low: 'Сильные чувства было опасно показывать. Научился прятать или подавлять.',
    high: 'Можно было плакать, злиться, бояться. Чувства принимались как норма.' },
  { id: 'play',        label: 'Спонтанность',      color: 'var(--accent-indigo)',
    question: 'Было ли место для игры и лёгкости — без постоянного давления быть продуктивным?',
    low: 'Давление выполнять, достигать, быть серьёзным. Беззаботность вызывала вину.',
    high: 'Было место для игры ради игры. Смех и лёгкость — часть обычной жизни.' },
  { id: 'limits',      label: 'Границы',            color: 'var(--c-amber)',
    question: 'Были ли правила в семье последовательными и справедливыми, не случайными?',
    low: 'Правила были непредсказуемыми, слишком жёсткими или почти отсутствовали.',
    high: 'Правила были понятны. Нарушения имели соразмерные последствия. Тепло, не жёсткость.' },
];

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

function CWTrack({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = value * 10;
  function compute(clientX: number) {
    const r = ref.current!.getBoundingClientRect();
    onChange(Math.round(clamp((clientX - r.left) / r.width, 0, 1) * 10));
  }
  return (
    <div ref={ref} className="cw-track" style={{ '--c-color': color } as React.CSSProperties}
      onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); compute(e.clientX); }}
      onPointerMove={e => { if (e.buttons === 0) return; compute(e.clientX); }}
    >
      <div className="cw-track-line">
        <div className="cw-track-fill" style={{ width: pct + '%' }} />
        {[0, 25, 50, 75, 100].map(p => <div key={p} style={{ position: 'absolute', width: 1, height: 6, background: 'var(--line)', left: p + '%', top: -2 }} />)}
      </div>
      <div className="cw-thumb" style={{ left: pct + '%' }} />
    </div>
  );
}

function WheelSvg({ ratings }: { ratings: Record<string, number> }) {
  const size = 240, cx = 120, cy = 120, maxR = 80;
  const angles = NEEDS.map((_, i) => (i * 2 * Math.PI / NEEDS.length) - Math.PI / 2);
  const pts = NEEDS.map((n, i) => { const r = (ratings[n.id] / 10) * maxR; return `${(cx + r * Math.cos(angles[i])).toFixed(1)},${(cy + r * Math.sin(angles[i])).toFixed(1)}`; }).join(' ');
  const shortLabel: Record<string, string> = { attachment: 'Привяз.', autonomy: 'Автоном.', expression: 'Выраж.', play: 'Спонтан.', limits: 'Границы' };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
      {[0.25, 0.5, 0.75, 1].map(p => <polygon key={p} points={angles.map(a => `${(cx + maxR * p * Math.cos(a)).toFixed(1)},${(cy + maxR * p * Math.sin(a)).toFixed(1)}`).join(' ')} fill="none" stroke="var(--line)" strokeWidth={1} />)}
      {angles.map((a, i) => <line key={i} x1={cx} y1={cy} x2={(cx + maxR * Math.cos(a)).toFixed(1)} y2={(cy + maxR * Math.sin(a)).toFixed(1)} stroke="var(--line)" strokeWidth={1} />)}
      <polygon points={pts} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" />
      {NEEDS.map((n, i) => {
        const r = (ratings[n.id] / 10) * maxR;
        return (
          <g key={n.id}>
            <circle cx={cx + r * Math.cos(angles[i])} cy={cy + r * Math.sin(angles[i])} r={4} fill={n.color} />
            <text x={(cx + (maxR + 22) * Math.cos(angles[i])).toFixed(1)} y={(cy + (maxR + 22) * Math.sin(angles[i])).toFixed(1)}
              textAnchor="middle" dominantBaseline="middle" fontSize={9.5} fontWeight={600} fill="var(--text-sub)"
              style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>{shortLabel[n.id]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function ChildhoodWheelEx({ onBack, onSaved }: { onBack: () => void; onSaved?: (r: Record<string,number>) => void }) {
  const [ratings, setRatings] = useState<Record<string, number>>({ attachment: 5, autonomy: 5, expression: 5, play: 5, limits: 5 });
  const [done, setDone] = useState(false);

  function set(id: string, v: number) { setRatings(r => ({ ...r, [id]: v })); }
  const avg = Math.round((Object.values(ratings).reduce((a, b) => a + b, 0) / NEEDS.length) * 10) / 10;
  const lowNeeds = NEEDS.filter(n => ratings[n.id] <= 4);

  async function save() {
    try { await api.saveChildhoodRatings(ratings); } catch {}
    onSaved?.(ratings);
    setDone(true);
  }

  if (done) {
    return (
      <ExScreen onBack={onBack} eyebrow="Колесо детства · сохранено" eyebrowColor="var(--accent-indigo)"
        title={<>Колесо<br/><span className="it">детства</span></>}
        lede={`Среднее ${avg}/10. ${lowNeeds.length ? `${lowNeeds.length} зон ниже 5 — это места, где могли сформироваться схемы.` : 'Все зоны выше 4 — это редкий ресурс.'}`}
        aside={<div className="aside-card"><div className="aside-card-eyebrow">Что дальше</div><h3>Связать с сегодня</h3><p className="body">Открой дневник за последнюю неделю и сравни — какие потребности сегодня просели больше всего. Часто это те же зоны.</p></div>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 48 }}>
          <div>
            {NEEDS.map((n, i) => (
              <div key={n.id} className="cw-row" style={{ '--c-color': n.color } as React.CSSProperties}>
                <span className="cw-row-num">{String(i + 1).padStart(2, '0')}</span>
                <div className="cw-row-body">
                  <div className="cw-row-label">{n.label}</div>
                  <div className="cw-row-q" style={{ marginBottom: 0 }}>{ratings[n.id] <= 4 ? n.low : ratings[n.id] >= 8 ? n.high : 'Где-то между. Бывало по-разному.'}</div>
                </div>
                <div className="cw-row-value">{ratings[n.id]}<span className="of">/10</span></div>
              </div>
            ))}
          </div>
          <div className="cw-wheel-card">
            <h4>Твоё колесо</h4>
            <div className="sub">Сохранено · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>
            <WheelSvg ratings={ratings} />
          </div>
        </div>
        <div className="ex-foot">
          <button className="ex-btn ex-btn-outline" onClick={() => setDone(false)}>Пересмотреть оценки</button>
          <span className="spacer" />
          <button className="ex-btn ex-btn-primary" onClick={onBack}>Закрыть</button>
        </div>
      </ExScreen>
    );
  }

  return (
    <ExScreen onBack={onBack} eyebrow="№ 06 · Истоки" eyebrowColor="var(--accent-indigo)"
      title={<>Колесо<br/><span className="it">детства</span></>}
      lede="Оцени пять базовых потребностей в детстве. Не отдельные моменты, а как было «в целом, большую часть времени» — там, где формировались схемы."
      aside={<>
        <div className="aside-card" style={{ borderColor: 'var(--c-amber)40', background: 'var(--c-amber)08' }}>
          <div className="aside-card-eyebrow" style={{ color: 'var(--c-amber)' }}>Внимание</div>
          <h3>Защитная идеализация</h3>
          <p className="body">Психика прячет систематические паттерны и подсвечивает редкие хорошие моменты. Оценивай не «как могло быть», а «как было обычно, в большинстве лет».</p>
        </div>
        <div className="aside-card" style={{ position: 'sticky', top: 40 }}>
          <div className="aside-card-eyebrow">Предпросмотр</div>
          <WheelSvg ratings={ratings} />
          <div className="cw-legend">
            {NEEDS.map(n => (
              <div key={n.id} className="cw-legend-row">
                <span className="cw-legend-swatch" style={{ background: n.color }} />
                {n.label}
                <span className="cw-legend-val" style={{ color: ratings[n.id] <= 4 ? 'var(--c-rose)' : ratings[n.id] <= 6 ? 'var(--c-amber)' : 'var(--c-moss)' }}>{ratings[n.id]}</span>
              </div>
            ))}
          </div>
        </div>
      </>}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-faint)', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
        <span>0 — почти не было</span>
        <span>5 — где-то посередине</span>
        <span>10 — в полной мере</span>
      </div>
      {NEEDS.map((n, i) => (
        <div key={n.id} className="cw-row" style={{ '--c-color': n.color } as React.CSSProperties}>
          <span className="cw-row-num">{String(i + 1).padStart(2, '0')}</span>
          <div className="cw-row-body">
            <div className="cw-row-label">{n.label}</div>
            <div className="cw-row-q">{n.question}</div>
            <CWTrack value={ratings[n.id]} onChange={v => set(n.id, v)} color={n.color} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
              <div style={{ fontSize: 11.5, lineHeight: 1.55, color: ratings[n.id] <= 4 ? 'var(--c-rose)' : 'var(--text-faint)', fontWeight: ratings[n.id] <= 4 ? 500 : 400 }}>
                <span style={{ fontWeight: 600 }}>0 — дефицит. </span>{n.low}
              </div>
              <div style={{ fontSize: 11.5, lineHeight: 1.55, color: ratings[n.id] >= 8 ? 'var(--c-moss)' : 'var(--text-faint)', fontWeight: ratings[n.id] >= 8 ? 500 : 400 }}>
                <span style={{ fontWeight: 600 }}>10 — насыщение. </span>{n.high}
              </div>
            </div>
          </div>
          <div className="cw-row-value">{ratings[n.id]}<span className="of">/10</span></div>
        </div>
      ))}
      <div className="ex-foot">
        <span className="spacer" />
        <button className="ex-btn ex-btn-primary" onClick={save}>Посмотреть результат <GlyphArrowRight /></button>
      </div>
    </ExScreen>
  );
}
