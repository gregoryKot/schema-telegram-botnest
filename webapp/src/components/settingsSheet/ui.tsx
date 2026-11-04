import '../../styles/sheet-settings.css';
import { useHistorySheet } from '../../hooks/useHistorySheet';

// Примитивы SettingsSheet (правило №10): вид — st-* из sheet-settings.css + ds-*;
// label у Toggle — имя switch для скринридера, обычно заголовок его строки SRow.
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
  const cls = `ds-list-row ds-list-row--nav ds-list-row--inset${onClick ? ' ds-list-row--hover' : ''}${danger ? ' st-row--danger' : ''}`;
  return (
    <div className={cls} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? onKeyActivate(onClick) : undefined}>
      <div className="ds-list-body">
        <div className="ds-list-title">{title}</div>
        {sub && <div className="ds-list-sub">{sub}</div>}
      </div>
      {right ?? (onClick && <span className="ds-chev" aria-hidden="true" />)}
    </div>
  );
}

function Switch({ on, onClick, small, label }: { on: boolean; onClick: () => void; small?: boolean; label: string }) {
  return (
    <div onClick={onClick} role="switch" aria-checked={on} aria-label={label} tabIndex={0}
      onKeyDown={onKeyActivate(onClick)}
      className={`ds-switch${small ? ' ds-switch--sm' : ''}`}>
      <div className="ds-switch-knob" />
    </div>
  );
}

export function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <Switch on={on} onClick={onClick} label={label} />;
}

export function SmallToggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <Switch on={on} onClick={onClick} label={label} small />;
}

export function ChevronVal({ text }: { text: string; small?: boolean }) {
  return (
    <div className="st-row-right">
      <span className="ds-sub">{text}</span>
      <span className="ds-chev" aria-hidden="true" />
    </div>
  );
}

export function InfoModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // Вложенный уровень над листом настроек: «Назад» закрывает только окно (QA 2026-11, C-З2).
  const goBack = useHistorySheet(onClose);
  const close = () => goBack();
  return (
    <div className="sheet-modal" onClick={close} role="button" tabIndex={0} aria-label="Закрыть"
      onKeyDown={onKeyActivate(close)}>
      <div
        role="presentation"
        className="sheet-modal-box"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); } }}
      >
        <div className="sheet-modal-handle" />
        {children}
        {/* Закрыть можно было только кликом мимо или Escape — у «Сводки для
            терапевта» и пояснений не было кнопки (QA 2026-11, М11). */}
        <button type="button" className="ds-btn ds-btn--secondary st-block st-modal-close" onClick={close}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
