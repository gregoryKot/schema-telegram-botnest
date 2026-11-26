import type { SaveOutcome } from './useSaveBadge';
import { Tick } from './ui';

/** Статус сохранения в шапке листа: слово и галочка-знак (глифа «✓» нет); гаснет только видимость (useSaveBadge). */
export function SaveBadge({ on, outcome }: { on: boolean; outcome: SaveOutcome }) {
  const err = outcome === 'err';
  return (
    <span className={`ds-badge ${err ? 'st-toast is-err' : 'ds-badge--ok st-toast'}${on ? ' is-on' : ''}`}>
      {!err && <Tick />}{err ? 'Не сохранилось' : 'Сохранено'}
    </span>
  );
}
