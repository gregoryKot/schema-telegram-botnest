import type { ConceptModeLink } from '../../apiTypes';
import type { GraphModeCard } from './conceptGraphTypes';
import type { ConceptGuideActions, ModeGuideView } from './conceptGuide';
import { ConceptGuideHint } from './ConceptGuideHint';
import { MethodHint, takeStyle } from './MethodHint';
import { ConceptTextField } from './ConceptTextField';

/**
 * «Что делаем в терапии»: над полем — что обычно делают с режимом в методе.
 * Есть свой раздел (#995) — цель режима, техники и задания (ConceptGuideHint);
 * нет (свой режим терапевта) — строка группы режимов. «Взять за основу» видна,
 * пока поле пустое, и кладёт в поле цель или строку группы, чтобы терапевт
 * переписал её своими словами.
 */
export function ConceptStrategy({
  card,
  link,
  guide,
  actions,
  onChange,
}: {
  card: GraphModeCard;
  link: ConceptModeLink;
  /** undefined — тексты подсказок ещё грузятся: плашки пока нет. */
  guide: ModeGuideView | null | undefined;
  actions?: ConceptGuideActions;
  onChange: (strategy: string) => void;
}) {
  const base = guide ? guide.guide.goal : card.strategyHint;
  const take =
    base && link.strategy.trim() === '' ? (
      <button type="button" onClick={() => onChange(base)} style={takeStyle}>
        Взять за основу
      </button>
    ) : null;
  const hint =
    guide === undefined ? null : guide ? (
      <ConceptGuideHint
        view={guide}
        modeId={card.modeId}
        actions={actions}
        take={take}
      />
    ) : card.strategyHint ? (
      <MethodHint text={card.strategyHint} take={take} />
    ) : null;
  return (
    <ConceptTextField
      label="Что делаем в терапии"
      placeholder="Своими словами: задача на ближайшие сессии"
      value={link.strategy}
      onChange={onChange}
      above={hint}
    />
  );
}
