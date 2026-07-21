import { SettingsLabel } from './ui';
import { useTr } from '../../utils/addressForm';
import {
  canOfferHomeScreenNow,
  homeScreenPlatform,
  buildHomeScreenHint,
} from '../../utils/homeScreen';
import { AddHomeScreenButton } from '../AddHomeScreenButton';

// Значок на экране — из настроек. Механика кнопки (Android — нативный вызов,
// iOS — настоящая ссылка) — в AddHomeScreenButton.
export function HomeScreenSection() {
  const tr = useTr();
  if (!canOfferHomeScreenNow()) return null;

  const platform = homeScreenPlatform(window.Telegram?.WebApp?.platform);

  return (
    <div style={{ marginBottom: 8 }}>
      <SettingsLabel>ЗНАЧОК НА ЭКРАНЕ</SettingsLabel>
      <div className="card" style={{ borderRadius: 16, padding: 14 }}>
        <AddHomeScreenButton>📲 Добавить значок на экран</AddHomeScreenButton>
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: 'var(--text-faint)',
            lineHeight: 1.6,
          }}
        >
          {buildHomeScreenHint(platform, tr)}
        </div>
      </div>
    </div>
  );
}
