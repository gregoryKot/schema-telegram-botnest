import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { useTr } from '../utils/addressForm';

interface Props {
  onOpenSchemaDiary: () => void;
  onOpenModeDiary: () => void;
  onOpenGratitude: () => void;
  onOpenTracker: () => void;
}

export function FloatingPill({
  onOpenSchemaDiary,
  onOpenModeDiary,
  onOpenGratitude,
  onOpenTracker,
}: Props) {
  const tr = useTr();
  const [showPicker, setShowPicker] = useState(false);

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
          onClick={() => setShowPicker(true)}
          aria-label="Быстрое действие"
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: 'none',
            background: 'linear-gradient(135deg, #60a5fa, #7c72f8)',
            cursor: 'pointer',
            boxShadow:
              '0 6px 24px rgba(96,165,250,0.45), 0 2px 8px rgba(124,114,248,0.3)',
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

      {showPicker && (
        <BottomSheet onClose={() => setShowPicker(false)} zIndex={200}>
          <div style={{ paddingTop: 4, paddingBottom: 8 }}>
            <div className="d-caps" style={{ marginBottom: 10 }}>
              Записать момент
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <DiaryTypeButton
                label="Схема"
                sub="Когда сработал паттерн"
                onClick={() => {
                  setShowPicker(false);
                  onOpenSchemaDiary();
                }}
              />
              <DiaryTypeButton
                label="Режим"
                sub="Какой режим активировался"
                onClick={() => {
                  setShowPicker(false);
                  onOpenModeDiary();
                }}
              />
              <DiaryTypeButton
                label="Благодарность"
                sub="Что было хорошего"
                onClick={() => {
                  setShowPicker(false);
                  onOpenGratitude();
                }}
              />
            </div>
            <div
              style={{
                borderTop: '1px solid rgba(var(--fg-rgb),0.07)',
                paddingTop: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text-sub)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                Оценить день
              </div>
              <DiaryTypeButton
                label="Трекер потребностей"
                sub={tr(
                  'Оцени день по пяти шкалам',
                  'Оцените день по пяти шкалам',
                )}
                onClick={() => {
                  setShowPicker(false);
                  onOpenTracker();
                }}
              />
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}

// Строка выбора дневника: название и подпись, без иконки и без своего цвета.
// Три цветные плашки подряд спорили друг с другом, а выбирают здесь по смыслу.
function DiaryTypeButton({
  label,
  sub,
  onClick,
}: {
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 60,
        padding: '14px 16px',
        borderRadius: 16,
        border: '1px solid var(--line)',
        background: 'var(--surface)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
          {sub}
        </div>
      </div>
    </button>
  );
}
