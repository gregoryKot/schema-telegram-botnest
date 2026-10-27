import { NeedScale } from '../NeedScale';
import { TrackerOriginNote } from './TrackerOriginNote';
import { hueStyle } from '../../lib/tone';

/** Один вопрос трекера: потребность, вопрос про сегодня, пять ответов словами. */
export function QuestionScreen({
  idx,
  total,
  name,
  question,
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
  question: string;
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
    <div className="tq-inner" style={hueStyle(hue)}>
      <TrackerOriginNote eligible={showOriginNote} />
      <p className="tq-eyebrow tone-text">
        Потребность {idx + 1} из {total}
        {caption ? ` · ${caption}` : ''}
      </p>
      <h1 className="tq-title">{name}</h1>
      <p className="tq-question">{question}</p>
      <NeedScale
        variant="words"
        value={value > 0 ? value : undefined}
        hue={hue}
        label={name}
        yesterday={yesterday}
        onChange={onAnswer}
      />
      <p className="tq-hint">Выбор сохраняется сразу и сам открывает следующий вопрос.</p>
      <button type="button" className="tq-more" onClick={onMore}>Что считается и как понять оценку</button>
    </div>
  );
}
