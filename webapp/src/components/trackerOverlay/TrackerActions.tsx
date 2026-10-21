import { hitboxStyle } from '../../utils/hitbox';

export function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  const hb = hitboxStyle(30, 30, 44);
  return (
    <button onClick={onClick} aria-label={label} style={hb.outer}>
      <span className="tk2-ico" style={hb.inner}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {children}
        </svg>
      </span>
    </button>
  );
}

/** Кнопки «Заметка» и «История» справа в шапке (общие для десктопа и телефона). */
export function TrackerActions({
  goBack,
  onOpenNote,
  onOpenHistory,
}: {
  goBack: () => void;
  onOpenNote?: () => void;
  onOpenHistory?: () => void;
}) {
  return (
    <>
      {onOpenNote && (
        <IconBtn label="Заметка" onClick={onOpenNote}>
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </IconBtn>
      )}
      {onOpenHistory && (
        <IconBtn
          label="История"
          onClick={() => {
            onOpenHistory();
            goBack();
          }}
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </IconBtn>
      )}
    </>
  );
}
