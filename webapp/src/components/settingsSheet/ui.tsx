import '../../styles/sheet-settings.css';
import { useId } from 'react';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useDialogA11y } from '../../../../shared/src/utils/dialogA11y';
import { glue } from '../../../../shared/src/utils/typo';

// Примитивы SettingsSheet (правило №10): вид — st-* из sheet-settings.css + ds-*;
// label у Toggle — имя switch для скринридера, обычно заголовок его строки SRow.
const onKeyActivate = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
};

/** Событие на самой подложке окна, а не всплывшее из него: клик и Enter внутри окна его не закрывают. */
const onBackdrop = (e: { target: EventTarget; currentTarget: EventTarget }) => e.target === e.currentTarget;

/** Галочка-знак вместо глифа «✓»: цвет — текущий текст (статус «Сохранено», выбранная строка, «Скопировано»). */
export function Tick() {
  return (
    <svg className="st-tick" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M3 8.6l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Раздел листа — плоская группа на бумаге страницы: ярлык, под ним строки через линию (b25);
 *  id нужен боковому оглавлению. Без label — группа из одной строки («О приложении»). */
export function SSection({ id, label, hint, help, children }: {
  id: string; label?: string; hint?: string; help?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="st-section">
      <div id={id} className="st-sec-head">
        {label && (
          <div className="st-sec-title">
            <div className="ds-label">{label}</div>
            {help}
          </div>
        )}
        {hint && <div className="st-hint">{hint}</div>}
      </div>
      <div className="st-rows">{children}</div>
    </section>
  );
}

export function SRow({ title, sub, right, onClick, danger, opens }: {
  title: string; sub?: React.ReactNode; right?: React.ReactNode;
  onClick?: () => void; danger?: boolean;
  /** Подэкран, который открывает строка: по этой метке лист возвращает на неё фокус (useSubViewNav). */
  opens?: string;
}) {
  const cls = `ds-list-row ds-list-row--nav ds-list-row--inset${onClick ? ' ds-list-row--hover' : ''}${danger ? ' ds-list-row--danger' : ''}`;
  return (
    <div className={cls} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} data-opens={opens}
      onKeyDown={onClick ? onKeyActivate(onClick) : undefined}>
      <div className="ds-list-body">
        <div className="ds-list-title">{title}</div>
        {sub && <div className="ds-list-sub">{sub}</div>}
      </div>
      {right ?? (onClick && <span className="ds-chev" aria-hidden="true" />)}
    </div>
  );
}

// busy — запрос в пути (включение пушей): тумблер бледнеет и не жмётся, спиннер — только у кнопок.
export function Toggle({ on, onClick, label, describedBy, busy }: { on: boolean; onClick: () => void; label: string; describedBy?: string; busy?: boolean }) {
  const act = busy ? () => undefined : onClick;
  return (
    <div onClick={act} role="switch" aria-checked={on} aria-label={label} aria-describedby={describedBy} tabIndex={0}
      aria-busy={busy || undefined} aria-disabled={busy || undefined} onKeyDown={onKeyActivate(act)} className="ds-switch">
      <div className="ds-switch-knob" />
    </div>
  );
}

export function ChevronVal({ text }: { text: string }) {
  return (
    <div className="st-row-right">
      <span className="ds-sub">{text}</span>
      <span className="ds-chev" aria-hidden="true" />
    </div>
  );
}

export function InfoModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  // Вложенный уровень над листом настроек: «Назад» закрывает только окно (QA 2026-11, C-З2).
  const goBack = useHistorySheet(onClose);
  // Окно — диалог: фокус внутрь, Tab не уходит в лист под ним, при закрытии фокус возвращается на вызвавшую кнопку.
  const a11y = useDialogA11y();
  const titleId = useId();
  const close = () => goBack();
  return (
    <div className="sheet-modal" role="button" tabIndex={-1} aria-label="Закрыть"
      onClick={e => { if (onBackdrop(e)) close(); }}
      onKeyDown={e => { if (onBackdrop(e)) onKeyActivate(close)(e); }}>
      <div {...a11y} aria-labelledby={titleId} className="sheet-modal-box">
        {/* glue: предлог не висит в конце строки («Данные и / конфиденциальность») */}
        <h2 id={titleId} className="dialog-title st-modal-title">{glue(title)}</h2>
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
