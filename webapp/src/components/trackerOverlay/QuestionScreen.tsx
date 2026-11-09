import type { ReactNode } from 'react';
import { NeedScale } from '../NeedScale';
import { TrackerOriginNote } from './TrackerOriginNote';
import { NeedExplainer } from './NeedExplainer';
import { EntitySheet } from '../paper/EntitySheet';
import { SpreadLayout } from '../paper/SpreadLayout';
import { hueStyle } from '../../lib/tone';
import { wordAnchorDescriptions } from '../../../../shared/src/needs/ratingWords';
import { needLook } from '../../../../shared/src/theme/entityLook';
import type { NeedExtra, NeedId } from '../../../../shared/src/needs/types';

/**
 * Один вопрос трекера (редизайн 2026-11, APP_2026-11.md, раздел b07): лист потребности —
 * её бумага и её знак крупно (EntitySheet, needLook), в нём «Потребность N из M», название,
 * что это и примеры; на компьютере лист слева колонкой, вопрос и пять ответов справа
 * (SpreadLayout), на телефоне лист сверху. Сбой сохранения (`alert`) стоит в колонке ответов,
 * над ними, — а не у края окна. Шаги потока — один и тот же лист, меняется только бумага и знак.
 */
export function QuestionScreen({
  idx, total, name, needId,
  data,
  value,
  hue,
  yesterday,
  caption,
  showOriginNote,
  alert,
  onAnswer,
  onMore,
}: {
  idx: number; total: number; name: string;
  /** Id потребности — бумага и знак листа, цвет данных шкалы. */
  needId: NeedId;
  /** Контент потребности (shared/needs): вопрос, описание, примеры, диапазоны. */
  data: NeedExtra | undefined;
  value: number;
  hue: number;
  /** Вчерашняя оценка (только реальная; бэкфилл — undefined). */
  yesterday?: number;
  /** Добавка к «Потребность N из M», например дата бэкфилла. */
  caption?: string;
  showOriginNote: boolean;
  /** Сбой сохранения прошлого ответа — строкой над ответами. */
  alert?: ReactNode;
  onAnswer: (v: number) => void;
  onMore: () => void;
}) {
  const sheet = (
    <EntitySheet
      look={needLook(needId)}
      label={`Потребность ${idx + 1} из ${total}${caption ? ` · ${caption}` : ''}`}
      title={name}
      titleAs="h1"
      className="tq-sheet"
    >
      <NeedExplainer data={data} />
    </EntitySheet>
  );
  return (
    <div className="tq-ask" style={hueStyle(hue)}>
      <SpreadLayout side={<><TrackerOriginNote eligible={showOriginNote} />{sheet}</>}>
        <p className="tq-question">{data?.question ?? ''}</p>
        {alert}
        <NeedScale
          value={value > 0 ? value : undefined}
          hue={hue}
          needId={needId}
          label={name}
          yesterday={yesterday}
          sublabels={data ? wordAnchorDescriptions(data.ranges) : undefined}
          onChange={onAnswer}
        />
        <p className="tq-hint">Выбор сохраняется сразу и сам открывает следующий вопрос.</p>
        <button type="button" className="tq-more" onClick={onMore}>Подробнее о потребности</button>
      </SpreadLayout>
    </div>
  );
}
