import { SettingsLabel } from './ui';
import { useTr } from '../../utils/addressForm';
import {
  canOfferHomeScreenNow,
  homeScreenPlatform,
  buildHomeScreenHint,
  triggerAddToHomeScreen,
} from '../../utils/homeScreen';

// Значок на экране — из настроек. Android — нативный addToHomeScreen; iOS —
// открытие страницы-инструкции браузером (нативный вызов на новых iOS молчит,
// см. triggerAddToHomeScreen).
export function HomeScreenSection() {
  const tr = useTr();
  if (!canOfferHomeScreenNow()) return null;

  const platform = homeScreenPlatform(window.Telegram?.WebApp?.platform);

  return (
    <div style={{ marginBottom: 8 }}>
      <SettingsLabel>ЗНАЧОК НА ЭКРАНЕ</SettingsLabel>
      <div className="card" style={{ borderRadius: 16, padding: 14 }}>
        <button
          onClick={() => triggerAddToHomeScreen(platform)}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 12,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          📲 Добавить значок
        </button>
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
