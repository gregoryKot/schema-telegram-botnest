// Герой «Моего пути» для сайта — editorial-вёрстка: без градиента и эмодзи,
// слева, эйбрау + крупная serif-цифра + подпись между тонкими линиями.
// Мини-апп берёт градиентный JourneyHero (shared/journey/JourneyHero.tsx);
// общее — данные и пояснение, которые приходят пропсами из JourneyView.
import type {
  JourneyEmptyHeroProps,
  JourneyHeroProps,
} from '../../../../shared/src/journey/journeyHeroes';

const FRAME = {
  marginTop: 12,
  padding: '18px 0',
  borderTop: '1px solid var(--line)',
  borderBottom: '1px solid var(--line)',
} as const;

export function WebJourneyEmptyHero({ tr, explainer }: JourneyEmptyHeroProps) {
  return (
    <div style={FRAME}>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, lineHeight: 1.15, letterSpacing: '-0.01em', color: 'var(--text)', margin: '0 0 10px' }}>
        Путь ещё впереди
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6, margin: 0, maxWidth: 460 }}>
        {explainer}{' '}
        {tr(
          'Начни с трекера или любого дневника — первый шаг появится здесь.',
          'Начните с трекера или любого дневника — первый шаг появится здесь.',
        )}
      </p>
    </div>
  );
}

export function WebJourneyHero({ total, explainer, onShareFeed }: JourneyHeroProps) {
  return (
    <div style={FRAME}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Шагов заботы о себе</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 56, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--text)' }}>
        {total}
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6, margin: '12px 0 0', maxWidth: 460 }}>
        {explainer}
      </p>
      <button
        onClick={onShareFeed}
        style={{ marginTop: 12, padding: 0, border: 'none', background: 'none', color: 'var(--accent)', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
      >
        Поделиться лентой шагов →
      </button>
    </div>
  );
}
