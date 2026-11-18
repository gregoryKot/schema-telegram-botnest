import { useEffect, useId, useRef } from 'react';
import '../../styles/therapist-concept.css'; // классы листа техники (tcp-guide-*)
import { useTr } from '../../utils/addressForm';
import { fmtDate } from '../../utils/format';
import { useGuide } from '../../../../shared/src/therapy/conceptGraph/guideLoader';
import { journalFromName, techniqueJournal, type TechniqueJournalEntry } from '../../../../shared/src/therapy/conceptGraph/techniqueJournal';
import { workTitle } from '../../../../shared/src/therapy/sessionWork/names';
import { sessionJournal, workFromNames, workMarks, type SessionJournalDay } from '../../../../shared/src/therapy/sessionWork/sessionJournal';
import { api } from '../../api';
import { SkeletonList } from '../Skeleton';
import type { ClientDetail } from './clientSheetTypes';
import { clientConceptLinks } from './useClientConceptGraph';
import { useConceptGuide } from './guide/useConceptGuide';
import { useSessionWork } from './useSessionWork';
import { hasCustomMode, useCustomModeNames, type NamedMode } from './useCustomModeNames';

interface Props {
  detail: ClientDetail;
  /** Пустой журнал: переход на вкладку «Концептуализация», где ставят отметку. */
  onOpenConcept?: () => void;
  /** Вкладку открыли «журнал →» из подсказок (true — один раз): блок прокручивается в вид. */
  takeFocus?: () => boolean;
  /** Тап по строке из итогов сессии: открыть её запись на вкладке «Сессии». */
  onOpenSession?: (noteId: number) => void;
}

/**
 * «На сессиях» вкладки «Задания» — журнал того, что делали на сессиях, по дням,
 * новые сверху: пункты «Что делали» из итогов сессий (#1330) и отметки «Делали
 * сегодня» режимов и схем (#995); один день + техника + режим или схема не
 * двоятся (sessionJournal). Тап по пункту итогов открывает запись сессии, по
 * отметке — лист техники (useConceptGuide.openMark) с разделом и днём строки:
 * там отметку снимают, правка уходит автосохранением концептуализации.
 */
