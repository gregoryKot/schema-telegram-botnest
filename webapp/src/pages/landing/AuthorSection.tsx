import { SUB, FAINT, GLASS_BORDER, VIOLET, PINK, glow } from './aurora';
import { Cta } from './BrandKit';
import { EYEBROW, H2 } from './productContent';
import { AUTHOR_SITE, trackPracticeClick } from './practiceLink';

// Блок «Кто это делает»: автор проекта — схема-терапевт с частной практикой.
// Клик по CTA — продуктовое событие practice_link_click (place: 'author'),
// видно в /stats. Композиция своя, не копия Telegram-ленты (jscpd).

export function AuthorSection() {
  return (
    <section id="author" style={{ padding: '20px 24px 72px' }}>
      <div className="pl2-author" style={{
        maxWidth: 1160, margin: '0 auto',
        display: 'grid', gridTemplateColumns: '300px 1fr', gap: 48, alignItems: 'center',
        background: 'linear-gradient(120deg, rgba(244,114,182,.10), rgba(167,139,250,.07))',
        border: `1px solid ${GLASS_BORDER}`, borderRadius: 28, padding: '48px 44px',
      }}>
        <img
          src="/gregory.jpg"
          alt="Григорий Котляревский — схема-терапевт"
          loading="lazy"
          decoding="async"
          width={300}
          height={360}
          style={{
            width: '100%', maxWidth: 300, aspectRatio: '5 / 6', objectFit: 'cover',
            objectPosition: 'center top', borderRadius: 24, justifySelf: 'center',
            border: `1px solid ${GLASS_BORDER}`,
            boxShadow: `0 24px 60px rgba(0,0,0,.45), 0 0 40px ${glow(PINK, .15)}`,
          }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div>
          <span style={EYEBROW}>Кто это делает</span>
          <h2 style={{ ...H2, margin: '14px 0 10px' }}>Григорий Котляревский</h2>
          <p style={{ fontSize: 14, fontWeight: 700, color: VIOLET, margin: '0 0 16px' }}>
            Схема-терапевт · частная практика онлайн
          </p>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, color: SUB, maxWidth: 560, margin: '0 0 28px' }}>
            Я схема-терапевт и сделал «Всё по схеме» бесплатным — чтобы у метода
            был доступный инструмент самонаблюдения. Приложение выросло из моей
            практики: это те же дневники и упражнения, которые помогают клиентам
            между сессиями. А если захочется разбирать свои схемы не в
            одиночку — приходите знакомиться.
          </p>
          <Cta href={AUTHOR_SITE} size="lg" onClick={() => trackPracticeClick('author')}>
            Познакомиться: сайт практики ↗
          </Cta>
          <p style={{ fontSize: 12.5, color: FAINT, margin: '14px 0 0' }}>
            Первая встреча — 15 минут, бесплатно
          </p>
        </div>
      </div>
    </section>
  );
}
