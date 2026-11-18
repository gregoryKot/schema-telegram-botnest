import type { CSSProperties } from 'react';
import { getModeById, getSchemaById } from '../../../../shared/src/schemaTherapy/schemaTherapyData';
import { useNeedData } from '../../../../shared/src/needs/needData';
import { modeName } from '../../../../shared/src/therapy/conceptGraph/conceptDigestModel';
import { techniqueJournal } from '../../../../shared/src/therapy/conceptGraph/techniqueJournal';
import { sessionJournal } from '../../../../shared/src/therapy/sessionWork/sessionJournal';
import { isEmptySummary, workSummary, type WorkSummaryTarget } from '../../../../shared/src/therapy/sessionWork/workSummary';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import { fmtDate } from '../../utils/format';
import type { ClientDetail } from './clientSheetTypes';
import { clientConceptLinks } from './useClientConceptGraph';
import { hasCustomMode, useCustomModeNames } from './useCustomModeNames';
import { useSessionWork } from './useSessionWork';

const times = (n: number) => `${n} ${pluralRu(n, 'раз', 'раза', 'раз')}`;

/**
 * «Что было сделано» на «Обзоре» (#1330): что делали на сессиях — сколько раз и
 * когда последний, и с какими режимами, схемами и потребностями работали. Тот
 * же журнал, что «На сессиях» во вкладке «Задания» (sessionJournal): пункты
 * итогов сессий и отметки «Делали сегодня». Видит только терапевт.
 */
export function ClientWorkSummary({ detail }: { detail: ClientDetail }) {
  const needData = useNeedData();
  const work = useSessionWork(detail);
  const customModes = useCustomModeNames(work.entries.some((e) => hasCustomMode(e.work)));
  const { source } = clientConceptLinks(detail);
  // Концептуализация не загрузилась — отметок нет, пункты итогов сессий остаются.
  const marksFailed = !!detail.conceptLoad?.failed;
  const summary = workSummary(sessionJournal(marksFailed ? [] : techniqueJournal(source), work.entries));

  // Режим или схема, которых больше нет в справочнике (и удалённый свой режим), строки не дают.
  const named = (list: WorkSummaryTarget[], name: (id: string) => string | undefined) =>
    list.flatMap((t) => { const n = name(t.id); return n ? [`${n} — ${times(t.count)}`] : []; }).join(', ');
  const withRows: [string, string][] = ([
    ['Режимы', named(summary.modes, (id) => {
      const name = (getModeById(id) ?? customModes.find((m) => m.id === id))?.name;
      return name && modeName({ name, alias: source.modeLinks.find((l) => l.modeId === id)?.alias.trim() ?? '' });
    })],
    ['Схемы', named(summary.schemas, (id) => getSchemaById(id)?.name)],
    ['Потребности', named(summary.needs, (id) => needData[id]?.name)],
  ] satisfies [string, string][]).filter(([, text]) => text);

  return (
    <section className="pp-leaf tk-leaf" style={{ '--h': ENTITY_LOOK.case.hue } as CSSProperties}>
      <div className="ds-head-row tk-card-head">
        <h2 className="ds-label tk-sec-label">Что было сделано</h2>
        {!isEmptySummary(summary) && <button className="ds-link" onClick={() => detail.setClientTab('tasks')}>Журнал →</button>}
      </div>
      {isEmptySummary(summary) && !work.failed && !marksFailed && (
        <div className="ds-sub">Пока пусто. Сводка собирается из «Что делали» в итогах сессий и отметок «Делали сегодня» в концептуализации.</div>
      )}
      {summary.done.length > 0 && (
        <ul className="tk-done">
          {summary.done.map((row) => (
            <li key={row.key} className="tk-done-row">
              <span className="ds-list-title">{row.title}</span>
              <span className="ds-sub tk-done-meta">{times(row.count)} · {row.count > 1 ? 'последний — ' : ''}{fmtDate(row.lastDay)}</span>
            </li>
          ))}
        </ul>
      )}
      {withRows.length > 0 && (
        <dl className="tk-done-with">
          {withRows.map(([label, text]) => (
            <div key={label}>
              <dt className="ds-sub">{label}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      )}
      {work.failed && <div className="ds-sub" role="status">Пункты из ранних записей сессий не загрузились — сводка неполная.</div>}
      {marksFailed && <div className="ds-sub" role="status">Отметки «Делали сегодня» не загрузились вместе с концептуализацией.</div>}
    </section>
  );
}
