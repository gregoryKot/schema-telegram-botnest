import { NeedScale } from '../NeedScale';
import { TrackerOriginNote } from './TrackerOriginNote';
import { NeedExplainer } from './NeedExplainer';
import { NeedTitle } from './NeedTitle';
import { hueStyle } from '../../lib/tone';
import { wordAnchorDescriptions } from '../../../../shared/src/needs/ratingWords';
import type { NeedExtra } from '../../../../shared/src/needs/types';

/** Один вопрос трекера: потребность, что это, вопрос про сегодня, примеры, пять ответов словами с якорями. */
export function QuestionScreen({
  idx, total, name, needId,
  data,
  value,
  hue,
  yesterday,
  caption,
  showOriginNote,
  onAnswer,
  onMore,
}: {
  idx: number; total: number; name: string;
  /** Id потребности — для мотива рядом с названием. */
  needId?: string;
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
  return (
    <div className="tq-inner tq-ask" style={hueStyle(hue)}>
      <TrackerOriginNote eligible={showOriginNote} />
      <p className="tq-eyebrow tone-text">
        Потребность {idx + 1} из {total}
        {caption ? ` · ${caption}` : ''}
      </p>
      <NeedTitle name={name} needId={needId} />
      <NeedExplainer data={data} />
      <p className="tq-question">{data?.question ?? ''}</p>
      <NeedScale
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
