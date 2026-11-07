import { useEffect, useId, useRef } from 'react';
import '../../styles/therapist-concept.css'; // классы листа техники (tcp-guide-*)
import { useTr } from '../../utils/addressForm';
import { fmtDate } from '../../utils/format';
import { useGuide } from '../../../../shared/src/therapy/conceptGraph/guideLoader';
import {
  journalDays, journalFromName, techniqueJournal, type TechniqueJournalEntry,
} from '../../../../shared/src/therapy/conceptGraph/techniqueJournal';
import { SkeletonList } from '../Skeleton';
import type { ClientDetail } from './clientSheetTypes';
import { clientConceptLinks } from './useClientConceptGraph';
import { useConceptGuide } from './guide/useConceptGuide';

interface Props {
  detail: ClientDetail;
  /** Пустой журнал: переход на вкладку «Концептуализация», где ставят отметку. */
  onOpenConcept?: () => void;
  /** Вкладку открыли «журнал →» из подсказок (true — один раз): блок прокручивается в вид. */
  takeFocus?: () => boolean;
}

/**
 * «На сессиях» вкладки «Задания» (#995) — журнал техник: отметки «Делали
 * сегодня» всех режимов и схем клиента по дням, новые сверху. Зеркало плашки
 * «Обычно в методе»: там «На сессии» и «Между сессиями», здесь задания (между
 * сессиями) и техники (на сессиях). Данные — связи концептуализации, которую
 * карточка уже загрузила (techniqueJournal); тап по строке — тот же лист
 * техники, что из схемы случая (useConceptGuide.openMark), с разделом и днём
 * строки: там отметку снимают. Правка уходит тем же автосохранением.
 */
export function TechniqueJournalBlock({ detail, onOpenConcept, takeFocus }: Props) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const { source, handlers } = clientConceptLinks(detail);
  const entries = techniqueJournal(source);
  const guide = useConceptGuide({
    tasks: detail.clientTasks,
    graph: { source, onChangeLink: handlers.onChangeLink, onChangeSchemaLink: handlers.onChangeSchemaLink },
  });
  useEffect(() => {
    if (takeFocus?.()) ref.current?.scrollIntoView?.({ block: 'start' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- один раз при входе на вкладку
  const load = detail.conceptLoad; // в тестах вкладки заданий карточка бывает без концептуализации

  return (
    <section ref={ref} className="tb-journal" aria-labelledby={titleId}>
      <div className="ds-h3" id={titleId}>На сессиях</div>
      <div className="tb-meta">Что делали на сессиях: техники с отметкой «Делали сегодня» из подсказок к режимам и схемам. Клиенту журнал не виден.</div>
      {load?.failed ? (
        <div className="tb-journal-empty">
          <div className="tb-meta" role="status">Журнал не загрузился вместе с концептуализацией.</div>
          <button type="button" className="tb-journal-link" onClick={detail.reloadConcept} disabled={load.reloading}>
            {load.reloading ? 'Загружаю…' : 'Повторить'}
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="tb-journal-empty">
          <div className="tb-meta">Пока не отмечали. Отметка ставится в листе техники в концептуализации.</div>
          {onOpenConcept && <button type="button" className="tb-journal-link" onClick={onOpenConcept}>Открыть концептуализацию →</button>}
        </div>
      ) : (
        <JournalDays entries={entries} onOpen={guide.openMark} />
      )}
      {/* Тексты листов — чанк подсказок: пустой журнал его не грузит. Лист снятой последней отметки остаётся открытым. */}
      {(entries.length > 0 || guide.anyOpen) && guide.sheets}
    </section>
  );
}

/** Строки по дням: день слева один раз, справа «Техника — Режим». Названия техник — чанк текстов подсказок. */
function JournalDays({ entries, onOpen }: { entries: TechniqueJournalEntry[]; onOpen: (e: TechniqueJournalEntry) => void }) {
  const tr = useTr();
  const texts = useGuide();
  if (texts === undefined) return <SkeletonList rows={Math.min(entries.length, 4)} height={20} radius={6} gap={24} />;
  if (texts === null) return <div className="tb-meta" role="status">Названия техник не загрузились — журнал появится после перезагрузки страницы.</div>;
  const names = new Map(texts.buildTechniqueGuides(tr).map((t) => [t.id as string, t.name]));
  return (
    <ul className="tb-journal-list">
      {journalDays(entries).map(({ day, entries: rows }) => (
        <li key={day} className="tb-journal-day">
          <div className="tb-journal-date">{fmtDate(day)}</div>
          <div>
            {rows.map((e) => {
              const name = names.get(e.techniqueId);
              if (!name) return null; // техники больше нет в библиотеке — листа у неё нет
              const from = journalFromName(e);
              return (
                <button
                  key={`${e.from.kind}:${e.from.id}:${e.techniqueId}`} type="button" className="tb-journal-row"
                  aria-label={`${fmtDate(day)}: ${name}${from ? ` — ${from}` : ''}`} onClick={() => onOpen(e)}
                >
                  <span className="tb-journal-tech">{name}</span>
                  {from && <span className="tb-journal-from"> — {from}</span>}
                </button>
              );
            })}
          </div>
        </li>
      ))}
    </ul>
  );
}
