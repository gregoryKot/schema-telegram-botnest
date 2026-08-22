import { useEffect, useState } from 'react';
import { useTr } from '../utils/addressForm';
import { onUpdateAvailable, applyUpdate } from '../registerServiceWorker';

// Ненавязчивый тост «Доступна новая версия» (docs/PWA_PLAN.md фаза 1,
// autoUpdate). Молчаливое обновление при следующем открытии было бы проще,
// но оставило бы пользователя с устаревшей оболочкой посреди сессии без
// объяснения — тост с кнопкой честнее и ничего не ломает молча.
//
// Рендерится в main.tsx рядом с <App/> (внутри AddressFormProvider, ради
// useTr) — не fullscreen-оверлей (не inset:0), поэтому useHistorySheet не
// нужен (правило CLAUDE.md касается листов/экранов, не плавающих плашек).
export function UpdateToast() {
  const tr = useTr();
  const [available, setAvailable] = useState(false);

  useEffect(() => onUpdateAvailable(() => setAvailable(true)), []);

  if (!available) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        // Выше нижней навигации (60px + safe-area) — не перекрывает её.
        bottom: 'calc(76px + var(--safe-bottom, 0px))',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-10)',
        background: 'var(--sheet-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--r-14)',
        padding: '11px 12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.22)',
      }}
    >
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>
        {tr(
          'Вышла новая версия — обнови приложение',
          'Вышла новая версия — обновите приложение',
        )}
      </span>
      <button
        onClick={applyUpdate}
        style={{
          background: 'var(--accent)',
          color: 'var(--on-accent)',
          border: 'none',
          borderRadius: 'var(--r-10)',
          padding: '8px 14px',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {tr('Обнови', 'Обновите')}
      </button>
      {/* Цель нажатия ≥44×44 при компактном визуальном отпечатке (как в WebBanner). */}
      <button
        onClick={() => setAvailable(false)}
        aria-label="Скрыть"
        style={{
          width: 44,
          height: 44,
          margin: '-11px -12px -11px -2px',
          flexShrink: 0,
          background: 'none',
          border: 'none',
          color: 'var(--text-faint)',
          fontSize: 15,
          cursor: 'pointer',
        }}
      >
        ✕
      </button>
    </div>
  );
}