export function TechniqueJournalBlock({ detail, onOpenConcept, takeFocus, onOpenSession }: Props) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const { source, handlers } = clientConceptLinks(detail);
  const work = useSessionWork(detail);
  const customModes = useCustomModeNames(work.entries.some((e) => hasCustomMode(e.work)));
  const guide = useConceptGuide({
    tasks: detail.clientTasks, plan: { clientId: detail.selectedClient?.telegramId },
    graph: {
      source, onChangeLink: handlers.onChangeLink, onChangeSchemaLink: handlers.onChangeSchemaLink,
      workMarks: (from) => workMarks(work.entries, from),
    },
  });
  useEffect(() => {
    if (takeFocus?.()) ref.current?.scrollIntoView?.({ block: 'start' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- один раз при входе на вкладку
  const load = detail.conceptLoad; // в тестах вкладки заданий карточка бывает без концептуализации
  // Концептуализация не загрузилась — отметок нет, пункты итогов сессий остаются.
  const days = sessionJournal(load?.failed ? [] : techniqueJournal(source), work.entries);
  // Запись сессии открывается, только если она среди показанных на вкладке «Сессии».
  const shown = new Set((detail.notes ?? []).map((n) => n.id));
  const openSession = onOpenSession && ((noteId: number) => {
    api.trackEvent('concept_guide_journal_entry');
    onOpenSession(noteId);
  });

  return (
    <section ref={ref} className="tb-journal" aria-labelledby={titleId}>
      <div className="ds-h3" id={titleId}>На сессиях</div>
      <div className="tb-meta">Что делали на сессиях: пункты «Что делали» из итогов сессий и техники с отметкой «Делали сегодня» из подсказок к режимам и схемам. Клиенту журнал не виден.</div>
      {load?.failed && (
        <div className="tb-journal-empty">
          <div className="tb-meta" role="status">{days.length > 0 ? 'Отметки «Делали сегодня» не загрузились вместе с концептуализацией.' : 'Журнал не загрузился вместе с концептуализацией.'}</div>
          <button type="button" className="tb-journal-link" onClick={detail.reloadConcept} disabled={load.reloading} aria-busy={load.reloading || undefined}>
            {load.reloading ? 'Загружаю…' : 'Повторить'}
          </button>
        </div>
      )}
      {work.failed && <div className="tb-meta" role="status">Пункты из ранних записей сессий не загрузились — журнал неполный.</div>}
      {days.length > 0 ? (
        <JournalDays days={days} modeLinks={source.modeLinks} customModes={customModes} onOpenMark={guide.openMark} onOpenSession={openSession} shown={shown} />
      ) : !load?.failed && (
        <div className="tb-journal-empty">
          <div className="tb-meta">Пока пусто. Пункты появляются из «Что делали» в итогах сессии и из отметки «Делали сегодня» в листе техники в концептуализации.</div>
          {onOpenConcept && <button type="button" className="tb-journal-link" onClick={onOpenConcept}>Открыть концептуализацию →</button>}
        </div>
      )}
      {/* Тексты листов — чанк подсказок: пустой журнал его не грузит. Лист снятой последней отметки остаётся открытым. */}
      {(days.length > 0 || guide.anyOpen) && guide.sheets}
    </section>
  );
}

interface DaysProps {
  days: SessionJournalDay[];
  modeLinks: Parameters<typeof workFromNames>[1];
  customModes: NamedMode[];
  onOpenMark: (e: TechniqueJournalEntry) => void;
  onOpenSession?: (noteId: number) => void;
  shown: Set<number>;
}

/** Строки по дням: день слева один раз, справа «Что делали — режим, схема». Названия техник отметок — чанк текстов подсказок. */
function JournalDays({ days, modeLinks, customModes, onOpenMark, onOpenSession, shown }: DaysProps) {
  const tr = useTr();
  const texts = useGuide();
  const count = days.reduce((n, d) => n + d.rows.length, 0);
  if (texts === undefined) return <SkeletonList rows={Math.min(count, 4)} height={20} radius={6} gap={24} />;
  // Чанк не загрузился — строки отметок без названий не рисуются, пункты итогов остаются.
  const names = new Map((texts?.buildTechniqueGuides(tr) ?? []).map((t) => [t.id as string, t.name]));
  const line = (name: string, from: string) => (
    <><span className="tb-journal-tech">{name}</span>{from && <span className="tb-journal-from"> — {from}</span>}</>
  );
  return (
    <>
      {texts === null && <div className="tb-meta" role="status">Названия техник не загрузились — отметки появятся после перезагрузки страницы.</div>}
      <ul className="tb-journal-list">
        {days.map(({ day, rows }) => (
          <li key={day} className="tb-journal-day">
            <div className="tb-journal-date">{fmtDate(day)}</div>
            <div>
              {rows.map((row) => {
                if (row.source === 'work') {
                  const name = workTitle(row.item);
                  if (!name) return null; // вида больше нет в каталоге
                  const from = workFromNames(row.item, modeLinks, customModes);
                  const key = `work:${row.noteId}:${row.item.id}`;
                  if (!onOpenSession || !shown.has(row.noteId)) return <div key={key} className="tb-journal-row tb-journal-row--static">{line(name, from)}</div>;
                  return (
                    <button
                      key={key} type="button" className="tb-journal-row"
                      aria-label={`${fmtDate(day)}: ${name}${from ? ` — ${from}` : ''}, запись сессии`} onClick={() => onOpenSession(row.noteId)}
                    >
                      {line(name, from)}
                    </button>
                  );
                }
                const name = names.get(row.techniqueId);
                if (!name) return null; // техники больше нет в библиотеке — листа у неё нет
                const from = journalFromName(row);
                return (
                  <button
                    key={`${row.from.kind}:${row.from.id}:${row.techniqueId}`} type="button" className="tb-journal-row"
                    aria-label={`${fmtDate(day)}: ${name}${from ? ` — ${from}` : ''}`} onClick={() => onOpenMark(row)}
                  >
                    {line(name, from)}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
