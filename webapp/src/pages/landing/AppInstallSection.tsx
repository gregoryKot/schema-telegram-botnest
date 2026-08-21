import { useEffect } from 'react';
import { api } from '../../api';
import { INK, SUB, FAINT, GLASS, GLASS_BORDER, VIOLET, CYAN, EMERALD, glow } from './aurora';
import { H2, EYEBROW } from './productContent';
import { Cta } from './BrandKit';
import { INSTALL_STEPS } from '../../components/installGuide/installSteps';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { subscribeAppInstalled } from '../../utils/pwaInstall';

// Секция «значок на экране» продуктового лендинга: сайт ставится как
// приложение прямо из браузера (манифест у корня ведёт в /app/). Шаги — из
// общего источника installSteps, те же, что в баннере кабинета (одна
// механика — один источник текста). Аналитика анонимная: гость лендинга не
// авторизован, событие уходит в POST /api/public-event (userId = null).
const CARD_COLORS = { ios: CYAN, android: EMERALD, desktop: VIOLET } as const;

const trackInstall = (action: 'add' | 'added') =>
  api.trackPublicEvent('home_screen_offer', { action, surface: 'site_landing' });

export function AppInstallSection() {
  const { canPrompt, install } = useInstallPrompt();
  useEffect(() => subscribeAppInstalled(() => trackInstall('added')), []);

  return (
    <section id="app" style={{ padding: '72px 24px', scrollMarginTop: 70 }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <span style={EYEBROW}>Приложение</span>
        <h2 style={{ ...H2, margin: '14px 0 18px', maxWidth: 640 }}>
          Значок на экране — без App Store
        </h2>
        <p style={{ fontSize: 15.5, lineHeight: 1.7, color: SUB, maxWidth: 560, margin: '0 0 36px' }}>
          «Всё по схеме» ставится прямо из браузера: значок на экране телефона,
          запуск на весь экран, вход через Telegram или Google. Данные общие с
          Telegram-версией — дневник, начатый там, продолжается здесь.
        </p>
        <div
          className="pl2-3"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginBottom: 36 }}
        >
          {(['ios', 'android', 'desktop'] as const).map((p) => {
            const b = INSTALL_STEPS[p];
            return (
              <div
                key={p}
                style={{
                  position: 'relative', overflow: 'hidden',
                  background: GLASS, border: `1px solid ${GLASS_BORDER}`,
                  borderRadius: 22, padding: '24px 22px',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute', top: -40, right: -40, width: 120, height: 120,
                    borderRadius: '50%', background: glow(CARD_COLORS[p], 0.16),
                    filter: 'blur(30px)', pointerEvents: 'none',
                  }}
                />
                <p style={{ position: 'relative', fontSize: 17, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 4px', color: INK }}>
                  {b.title}
                </p>
                <p style={{ position: 'relative', fontSize: 13, fontWeight: 600, color: FAINT, margin: '0 0 12px' }}>
                  {b.browser}
                </p>
                <ol style={{ position: 'relative', margin: 0, padding: '0 0 0 18px', color: SUB, fontSize: 14, lineHeight: 1.65, display: 'grid', gap: 6 }}>
                  {b.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <Cta href="/app/" size="lg">Открыть приложение</Cta>
          {canPrompt && (
            <Cta
              href="#app"
              variant="ghost"
              size="lg"
              onClick={(e) => {
                e.preventDefault();
                trackInstall('add');
                install();
              }}
            >
              Установить сейчас
            </Cta>
          )}
        </div>
      </div>
    </section>
  );
}
