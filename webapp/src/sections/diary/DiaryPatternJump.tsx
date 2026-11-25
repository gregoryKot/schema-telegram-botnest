// Карточка схемы или режима поверх «Записей» — слой «Моих паттернов» (usePatternLayer), смонтированный
// только на время перехода: записи и статусы паттерна грузятся по тапу, а не при каждом открытии ленты.
import { useEffect } from 'react';
import { usePatternLayer } from '../schemas/usePatternLayer';
import type { PatternTarget } from '../schemas/patternRoute';

export function DiaryPatternJump({ target, onClose }: { target: PatternTarget; onClose: () => void }) {
  const pat = usePatternLayer(undefined, onClose);
  const { openPattern } = pat;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- открыть один раз на цель; openPattern новый на каждый рендер
  useEffect(() => { openPattern(target.kind, target.id); }, [target.kind, target.id]);
  return <>{pat.layer}</>;
}
