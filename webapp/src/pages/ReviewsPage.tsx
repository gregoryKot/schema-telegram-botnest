// ─── Почему на сайте нет отзывов – этическое обоснование ─────────────────────
const REASONS = [
  {
    n: '01',
    title: 'Сам факт обращения – тайна',
    text: 'То, что человек пришёл к терапевту, – чувствительная личная информация. Даже анонимный отзыв оставляет следы: формулировки, детали запроса, время. По ним близкие иногда узнают автора. Я не могу гарантировать, что этого не случится, – поэтому не публикую отзывы вообще.',
  },
  {
    n: '02',
    title: 'Просьба об отзыве – это давление',
    text: 'В терапии есть естественный дисбаланс: клиент доверяет, открывается, временами идеализирует специалиста. Просьба «оставьте отзыв» использует этот дисбаланс – человеку трудно отказать, даже если внутри он против. Я не хочу ставить клиентов в это положение.',
  },
  {
    n: '03',
    title: 'Так велят профессиональные стандарты',
    text: 'Этические кодексы психотерапевтических ассоциаций прямо не рекомендуют запрашивать отзывы у текущих и бывших клиентов. Это не формальность – это защита человека, который доверился.',
  },
  {
    n: '04',
    title: 'Отзывы создают ложные ожидания',
    text: 'Терапия – не услуга с гарантированным результатом. У каждого свой темп, своя глубина, свой исход. Чужая история «мне помогло за месяц» не говорит ничего о том, как будет у вас, – а только создаёт давление и сравнение.',
  },
];

export function ReviewsPage() {
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100dvh' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '64px 40px 96px' }}>
        <a href="/" style={backLink}>← На главную</a>

        <p style={eyebrow}>Отзывы</p>
        <h1 style={h1}>Почему здесь<br /><span style={{ fontStyle: 'italic' }}>нет отзывов</span></h1>
        <p style={lead}>
          Вы не найдёте на этом сайте раздела с отзывами клиентов – и это
          осознанное решение, а не недоработка. Вот честно, почему.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, margin: '48px 0 0' }}>
          {REASONS.map((r) => (
            <div key={r.n} style={{
              display: 'grid', gridTemplateColumns: '64px 1fr', gap: '0 20px',
              padding: '28px 0', borderTop: '1px solid var(--line)',
            }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--accent)', lineHeight: 1, letterSpacing: '-.02em' }}>{r.n}</span>
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', margin: '0 0 10px', lineHeight: 1.3 }}>{r.title}</h2>
                <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.75, margin: 0 }}>{r.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 48, padding: '28px 32px',
          background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 20,
        }}>
          <p style={{ fontSize: 16, color: 'var(--text)', lineHeight: 1.75, margin: '0 0 8px', fontWeight: 600 }}>
            Как же тогда понять, подхожу ли я вам?
          </p>
          <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.75, margin: '0 0 20px' }}>
            Для этого есть бесплатная первая встреча – 15 минут, чтобы
            познакомиться и почувствовать контакт. Без обязательств: если
            не подойдём друг другу, я честно скажу и при необходимости
            порекомендую коллегу.
          </p>
          <a href="https://kotlarewski.ru/#booking" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '13px 26px', background: 'var(--accent)', color: '#fff',
            borderRadius: 100, fontSize: 14, fontWeight: 700, textDecoration: 'none',
          }}>
            Записаться на знакомство →
          </a>
        </div>
      </div>
    </div>
  );
}

const backLink: React.CSSProperties = { fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 48 };
const eyebrow: React.CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 12px' };
const h1: React.CSSProperties = { fontFamily: 'var(--serif)', fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 400, lineHeight: 1.1, margin: '0 0 20px', letterSpacing: '-.01em' };
const lead: React.CSSProperties = { fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.8, margin: 0, maxWidth: 620 };
