import { SettingsLabel } from './ui';
import { useTr } from '../../utils/addressForm';
import {
  canOfferHomeScreenNow,
  homeScreenPlatform,
  homeScreenButtonWorks,
  buildHomeScreenHint,
} from '../../utils/homeScreen';

// Значок на экране — из настроек. На Android — рабочая кнопка (addToHomeScreen).
// На iOS программный вызов молчит (Telegram 9.6), поэтому показываем инструкцию
// про нативное меню «⋯» — единственный рабочий путь.
export function HomeScreenSection() {
  const tr = useTr();
  if (!canOfferHomeScreenNow()) return null;

  const platform = homeScreenPlatform(window.Telegram?.WebApp?.platform);
  const buttonWorks = homeScreenButtonWorks(platform);

  return (
    <div style={{ marginBottom: 8 }}>
      <SettingsLabel>ЗНАЧОК НА ЭКРАНЕ</SettingsLabel>
      <div className="card" style={{ borderRadius: 16, padding: 14 }}>
        {buttonWorks ? (
          <button
            onClick={() => window.Telegram?.WebApp?.addToHomeScreen?.()}
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
        ) : (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>📲</span>
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text)',
                  marginBottom: 4,
                }}
              >
                Значок на экране
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-sub)',
                  lineHeight: 1.6,
                }}
              >
                {buildHomeScreenHint(platform, tr)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
