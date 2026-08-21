import {
  detectInstallPlatform,
  type InstallPlatform,
} from '../../utils/pwaInstall';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { INSTALL_STEPS } from './installSteps';

// Разворачиваемая инструкция «как сохранить значок» для текущей платформы.
// Где браузер умеет ставить PWA сам (Chromium: beforeinstallprompt) — первой
// идёт настоящая кнопка установки; шаги руками остаются запасным путём.
// Стили нейтральные (currentColor), чтобы жить и в тёплой теме кабинета,
// и на тёмном лендинге. Аналитика — колбэком: событие 'added' здесь не
// трекается — подписка на appinstalled живёт у поверхности (баннер/лендинг),
// которая смонтирована всё время, а не только пока инструкция развёрнута.
export function InstallAppGuide({
  onInstallClick,
  platform = detectInstallPlatform(),
}: {
  onInstallClick: () => void;
  platform?: InstallPlatform;
}) {
  const { canPrompt, install } = useInstallPrompt();
  const block = INSTALL_STEPS[platform];
  // Строчная только первая буква предлога («В Chrome:» → «в Chrome:») —
  // toLowerCase() по всей строке калечил бы имена браузеров.
  const browserMid = block.browser.charAt(0).toLowerCase() + block.browser.slice(1);

  return (
    <div className="install-guide">
      {canPrompt && (
        <button
          className="install-guide-native"
          onClick={() => {
            onInstallClick();
            install();
          }}
        >
          Установить приложение
        </button>
      )}
      <div className="install-guide-browser">
        {canPrompt ? `Запасной путь руками — ${browserMid}` : block.browser}
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
