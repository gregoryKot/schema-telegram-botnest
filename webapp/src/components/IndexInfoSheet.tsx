import { GlyphArrowLeft } from './exercises/ExScreen';

const PARAGRAPHS = [
  'Индекс — это не цель. Нет задачи достичь 10 или не опускаться ниже 7.',
  'Потребности не работают как светофор. Они меняются — в зависимости от того, что происходит, с кем ты, насколько выспался.',
  'День на 5–6, прожитый осознанно, ценнее дня на 9, прожитого на автопилоте. Дневник нужен не чтобы улучшить показатели — а чтобы лучше видеть себя.',
  'Паттерн начинает читаться через 3–5 дней. Чем регулярнее — тем точнее картина.',
];

export function IndexInfoSheet({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '12px 24px' }}>
        <button className="ex-btn ex-btn-ghost" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px' }}>
          <GlyphArrowLeft /> Назад
        </button>
      </div>
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '36px 24px 80px' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', lineHeight: 1.15, marginBottom: 28 }}>
          Об индексе дня
        </h1>
        {PARAGRAPHS.map((p, i) => (
          <p key={i} style={{ fontSize: 16, color: 'rgba(var(--fg-rgb),0.8)', lineHeight: 1.7, marginBottom: 18 }}>
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}
