// Пять потребностей плитками цветной бумаги (b20, принцип 3: выбор из равных — плитки, не белая таблица) — одна
// механика на два экрана: «Планы» (пусто — с какой потребности начать план) и «Что питает» (какая потребность
// открыта). Бумага — NEED_HUE, знак — NeedArt; выбранная (только у «Что питает») — тон глубже и приподнята
// сдвинутым слоем. До b20 у «Планов» были белые строки со знаком, у «Что питает» — серые вкладки без знаков с
// обрезанным «Выражение ч…» на 390. Ширина — по месту: плитки переносятся рядами, а не уезжают в прокрутку.
import type { ReactNode } from 'react';
import { useNeedData } from '../../needData';
import { NEED_ORDER } from '../../../../shared/src/needs/types';
import { NEED_HUE, hueStyle } from '../../lib/tone';
import { NeedArt } from '../art/NeedArt';

interface Props {
  /** Подпись группы для чтения с экрана. */
  label: string;
  onPick: (id: string) => void;
  /** Открытая потребность; без значения плитки — переходы (aria-pressed не ставится). */
  value?: string;
  /** Строка под названием (оценка за сегодня). */
  meta?: (id: string) => ReactNode;
}

export function NeedTiles({ label, onPick, value, meta }: Props) {
  const NEED_DATA = useNeedData();
  return (
    <div className="sk-needs" role="group" aria-label={label}>
      {NEED_ORDER.filter(id => NEED_DATA[id]).map(id => {
        const on = value === id;
        return (
          <button
            key={id} type="button" className={'pp-paper sk-need' + (on ? ' is-on' : '')} style={hueStyle(NEED_HUE[id])}
            aria-pressed={value === undefined ? undefined : on} onClick={() => onPick(id)}
          >
            <span className="sk-need-sign" aria-hidden="true"><NeedArt id={id} size="row" /></span>
            <span className="sk-need-name">{NEED_DATA[id].name}</span>
            {meta?.(id)}
          </button>
        );
      })}
    </div>
  );
}
