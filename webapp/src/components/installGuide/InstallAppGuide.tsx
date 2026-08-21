import { useEffect } from 'react';
import {
  detectInstallPlatform,
  subscribeAppInstalled,
  type InstallPlatform,
} from '../../utils/pwaInstall';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { INSTALL_STEPS } from './installSteps';

// Разворачиваемая инструкция «как сохранить значок» для текущей платформы.
// Где браузер умеет ставить PWA сам (Chromium: beforeinstallprompt) — первой
// идёт настоящая кнопка установки; шаги руками остаются запасным путём.
// Стили нейтральные (currentColor), чтобы жить и в тёплой теме кабинета,
// и на тёмном лендинге. Аналитика — колбэком: баннер шлёт авторизованное
// событие, лендинг — анонимное через public-event.
export function InstallAppGuide({
  track,
  platform = detectInstallPlatform(),
}: {
  track: (action: 'add' | 'added') => void;
  platform?: InstallPlatform;
}) {
  const { canPrompt, install } = useInstallPrompt();
  const block = INSTALL_STEPS[platform];

  useEffect(() => subscribeAppInstalled(() => track('added')), [track]);

  return (
    <div className="install-guide">
      {canPrompt && (
        <button
          className="install-guide-native"
          onClick={() => {
            track('add');
            install();
          }}
        >
          Установить приложение
        </button>
      )}
      <div className="install-guide-browser">
        {canPrompt ? `Запасной путь руками — ${block.browser.toLowerCase()}` : block.browser}
      </div>
      <ol className="install-guide-steps">
        {block.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <div className="install-guide-note">
        Значок открывает «Всё по схеме» на весь экран, без адресной строки —
        как обычное приложение.
      </div>
    </div>
  );
}
