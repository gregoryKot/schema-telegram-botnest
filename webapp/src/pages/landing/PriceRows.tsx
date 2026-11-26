import { Btn } from '../../components/landing-kit';
import { formatPrice } from '../../../../shared/src/booking/priceRegion';
import type { useSessionPrice } from './useSessionPrice';

// «Как устроена работа» визитки — два формата строками на линии, без карточек и капсулы «Основной»
// (К32, #1674): метка основного формата — текстом рядом с названием.
type Price = ReturnType<typeof useSessionPrice>;

const EYEBROW: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' };
const PRICE: React.CSSProperties = { fontFamily: 'var(--serif)', fontSize: 56, fontWeight: 400, margin: '6px 0 0', letterSpacing: '-.03em', lineHeight: 1 };

function Row({ label, note, price, priceColor, features, children }: {
  label: string; note?: string; price: string; priceColor: string; features: string[]; children: React.ReactNode;
}) {
  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 'var(--space-24)', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <span style={{ ...EYEBROW, color: priceColor }}>{label}</span>
        {note && <span style={{ ...EYEBROW, color: 'var(--text-faint)' }}> · {note}</span>}
        <p style={{ ...PRICE, color: priceColor }}>{price}</p>
      </div>
      <ul style={{ flex: 1, listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {features.map((f) => (
          <li key={f} className="u-ac10">
            <span aria-hidden="true" style={{ color: 'var(--accent)', fontSize: 15, flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: 15, color: 'var(--text-sub)' }}>{f}</span>
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

export function PriceRows({ sessionPrice, onBook }: { sessionPrice: Price; onBook: () => void }) {
  return (
    <div className="price-grid">
      <Row label="Знакомство" price={formatPrice(0, sessionPrice.currency)} priceColor="var(--accent)"
        features={['15 минут онлайн', 'Рассказываете о запросе', 'Я рассказываю о подходе', 'Никаких обязательств']}>
        <Btn full onClick={onBook}>Записаться бесплатно →</Btn>
      </Row>
      <Row label="Сессия" note="основной формат" price={sessionPrice.text} priceColor="var(--text)"
        features={['50 минут онлайн (видео)', 'Индивидуальная работа', 'Схема-терапия и КПТ', 'Регулярные встречи']}>
        <Btn variant="ghost" full onClick={onBook}>Начать работу →</Btn>
      </Row>
    </div>
  );
}
