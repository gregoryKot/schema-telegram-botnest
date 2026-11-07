import type { BetweenSessionsItem, TechniqueId } from '../../../../../shared/src/schemaTherapy/guide';
import type { ModeGuideView } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { ConceptFullscreenSheet } from '../ConceptFullscreenSheet';
import { GuideSection, GuideSources } from './GuideSection';
import { guideColumnStyle, guideTextStyle } from './guideStyles';

interface Props {
  modeName: string;
  view: ModeGuideView;
  onOpenTechnique: (id: TechniqueId) => void;
  /** «Дать заданием»; нет — лист без кнопок заданий (справочник без клиента). */
  onAssign?: (item: BetweenSessionsItem) => void;
  onClose: () => void;
}

// Четыре канала работы с режимом — порядок справочника; пустой канал не показывается.
const CHANNELS = [
  ['relationship', 'Отношения'],
  ['cognitive', 'Когнитивно'],
  ['experiential', 'Экспериенциально'],
  ['behavioral', 'Поведенчески'],
] as const;

/**
 * Лист режима (#995): весь раздел справочника про режим — что это, цель,
 * четыре канала, техники «На сессии» (тап → лист техники поверх), задания
 * «Между сессиями» с «Дать заданием», где застревают и источники. Открывается
 * «Подробнее о режиме» на плашке «Обычно в методе»; оболочка —
 * ConceptFullscreenSheet (useHistorySheet, «Назад» браузера закрывает лист).
 */
export function ModeGuideSheet({ modeName, view, onOpenTechnique, onAssign, onClose }: Props) {
  const { guide, techniques } = view;
  return (
    <ConceptFullscreenSheet title={modeName} closeLabel="Закрыть" onClose={onClose}>
      <div style={guideColumnStyle}>
        <p className="ds-sub" style={{ margin: 0 }}>
          Как работают с режимом в схема-терапии: цель, работа на сессии и задания между сессиями.
          Метки в квадратных скобках — книги из «Источников».
        </p>
        <GuideSection title="Что это" text={guide.what} />
        <GuideSection title="Цель" text={guide.goal} />
        {CHANNELS.map(([key, title]) => <GuideSection key={key} title={title} text={guide[key]} />)}
        {techniques.length > 0 && (
          <GuideSection title="На сессии">
            <ul className="tcp-guide-list">
              {techniques.map((t) => (
                <li key={t.id}>
                  <button type="button" className="tcp-guide-link" onClick={() => onOpenTechnique(t.id)}>{t.name}</button>
                  <div className="ds-sub">{t.summary}</div>
                </li>
              ))}
            </ul>
          </GuideSection>
        )}
        {guide.betweenSessions.length > 0 && (
          <GuideSection title="Между сессиями">
            <ul className="tcp-guide-list">
              {guide.betweenSessions.map((item, i) => (
                <li key={`${i}:${item.title}`} className="tcp-guide-task">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ ...guideTextStyle, fontWeight: 600 }}>{item.title}</div>
                    {(item.kind === 'task' ? item.note : item.text) && (
                      <div className="ds-sub">{item.kind === 'task' ? item.note : item.text}</div>
                    )}
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
              ))}
            </ul>
          </GuideSection>
        )}
        <GuideSection title="Где застревают" text={guide.stuck} />
        <GuideSources text={guide.sources} />
      </div>
    </ConceptFullscreenSheet>
  );
}
