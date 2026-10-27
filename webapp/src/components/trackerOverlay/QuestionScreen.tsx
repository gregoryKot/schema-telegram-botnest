import { NeedScale } from '../NeedScale';
import { TrackerOriginNote } from './TrackerOriginNote';
import { NeedExplainer } from './NeedExplainer';
import { hueStyle } from '../../lib/tone';
import { wordAnchorDescriptions } from '../../../../shared/src/needs/ratingWords';
import type { NeedExtra } from '../../../../shared/src/needs/types';

/** Один вопрос трекера: потребность, что это, вопрос про сегодня, примеры, пять ответов словами с якорями. */
export function QuestionScreen({
  idx,
  total,
  name,
  data,
  value,
  hue,
  yesterday,
  caption,
  showOriginNote,
  onAnswer,
  onMore,
}: {
  idx: number;
  total: number;
  name: string;
  /** Контент потребности (shared/needs): вопрос, описание, примеры, диапазоны. */
  data: NeedExtra | undefined;
  value: number;
  hue: number;
  /** Вчерашняя оценка (только реальная; бэкфилл — undefined). */
  yesterday?: number;
  /** Добавка к «Потребность N из M», например дата бэкфилла. */
  caption?: string;
  showOriginNote: boolean;
  onAnswer: (v: number) => void;
  onMore: () => void;
}) {
  // Примеры раскрыты, пока эту потребность ещё не оценивали (ни сегодня, ни вчера).
  const ratedBefore = value > 0 || yesterday !== undefined;
  return (
    <div className="tq-inner" style={hueStyle(hue)}>
      <TrackerOriginNote eligible={showOriginNote} />
      <p className="tq-eyebrow tone-text">
        Потребность {idx + 1} из {total}
        {caption ? ` · ${caption}` : ''}
      </p>
      <h1 className="tq-title">{name}</h1>
      <NeedExplainer data={data} expanded={!ratedBefore} />
      <p className="tq-question">{data?.question ?? ''}</p>
      <NeedScale
        variant="words"
        value={value > 0 ? value : undefined}
        hue={hue}
        label={name}
        yesterday={yesterday}
        sublabels={data ? wordAnchorDescriptions(data.ranges) : undefined}
        onChange={onAnswer}
      />
      <p className="tq-hint">Выбор сохраняется сразу и сам открывает следующий вопрос.</p>
      <button type="button" className="tq-more" onClick={onMore}>Подробнее о потребности</button>
    </div>
  );
}
