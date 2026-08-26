import { INK, SUB, FAINT, GLASS_BORDER, VIOLET, PINK, CYAN, AMBER, EMERALD, ROSE, glow } from './aurora';

// Мокап приложения на первом экране лендинга — вынесен из
// ProductLandingPage.tsx (правило №10: файл сверх потолка растёт только
// дроблением). Данные декоративные (aria-hidden), не пользовательские.
// ─── Мокап приложения (тёмное стекло) ─────────────────────────────────────────
const MOCK_NEEDS = [
  { emoji: '🤝', name: 'Привязанность', v: 7, c: CYAN },
  { emoji: '🚀', name: 'Автономия',     v: 8, c: EMERALD },
  { emoji: '⚖️', name: 'Границы',       v: 4, c: ROSE },
  { emoji: '🎉', name: 'Спонтанность',  v: 6, c: AMBER },
];
const MOCK_SPARK = [4, 5, 3, 6, 5, 7, 6, 8, 7, 8, 6, 9];

export function AppPreview() {
  return (
    <div className="pl2-preview" style={{ position: 'relative', display: 'flex', justifyContent: 'center' }} aria-hidden>
      <div style={{
        width: 300, boxSizing: 'border-box', padding: '22px 20px 20px',
        background: 'linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03))',
        border: `1px solid ${GLASS_BORDER}`, borderRadius: 32,
        boxShadow: `0 40px 90px rgba(0,0,0,.5), 0 0 60px ${glow(VIOLET, .18)}`,
        animation: 'pl2-float 7s ease-in-out infinite', // backdropFilter снят: см. index.css/.mobile-nav (тут ещё и едет по translateY — блюр пересчитывался бы каждый кадр)
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', color: INK }}>Сегодня</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: FAINT }}>минутный чек-ин</span>
        </div>
        <p style={{ fontSize: 12, color: SUB, margin: '0 0 16px' }}>Как ты? Отметь свои потребности</p>
        {MOCK_NEEDS.map((n) => (
          <div key={n.name} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
              <span style={{ color: INK, fontWeight: 600 }}>{n.emoji} {n.name}</span>
              <span style={{ color: n.c, fontWeight: 800 }}>{n.v}</span>
            </div>
            <div style={{ height: 7, borderRadius: 5, background: 'rgba(255,255,255,.08)' }}>
              <div style={{ width: `${n.v * 10}%`, height: '100%', borderRadius: 5, background: n.c, boxShadow: `0 0 10px ${glow(n.c, .6)}` }} />
            </div>
          </div>
        ))}
        <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 16, border: `1px solid ${GLASS_BORDER}`, background: 'rgba(255,255,255,.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 8 }}>
            <span style={{ fontWeight: 800, color: INK }}>Динамика</span>
            <span style={{ color: FAINT }}>2 недели</span>
          </div>
          <svg width="100%" height="42" viewBox="0 0 220 42" preserveAspectRatio="none">
            <defs><linearGradient id="pl2bar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor={VIOLET} /><stop offset="1" stopColor={PINK} /></linearGradient></defs>
            {MOCK_SPARK.map((v, i) => (
              <rect key={i} x={i * 18.5} y={42 - v * 4.2} width="11" height={v * 4.2} rx="3" fill="url(#pl2bar)" opacity={0.45 + (v / 9) * 0.55} />
            ))}
          </svg>
        </div>
      </div>
      <div className="pl2-chip" style={{ position: 'absolute', top: 30, right: -10, padding: '10px 14px', borderRadius: 14, background: 'rgba(20,14,34,.85)', border: `1px solid ${glow(PINK, .35)}`, boxShadow: `0 14px 40px rgba(0,0,0,.5)`, fontSize: 12, fontWeight: 700, color: INK, animation: 'pl2-float 6s ease-in-out .8s infinite' }}>
        <span style={{ color: PINK }}>🔍 Схема замечена</span>
        <div style={{ fontSize: 11, fontWeight: 500, color: SUB, marginTop: 2 }}>Покинутость · 3-й раз за неделю</div>
      </div>
      <div className="pl2-chip" style={{ position: 'absolute', bottom: 44, left: -16, padding: '10px 14px', borderRadius: 14, background: 'rgba(20,14,34,.85)', border: `1px solid ${glow(EMERALD, .35)}`, boxShadow: `0 14px 40px rgba(0,0,0,.5)`, fontSize: 12, fontWeight: 700, color: INK, animation: 'pl2-float 8s ease-in-out 1.6s infinite' }}>
        <span style={{ color: EMERALD }}>🌱 Критик — тише</span>
        <div style={{ fontSize: 11, fontWeight: 500, color: SUB, marginTop: 2 }}>реже, чем месяц назад</div>
      </div>
    </div>
  );
}
