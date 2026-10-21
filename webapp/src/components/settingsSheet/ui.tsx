import '../../styles/sheet-settings.css';

// Примитивы SettingsSheet (правило №10): вид — st-* из sheet-settings.css + ds-*.

const onKeyActivate = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
};

/** Раздел листа: карточка с заголовком-ярлыком; id нужен боковому оглавлению. */
export function SSection({ id, label, hint, help, children }: {
  id: string; label: string; hint?: string; help?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="ds-card st-section">
      <div id={id} className="st-sec-head">
        <div className="st-sec-title">
          <div className="ds-label">{label}</div>
          {help}
        </div>
        {hint && <div className="st-hint">{hint}</div>}
      </div>
      {children}
    </section>
  );
}

export function SRow({ title, sub, right, onClick, danger }: {
  title: string; sub?: React.ReactNode; right?: React.ReactNode;
  onClick?: () => void; danger?: boolean;
}) {
  const cls = `st-row${onClick ? ' st-row--click' : ''}${danger ? ' st-row--danger' : ''}`;
  return (
    <div className={cls} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? onKeyActivate(onClick) : undefined}>
      <div>
        <div className="st-row-title">{title}</div>
        {sub && <div className="st-row-sub">{sub}</div>}
      </div>
      {right ?? (onClick && <span className="st-chev-arrow">›</span>)}
    </div>
  );
}

function Switch({ on, onClick, small }: { on: boolean; onClick: () => void; small?: boolean }) {
  return (
    <div onClick={onClick} role="switch" aria-checked={on} tabIndex={0}
      onKeyDown={onKeyActivate(onClick)}
      className={`ds-switch${small ? ' ds-switch--sm' : ''}`}>
      <div className="ds-switch-knob" />
    </div>
  );
}

export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <Switch on={on} onClick={onClick} />;
}

export function SmallToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <Switch on={on} onClick={onClick} small />;
}

export function ChevronVal({ text, small }: { text: string; small?: boolean }) {
  return (
    <div className="st-row-right">
      <span className={`st-chev${small ? ' st-chev--sm' : ''}`}>{text}</span>
      <span className="st-chev-arrow">›</span>
    </div>
  );
}

export function InfoModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="sheet-modal" onClick={onClose} role="button" tabIndex={0} aria-label="Закрыть"
      onKeyDown={onKeyActivate(onClose)}>
      <div
        role="presentation"
        className="sheet-modal-box"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); } }}
      >
        <div className="sheet-modal-handle" />
        {children}
      </div>
    </div>
  );
}
