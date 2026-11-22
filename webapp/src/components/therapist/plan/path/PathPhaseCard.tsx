import type { ReactNode } from 'react';
import { MMIcon } from '../../../modeMapIcons';
import type { RenderPlanRow } from '../planRows';
import { PathOverdueNote } from './PathOverdueNote';
import { formatPhaseRange, type PhaseRow } from './pathView';

interface Props {
  row: PhaseRow;
  /** Раскрыта на телефоне; в дорожках раскрыты все (CSS). */
  open: boolean;
  onToggle: () => void;
  busy: boolean;
  renderRow: RenderPlanRow;
  onCriterion: (n: number) => void;
  onAction: () => void;
  onShift: (weeks: number) => void;
  /** Кнопки правки фазы — строкой в конце раскрытой фазы. */
  tools?: ReactNode;
}

const ACTION_LABEL = { start: 'Начать фазу', advance: 'Завершить и перейти к следующей', finish: 'Завершить фазу' } as const;

/** Фаза на ленте: номер, срок с примерными датами, прогресс по пунктам; раскрытая — пункты, критерии, ошибки. */
export function PathPhaseCard({ row, open, onToggle, busy, renderRow, onCriterion, onAction, onShift, tools }: Props) {
  const { phase, tpl, progress } = row;
  const when = [`${phase.weeks} нед.`, `примерно ${formatPhaseRange(row.dates)}`, tpl?.sessionsHint].filter(Boolean).join(' · ');
  const criteria = tpl?.transition ?? [];
  return (
    <article className={`pp-leaf ph-card${row.current ? ' is-current' : ''}${row.done ? ' is-done' : ''}${open ? ' is-open' : ''}`}>
      <header className="ph-head">
        <span className="ph-num" aria-hidden>{row.index + 1}</span>
        <div className="ph-title">
          {row.current && <span className="ph-flag ph-flag--here">мы здесь</span>}
          {row.done && <span className="ph-flag ph-flag--done">пройдена</span>}
          <h3 className="ph-name">{phase.name}</h3>
          <div className="ph-when">{when}</div>
        </div>
        <div className="ph-tools">
          <button
            type="button" className="ds-btn ds-btn--icon tb-del ph-toggle" aria-expanded={open}
            aria-label={open ? `Свернуть фазу «${phase.name}»` : `Раскрыть фазу «${phase.name}»`} onClick={onToggle}
          >
            <MMIcon name="caret" size={16} />
          </button>
        </div>
      </header>
      {progress && progress.total > 0 && (
        <div className="ph-progress">
          <span>сделано {progress.done} из {progress.total}</span>
          <div className="ph-bar" aria-hidden><span style={{ width: `${Math.round((progress.share ?? 0) * 100)}%` }} /></div>
        </div>
      )}
      <div className="ph-body">
        {row.overdue && <PathOverdueNote overdue={row.overdue} busy={busy} onShift={onShift} />}
        {phase.goal && <p className="ph-goal">{phase.goal}</p>}
        {row.items.length > 0 && <div className="pl-list ph-items">{row.items.map((item) => renderRow(item))}</div>}
        {criteria.length > 0 && (
          <fieldset className="ph-set">
            <legend className="ds-label">Критерии перехода</legend>
            {criteria.map((text, n) => (
              <label key={text} className="ph-check">
                <input type="checkbox" checked={phase.criteriaDone.includes(n)} disabled={busy} onChange={() => onCriterion(n)} />
                <span>{text}</span>
              </label>
            ))}
          </fieldset>
        )}
        {tpl && tpl.mistakes.length > 0 && (
          <details className="ph-mistakes">
            <summary>Частые ошибки</summary>
            <ul>{tpl.mistakes.map((m) => <li key={m}>{m}</li>)}</ul>
          </details>
        )}
        {row.action && (
          <div className="ph-action">
            <button
              type="button" className={`ds-btn ds-btn--sm${row.action === 'start' ? '' : ' ds-btn--secondary'}`}
              disabled={busy} aria-busy={busy || undefined} onClick={onAction}
            >
              {ACTION_LABEL[row.action]}
            </button>
            {row.action !== 'start' && criteria.length > 0 && <span className="ds-sub">отмечено {row.criteriaDone} из {criteria.length}</span>}
          </div>
        )}
        {tools}
      </div>
    </article>
  );
}
