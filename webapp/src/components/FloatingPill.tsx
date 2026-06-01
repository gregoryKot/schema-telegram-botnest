import { useState } from 'react';

interface Props {
  onOpenSchemaDiary: () => void;
  onOpenModeDiary: () => void;
  onOpenGratitude: () => void;
  onOpenTracker: () => void;
}

export function FloatingPill({ onOpenSchemaDiary, onOpenModeDiary, onOpenGratitude, onOpenTracker }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <>
      <div style={{ position: 'fixed', bottom: 84, right: 16, zIndex: 49 }}>
        <button
          onClick={() => setShowPicker(true)}
          style={{
            width: 60, height: 60, borderRadius: '50%', border: 'none',
            background: 'linear-gradient(135deg, #60a5fa, #7c72f8)',
            cursor: 'pointer',
            boxShadow: '0 6px 24px rgba(96,165,250,0.45), 0 2px 8px rgba(124,114,248,0.3)',
            WebkitTapHighlightColor: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, transition: 'transform 120ms, box-shadow 120ms',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="10" y="2" width="2" height="18" rx="1" fill="white"/>
            <rect x="2" y="10" width="18" height="2" rx="1" fill="white"/>
          </svg>
        </button>
      </div>

      {showPicker && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowPicker(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg)', borderRadius: '24px 24px 0 0', padding: '24px 20px 48px', width: '100%', maxWidth: 560, margin: '0 auto' }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(var(--fg-rgb),0.12)', margin: '0 auto 20px' }} />
            <div className="eyebrow" style={{ marginBottom: 12 }}>Записать момент</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <DiaryTypeButton emoji="📓" label="Схема" sub="Когда сработал паттерн" color="#a78bfa"
                onClick={() => { setShowPicker(false); onOpenSchemaDiary(); }} />
              <DiaryTypeButton emoji="🔄" label="Режим" sub="Какой режим активировался" color="#60a5fa"
                onClick={() => { setShowPicker(false); onOpenModeDiary(); }} />
              <DiaryTypeButton emoji="🌱" label="Благодарность" sub="Что было хорошего" color="#34d399"
                onClick={() => { setShowPicker(false); onOpenGratitude(); }} />
            </div>
            <div style={{ borderTop: '1px solid rgba(var(--fg-rgb),0.07)', paddingTop: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Оценить день</div>
              <DiaryTypeButton emoji="📅" label="Трекер потребностей" sub="Оцени день по пяти шкалам" color="#fb923c"
                onClick={() => { setShowPicker(false); onOpenTracker(); }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DiaryTypeButton({ emoji, label, sub, color, onClick }: { emoji: string; label: string; sub: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', borderRadius: 16, border: `1px solid ${color}22`,
        background: `${color}0d`, cursor: 'pointer', textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontSize: 26 }}>{emoji}</span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  );
}
