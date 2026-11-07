import type { ReactNode } from 'react';
import type { BetweenSessionsItem, TechniqueGuide, TechniqueId } from '../../../../../shared/src/schemaTherapy/guide';
import type { GuideHintView } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { ConceptFullscreenSheet } from '../ConceptFullscreenSheet';
import { GuideSection, GuideSources } from './GuideSection';
import { guideColumnStyle, guideTextStyle } from './guideStyles';

/** Колбэки листа раздела (режима или схемы). */
export interface GuideSheetActions {
  onOpenTechnique: (id: TechniqueId) => void;
  /** «Дать заданием»; нет — лист без кнопок заданий (справочник без клиента). */
  onAssign?: (item: BetweenSessionsItem) => void;
  onClose: () => void;
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
 * Оболочка — ConceptFullscreenSheet (useHistorySheet, «Назад» браузера
 * закрывает лист).
 */
export function GuideSheet({ title, intro, view, onOpenTechnique, onAssign, onClose, children }: Props) {
  const { guide, techniques } = view;
  return (
    <ConceptFullscreenSheet title={title} closeLabel="Закрыть" onClose={onClose}>
      <div style={guideColumnStyle}>
        <p className="ds-sub" style={{ margin: 0 }}>{intro}</p>
        {children}
        <GuideTechniques techniques={techniques} onOpen={onOpenTechnique} />
        <GuideBetweenSessions items={guide.betweenSessions} onAssign={onAssign} />
        <GuideSection title="Где застревают" text={guide.stuck} />
        <GuideSources text={guide.sources} />
      </div>
    </ConceptFullscreenSheet>
  );
}

/** «На сессии»: техника — кнопка с описанием. */
function GuideTechniques({ techniques, onOpen }: {
  techniques: TechniqueGuide[]; onOpen: (id: TechniqueId) => void;
}) {
  if (techniques.length === 0) return null;
  return (
    <GuideSection title="На сессии">
      <ul className="tcp-guide-list">
        {techniques.map((t) => (
          <li key={t.id}>
            <button type="button" className="tcp-guide-link" onClick={() => onOpen(t.id)}>{t.name}</button>
            <div className="ds-sub">{t.summary}</div>
          </li>
        ))}
      </ul>
    </GuideSection>
  );
}

/** «Между сессиями»: название, серым пояснение или инструкция, «Дать заданием». */
function GuideBetweenSessions({ items, onAssign }: {
  items: BetweenSessionsItem[]; onAssign?: (item: BetweenSessionsItem) => void;
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
