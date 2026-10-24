import { useEffect, useState } from 'react';
import { getHost } from '../../../../shared/src/host';
import { buildHomeScreenHint, homeScreenPlatform } from '../../../../shared/src/host/homeScreen';
import { AddHomeScreenButton } from '../../../../shared/src/host/AddHomeScreenButton';
import { useTr } from '../../utils/addressForm';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { detectInstallPlatform, subscribeAppInstalled } from '../../utils/pwaInstall';
import { INSTALL_STEPS } from '../installGuide/installSteps';
import { SSection } from './ui';
import type { HomeIconMode } from './homeIconMode';

// Раздел «Значок на экране» в настройках — постоянный путь к тому, что на
// «Сегодня» предлагает карточка (после «Не предлагать» она не возвращается).
// Паритет с HomeScreenSection мини-аппа. Внутри мессенджера — та же кнопка,
// что у карточки (shared AddHomeScreenButton); в браузере — установка PWA.
export function HomeScreenSection({ mode }: { mode: Exclude<HomeIconMode, null> }) {
  return (
    <SSection id="s-home" label="Значок на экране">
      <div className="st-body-block">
        {mode === 'messenger' ? <MessengerBody /> : <BrowserBody />}
      </div>
    </SSection>
  );
}

function MessengerBody() {
  const tr = useTr();
  const platform = homeScreenPlatform(getHost().platform);
  return (
    <>
      <div className="st-actions">
        <AddHomeScreenButton className="ds-btn ds-btn--sm">Добавить значок на экран</AddHomeScreenButton>
      </div>
      <p className="st-text st-text--faint">{buildHomeScreenHint(platform, tr)}</p>
    </>
  );
}

function BrowserBody() {
  const tr = useTr();
  const { canPrompt, install } = useInstallPrompt();
  const [installed, setInstalled] = useState(false);
  useEffect(() => subscribeAppInstalled(() => setInstalled(true)), []);
  const guide = INSTALL_STEPS[detectInstallPlatform()];

  if (installed) return <p className="st-text">{tr('Готово: значок появился. Открывай приложение с него.', 'Готово: значок появился. Открывайте приложение с него.')}</p>;
  return (
    <>
      <p className="st-text">
        Сайт ставится как приложение прямо из браузера: значок на экране, запуск на весь экран, вход тот же.
      </p>
      {canPrompt ? (
        <div className="st-actions">
          <button type="button" className="ds-btn ds-btn--sm" onClick={install}>Установить приложение</button>
        </div>
      ) : (
        <div>
          <div className="st-text st-text--faint">{guide.title}. {guide.browser}</div>
          <ol className="st-steps">
            {guide.steps.map(s => <li key={s}>{s}</li>)}
          </ol>
        </div>
      )}
    </>
  );
}
