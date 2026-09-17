import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { pressable } from '../utils/a11y';
import { hitboxStyle } from '../utils/hitbox';
import { useTr } from '../utils/addressForm';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';

interface Props {
  onClose?: () => void;
  children: React.ReactNode;
  zIndex?: number;
  scrollRef?: React.RefObject<HTMLDivElement>;
  // Шит без закрытия (Disclaimer, CheckInSheet — В3 дизайн-аудита 2026-08):
  // прячет кнопку-полоску и подсказку, бэкдроп — просто фон без обработчика,
  // Escape не слушается. Раньше эти шиты передавали onClose={() => {}} —
  // все аффордансы закрытия оставались и молча не работали.
  dismissable?: boolean;
}

const HINT_KEY = 'sheet_close_hint_shown';

export function BottomSheet({
  onClose,
  children,
  zIndex = 200,
  scrollRef,
  dismissable = true,
}: Props) {
  const tr = useTr();
  const dialogProps = useDialogA11y();
  const canDismiss = dismissable && !!onClose;
  const [showHint, setShowHint] = useState(
    () => canDismiss && !localStorage.getItem(HINT_KEY),
  );

  // Close on Escape — только у отключаемых шитов.
  useEffect(() => {
    if (!canDismiss) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [canDismiss, onClose]);

  useEffect(() => {
    if (!showHint) return;
    localStorage.setItem(HINT_KEY, '1');
    const t = setTimeout(() => setShowHint(false), 2800);
    return () => clearTimeout(t);
  }, [showHint]);

  // Ручка больше не драг-хендл (вертикальный свайп конфликтует с жестом
  // Telegram «свернуть мини-апп» — главная цель волны 2026-08): визуально та
  // же полоска 36×4, но это настоящая кнопка «закрыть по тапу» с хитбоксом
  // ≥44px (hitboxStyle).
  const handleHit = hitboxStyle(36, 4, 44);

  // Портал в body: шит могут открывать из глубины карточек с CSS transform
  // (.card:active { transform: scale() } создаёт containing block — fixed
  // привязывался к карточке, бэкдроп уезжал и тап «мимо» не закрывал шит).
  return createPortal(
    <>
      <div
        {...(canDismiss ? pressable(onClose) : {})}
        aria-label={canDismiss ? 'Закрыть' : undefined}
        aria-hidden={canDismiss ? undefined : true}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex,
          background: 'rgba(34,30,27,0.35)',
          animation: 'fade-in 200ms ease',
        }}
      />
      <div
        {...dialogProps}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: zIndex + 1,
          background: 'var(--sheet-bg)',
          borderRadius: '22px 22px 0 0',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'sheet-up 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          outline: 'none',
        }}
      >
        {/* У несворачиваемого листа ручки нет, и без неё контент начинался
            с нулевого пикселя — первая строка (точки шагов онбординга)
            въезжала в зону скругления и резалась краем. Фидбек владельца
            2026-08-31, скрин визарда. */}
        {!canDismiss && (
          <div
            aria-hidden="true"
            data-testid="sheet-top-spacer"
            style={{ height: 18, flexShrink: 0 }}
          />
        )}
        {canDismiss && (
          <div
            style={{
              padding: '12px 0 6px',
              display: 'flex',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              style={handleHit.outer}
            >
              <div
                style={{
                  ...handleHit.inner,
                  borderRadius: 'var(--r-2)',
                  background: 'rgba(var(--fg-rgb),0.18)',
                }}
              />
            </button>
          </div>
        )}

        {/* One-time close hint */}
        {showHint && (
          <div
            style={{
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--text-sub)',
              padding: '0 0 10px',
              animation: 'fade-in 300ms ease',
              flexShrink: 0,
            }}
          >
            {tr(
              'Нажми на полоску сверху, чтобы закрыть',
              'Нажмите на полоску сверху, чтобы закрыть',
            )}
          </div>
        )}

        {/* Scrollable content */}
        <div ref={scrollRef} className="sheet-scroll">
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}
