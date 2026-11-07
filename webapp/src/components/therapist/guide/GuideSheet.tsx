import type { ReactNode } from 'react';
import type { BetweenSessionsItem, TechniqueGuide, TechniqueId } from '../../../../../shared/src/schemaTherapy/guide';
import type { GuideHintView } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import type { GuideNotes } from '../../../../../shared/src/therapy/conceptGraph/guideHistory';
import { ConceptFullscreenSheet } from '../ConceptFullscreenSheet';
import { GuideSection, GuideSources } from './GuideSection';
import { guideColumnStyle, guideTextStyle } from './guideStyles';

/** Колбэки листа раздела (режима или схемы). */
export interface GuideSheetActions {
  onOpenTechnique: (id: TechniqueId) => void;
  /** «Дать заданием»; нет — лист без кнопок заданий (справочник без клиента). */
  onAssign?: (item: BetweenSessionsItem) => void;
  onClose: () => void;
  /** История серым: «делали …» у техники, «давали …» у задания; нет — без строк. */
  notes?: GuideNotes;
}

type Props = GuideSheetActions & {
  title: string;
  /** Что это за лист, одной-двумя фразами под шапкой. */
  intro: string;
  view: GuideHintView & { guide: { stuck?: string; sources: string } };
  /** Свои разделы листа: у режима — каналы работы, у схемы — суть, копинг, режимы… */
  children: ReactNode;
};

/**
 * Лист раздела справочника (#995) — одна оболочка на лист режима и лист
 * схемы: шапка и пояснение, свои разделы листа, затем общий хвост — «На
 * сессии» (тап по технике → лист техники поверх), «Между сессиями» с «Дать
 * заданием», «Где застревают» и «Источники». Пустой раздел не рисуется.
 * У техники и задания — история серым (`notes`, guideHistory.ts).
 * Оболочка — ConceptFullscreenSheet (useHistorySheet, «Назад» браузера
 * закрывает лист).
 */
export function GuideSheet({ title, intro, view, onOpenTechnique, onAssign, onClose, notes, children }: Props) {
  const { guide, techniques } = view;
  return (
    <ConceptFullscreenSheet title={title} closeLabel="Закрыть" onClose={onClose}>
      <div style={guideColumnStyle}>
        <p className="ds-sub" style={{ margin: 0 }}>{intro}</p>
        {children}
        <GuideTechniques techniques={techniques} onOpen={onOpenTechnique} notes={notes} />
        <GuideBetweenSessions items={guide.betweenSessions} onAssign={onAssign} notes={notes} />
        <GuideSection title="Где застревают" text={guide.stuck} />
        <GuideSources text={guide.sources} />
      </div>
    </ConceptFullscreenSheet>
  );
}

/** «На сессии»: техника — кнопка с описанием и «делали …». */
function GuideTechniques({ techniques, onOpen, notes }: {
  techniques: TechniqueGuide[]; onOpen: (id: TechniqueId) => void; notes?: GuideNotes;
}) {
  if (techniques.length === 0) return null;
  return (
    <GuideSection title="На сессии">
      <ul className="tcp-guide-list">
        {techniques.map((t) => (
          <li key={t.id}>
            <button type="button" className="tcp-guide-link" onClick={() => onOpen(t.id)}>{t.name}</button>
            <div className="ds-sub">{t.summary}</div>
            <GuideNote text={notes?.technique(t.id)} />
          </li>
        ))}
      </ul>
    </GuideSection>
  );
}

/** «Между сессиями»: название, серым пояснение или инструкция и «давали …», «Дать заданием». */
function GuideBetweenSessions({ items, onAssign, notes }: {
  items: BetweenSessionsItem[]; onAssign?: (item: BetweenSessionsItem) => void; notes?: GuideNotes;
}) {
  if (items.length === 0) return null;
  return (
    <GuideSection title="Между сессиями">
      <ul className="tcp-guide-list">
        {items.map((item, i) => {
          const sub = item.kind === 'task' ? item.note : item.text;
          return (
            <li key={`${i}:${item.title}`} className="tcp-guide-task">
              <div style={{ minWidth: 0 }}>
                <div style={{ ...guideTextStyle, fontWeight: 600 }}>{item.title}</div>
                {sub && <div className="ds-sub">{sub}</div>}
                <GuideNote text={notes?.task(item)} />
              </div>
              {onAssign && (
                <button
                  type="button" className="ds-btn ds-btn--secondary"
                  aria-label={`Дать заданием: ${item.title}`} onClick={() => onAssign(item)}
                >
                  Дать заданием
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </GuideSection>
  );
}

/** Строка истории: мелко и серым, нечего сказать — ничего. */
function GuideNote({ text }: { text?: string | null }) {
  return text ? <div className="ds-sub">{text}</div> : null;
}
