import { useEffect } from 'react';
import { api } from '../../api';
import { Cta } from './BrandKit';
import { PaperBand } from './PaperBand';
import { glue } from '../../../../shared/src/utils/typo';
import { SceneHomeScreen } from '../../components/art/LandingScenesMore';
import { InstallBlock } from '../../components/installGuide/InstallBlock';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { hideInstallOffers, subscribeAppInstalled } from '../../utils/pwaInstall';
import { useHostId } from '../../host/useHostId';

// Секция «значок на экране» лендинга — полоса небесной бумаги: сайт ставится как приложение из браузера
// (манифест ведёт в /today; страница — /install). Шаги — из installSteps (один источник текста). Рядом
// с заголовком — сцена SceneHomeScreen: самая длинная полоса страницы не без картинки.
// Аналитика анонимная: событие в POST /api/public-event (userId = null).
const trackInstall = (action: 'add' | 'added') =>
  api.trackPublicEvent('home_screen_offer', { action, surface: 'site_landing' });

export function AppInstallSection() {
  const { canPrompt, install } = useInstallPrompt();
  const hostId = useHostId(); // SDK мессенджера может доехать после рендера — секция не мигает
  useEffect(() => subscribeAppInstalled(() => trackInstall('added')), []);

  // Лендинг в scope установленного приложения (standalone) не предлагает поставить то, что уже стоит.
  if (hideInstallOffers(hostId)) return null;

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
          <InstallBlock platforms={['ios', 'android', 'desktop']} look="landing" />
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
