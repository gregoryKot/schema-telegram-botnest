import { useEffect } from 'react';
import { api } from '../../api';
import { Cta } from './BrandKit';
import { PaperBand } from './PaperBand';
import { glue } from './typo';
import { SceneHomeScreen } from '../../components/art/LandingScenesMore';
import { INSTALL_STEPS } from '../../components/installGuide/installSteps';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { hideInstallOffers, subscribeAppInstalled } from '../../utils/pwaInstall';

// Секция «значок на экране» лендинга — полоса небесной бумаги: сайт ставится как приложение из
// браузера (манифест ведёт в /today; страница — /install). Шаги — из installSteps (один
// источник текста). Рядом с заголовком — сцена «значок на экране» (SceneHomeScreen: знак
// продукта среди значков на экране телефона): самая длинная полоса страницы не без картинки.
// Аналитика анонимная: событие в POST /api/public-event (userId = null).
const trackInstall = (action: 'add' | 'added') =>
  api.trackPublicEvent('home_screen_offer', { action, surface: 'site_landing' });

export function AppInstallSection() {
  const { canPrompt, install } = useInstallPrompt();
  useEffect(() => subscribeAppInstalled(() => trackInstall('added')), []);

  // Лендинг в scope установленного приложения: открытый изнутри standalone,
  // он не должен предлагать поставить то, что уже стоит.
  if (hideInstallOffers()) return null;

  return (
    <PaperBand id="app" calm>
      <div className="pl2-wrap">
        <div className="pl2-app-head">
          <div>
            <span className="pl2-eyebrow">Приложение</span>
            <h2 className="pl2-h2">{glue('Значок на экране — без магазина приложений')}</h2>
            <p className="pl2-sub">
              {glue('«Всё по схеме» ставится прямо из браузера: значок на экране телефона, запуск на весь экран, вход тот же, что на сайте.')}
            </p>
          </div>
          <div className="pl2-app-art"><SceneHomeScreen /></div>
        </div>
        <div className="pl2-3 pl2-3--above-actions">
          {(['ios', 'android', 'desktop'] as const).map((p) => {
            const b = INSTALL_STEPS[p];
            return (
              <div key={p} className="ds-card pl2-card pl2-install">
                <p className="pl2-card-title">{b.title}</p>
                <p className="pl2-card-meta">{b.browser}</p>
                <ol className="pl2-card-list">
                  {b.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
        <div className="pl2-actions">
          <Cta href="/today" size="lg">Открыть приложение</Cta>
          <Cta href="/install" variant="ghost" size="lg">Страница установки</Cta>
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
    </PaperBand>
  );
}
