import React from 'react';
import { useReveal, DARK_BG, INK_ON_DARK } from '../../components/landing-kit-hooks';
import { EDUCATION, WORK_THEMES, TRUST, BOUNDARIES } from './constants';
import { BentoCard } from './cards';
import { CRISIS_HOTLINES } from '../../../../shared/src/utils/crisisMarkers';

// Статические секции лендинга (маркетинг, без состояния страницы). Вынесено
// из LandingPage.tsx (правило №10). Каждая секция сама держит reveal-ref.

export function WorkSection() {
  const ref = useReveal() as React.RefObject<HTMLElement>;
  return (
      <section id="work" ref={ref} className="reveal-section" style={{ background: 'var(--bg-rail)', borderTop: '1px solid var(--line)', padding: '80px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 10px' }}>С чем я работаю</p>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(30px, 3.8vw, 48px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 16px', letterSpacing: '-.01em' }}>
            Если узнаёте <span style={{ fontStyle: 'italic' }}>себя</span>
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.7, margin: '0 0 44px', maxWidth: 560 }}>
            Эти темы чаще всего приносят на сессии. Не обязательно формулировать запрос идеально – достаточно ощущения «это про меня».
          </p>
          <div className="work-grid">
            {WORK_THEMES.map(t => (
              <div key={t.title} style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 16, padding: '24px 22px' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>{t.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.65, margin: 0 }}>{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
  );
}

export function EducationSection() {
  const ref = useReveal() as React.RefObject<HTMLElement>;
  return (
      <section id="education" ref={ref} className="reveal-section" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '64px 40px' }}>
        <div className="edu-grid" style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 12px' }}>Образование</p>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(26px, 3vw, 38px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 18px', lineHeight: 1.2, letterSpacing: '-.01em' }}>
              Подготовка<br /><span style={{ fontStyle: 'italic' }}>и обучение</span>
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7, margin: 0, maxWidth: 290 }}>
              Регулярно повышаю квалификацию – это методы, которые использую в работе с вами.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {EDUCATION.map((item, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '72px 1fr', gap: '0 20px',
                padding: '18px 0',
                borderTop: '1px solid var(--line)',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', paddingTop: 3, whiteSpace: 'nowrap' }}>{item.year}</span>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>{item.title}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0, lineHeight: 1.6 }}>
                    {item.placeUrl
                      ? <a href={item.placeUrl} target="_blank" rel="noopener noreferrer"
                          style={{ color: 'var(--accent)', textDecoration: 'none', borderBottom: '1px solid var(--accent-line)' }}>{item.place} ↗</a>
                      : item.place}
                    {' · '}{item.note}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
  );
}

export function TrustSection() {
  const ref = useReveal() as React.RefObject<HTMLElement>;
  return (
      <section ref={ref} className="reveal-section" style={{ padding: '80px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 10px' }}>Этика и качество практики</p>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(30px, 3.8vw, 46px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 44px', letterSpacing: '-.01em' }}>
            Почему мне можно <span style={{ fontStyle: 'italic' }}>доверять</span>
          </h2>
          <div className="trust-grid">
            {TRUST.map((t, i) => (
              <div key={t.title} style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 22, borderTop: '1px solid var(--line-strong)' }}>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 28, fontStyle: 'italic', color: 'var(--accent)', lineHeight: 1 }}>0{i + 1}</span>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{t.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.7, margin: 0 }}>{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
  );
}

export function ApproachSection() {
  const ref = useReveal() as React.RefObject<HTMLElement>;
  return (
      <section id="approach" ref={ref} className="reveal-section" style={{ background: 'var(--bg-rail)', padding: '80px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 10px' }}>Подход</p>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(30px, 3.8vw, 48px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 44px', letterSpacing: '-.01em' }}>Как я работаю</h2>
          <div className="bento-grid">
            <div className="bento-tall"><BentoCard num="01" title={'Схема-\nтерапия'} text="Работаем с глубинными убеждениями и режимами, которые сформировались ещё в детстве – и тихо управляют сегодняшними выборами." accent /></div>
            <div className="bento-wide"><BentoCard num="02" title="Тёплый контакт" text="Наши отношения – не нейтральный экран, а инструмент изменений. Я присутствую в сессии целиком и использую этот контакт как часть терапии." /></div>
            <div><BentoCard num="03" title="Доказательная база" text="Схема-терапия – один из наиболее исследованных методов работы с хроническими трудностями, это подтверждают клинические исследования." /></div>
            <div><BentoCard num="04" title="Долгосрочный результат" text="Работаем глубже одного симптома — на то, как вы воспринимаете себя. Медленнее, зато надолго." /></div>
          </div>
        </div>
      </section>
  );
}

export function ProcessSection() {
  const ref = useReveal() as React.RefObject<HTMLElement>;
  return (
      <section id="process" ref={ref} className="reveal-section" style={{ background: DARK_BG, padding: '80px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(236,234,229,.4)', margin: '0 0 10px' }}>Как начать</p>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, color: INK_ON_DARK, margin: '0 0 56px', letterSpacing: '-.01em' }}>Три шага до первой встречи</h2>
          <div className="process-grid">
            {[
              { n: '01', title: 'Оставьте заявку', sub: 'Имя и контакт – этого достаточно. Можно добавить пару слов о запросе.' },
              { n: '02', title: 'Знакомство 15 минут', sub: 'Бесплатная встреча: расскажете о ситуации, я – о подходе. Без давления.' },
              { n: '03', title: 'Начинаем работу', sub: 'Если подходим друг другу – назначаем регулярные сессии и двигаемся вглубь.' },
            ].map((s, i) => (
              <div key={i} style={{ borderLeft: i > 0 ? '1px solid rgba(255,255,255,.08)' : 'none', padding: '0 40px 0 ' + (i > 0 ? '40px' : '0') }}>
                <p style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(52px, 6vw, 80px)', fontWeight: 400, color: 'rgba(144,137,224,.3)', lineHeight: 1, margin: '0 0 16px', letterSpacing: '-.03em' }}>{s.n}</p>
                <p style={{ fontSize: 18, fontWeight: 600, color: INK_ON_DARK, margin: '0 0 10px' }}>{s.title}</p>
                <p style={{ fontSize: 14, color: 'rgba(236,234,229,.5)', lineHeight: 1.7, margin: 0 }}>{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
  );
}

export function BoundariesSection() {
  const ref = useReveal() as React.RefObject<HTMLElement>;
  return (
      <section ref={ref} className="reveal-section" style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 40px 80px' }}>
        <div style={{ border: '1px solid var(--line)', borderRadius: 24, padding: 'clamp(28px, 4vw, 48px)', background: 'var(--bg-elev)' }}>
          <div className="bound-grid">
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 10px' }}>Границы помощи</p>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(26px, 3vw, 38px)', fontWeight: 400, color: 'var(--text)', margin: '0 0 16px', lineHeight: 1.2, letterSpacing: '-.01em' }}>
                Когда нужен<br /><span style={{ fontStyle: 'italic' }}>другой специалист</span>
              </h2>
              <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7, margin: 0 }}>
                Это психологическое консультирование, а не медицинская психотерапия по ФЗ-323. Есть ситуации, где эффективнее и безопаснее другая помощь – и я сразу об этом скажу.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {BOUNDARIES.map(b => (
                <div key={b} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--c-clay)', fontSize: 15, flexShrink: 0, lineHeight: 1.6 }}>→</span>
                  <span style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6 }}>{b}</span>
                </div>
              ))}
              <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.7, margin: '8px 0 0', paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                Если на знакомстве станет ясно, что вам нужен врач, – помогу сориентироваться. Бесплатные телефоны доверия в кризисной ситуации: <a href={CRISIS_HOTLINES[0].tel} style={{ color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>{CRISIS_HOTLINES[0].display}</a>, для подростков и родителей – <a href={CRISIS_HOTLINES[1].tel} style={{ color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>{CRISIS_HOTLINES[1].display}</a>.
              </p>
            </div>
          </div>
        </div>
      </section>

  );
}
