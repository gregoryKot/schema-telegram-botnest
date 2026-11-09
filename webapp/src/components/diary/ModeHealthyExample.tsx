import type { CSSProperties } from 'react';
import { MODE_GROUP_HUE } from '../../lib/tone';
import { SignArt } from '../art/SignArt';
import { MODE_GROUP_SIGN } from '../../../../shared/src/theme/entityLook';
import { healthyAdultHint } from '../../../../shared/src/mode/healthyAdultHints';

/**
 * Пример-ориентир на последнем шаге дневника режимов (слова Здорового Взрослого этому режиму) —
 * явно «пример», не ответ. Лист мха здоровых режимов со знаком их группы (Together): голос
 * Здорового Взрослого и его знак — одно и то же, как в «Справочнике» и карточке режима. Поле
 * ответа остаётся в ModeEntryForm — там его прогоняет detectCrisisAny (правило №7).
 */
export function ModeHealthyExample({ modeId }: { modeId: string }) {
  return (
    <div className="pp-paper sd-example" style={{ '--h': MODE_GROUP_HUE.healthy } as CSSProperties}>
      <span className="sd-example-sign" aria-hidden="true"><SignArt sign={MODE_GROUP_SIGN.healthy} size="row" /></span>
      <div className="sd-example-body">
        <div className="ds-label sd-example-label">Например, можно сказать себе:</div>
        <div className="sd-example-text">{healthyAdultHint(modeId)}</div>
      </div>
    </div>
  );
}
