import { useState } from 'react';
import { SettingsLabel } from './ui';
import { canOfferHomeScreenNow } from '../../utils/homeScreen';

// Значок на экране — из настроек.
// ВРЕМЕННАЯ ДИАГНОСТИКА: голая <button> + вывод прямо на экран (не через
// showAlert/alert — они на этом клиенте, похоже, не работают). Если после
// тапа текст сменится — клик доходит, увидим version/platform.
export function HomeScreenSection() {
  const [debug, setDebug] = useState<string>('');

  if (!canOfferHomeScreenNow()) return null;

  return (
    <div style={{ marginBottom: 8 }}>
      <SettingsLabel>ЗНАЧОК НА ЭКРАНЕ</SettingsLabel>
      <div className="card" style={{ borderRadius: 16, padding: 14 }}>
        <button
          onClick={() => {
            const tg = window.Telegram?.WebApp;
            let result = 'ok';
            try {
              tg?.addToHomeScreen?.();
            } catch (e) {
              result = 'ERR:' + String(e);
            }
            setDebug(
              `КЛИК ДОШЁЛ ✓\n` +
                `version=${tg?.version}\n` +
                `platform=${tg?.platform}\n` +
                `addToHomeScreen=${typeof tg?.addToHomeScreen}\n` +
                `showAlert=${typeof tg?.showAlert}\n` +
                `вызов=${result}`,
            );
          }}
          style={{
            width: '100%',
            padding: '14px',
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
          📲 Добавить значок (тест)
        </button>
        {debug && (
          <pre
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              background: 'rgba(var(--fg-rgb),0.06)',
              color: 'var(--text)',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {debug}
          </pre>
        )}
      </div>
    </div>
  );
}
