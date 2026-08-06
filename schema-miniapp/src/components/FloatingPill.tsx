import { useState } from 'react';
import { api } from '../api';
import { PlusMenuSheet } from './plusMenu/PlusMenuSheet';
import type { QuickActionId } from '../utils/quickActions';

interface Props {
  onAction: (id: QuickActionId) => void;
}

// Кнопка «плюс»: открывает меню быстрых действий (PlusMenuSheet), собранное
// из единого реестра utils/quickActions.ts — раньше 4 пункта были зашиты
// прямо здесь.
export function FloatingPill({ onAction }: Props) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      <div
        style={{
          position: 'fixed',
          bottom: 'calc(84px + var(--safe-bottom))',
          right: 16,
          zIndex: 49,
        }}
      >
        <button
          onClick={() => {
            api.trackEvent('plus_open');
            setShowMenu(true);
          }}
          aria-label="Быстрое действие"
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: 'none',
            // Сплошной акцент вместо сине-фиолетового градиента: градиент был
            // прописан хексами мимо токенов и светился чужим цветом на тёплой
            // бумаге. Тень — по потолку системы (мягкая, без цветного ореола).
            background: 'var(--accent)',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(34, 30, 27, 0.18)',
            WebkitTapHighlightColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            transition: 'transform 120ms, box-shadow 120ms',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="10" y="2" width="2" height="18" rx="1" fill="white" />
            <rect x="2" y="10" width="18" height="2" rx="1" fill="white" />
          </svg>
        </button>
      </div>

      {showMenu && (
        <PlusMenuSheet onAction={onAction} onClose={() => setShowMenu(false)} />
      )}
    </>
  );
}
