// Строка теста в герое листа «Мой портрет»: дата последнего теста на схемы и дельта с прошлого.
// Переехала с карточки профиля (b21): плитка — вход, итоги — в листе. Портрет без данных или
// без теста — строки нет (без выдуманной даты; приглашение пройти тест — на плитке).
import { fmtDate, momentDayKey } from '../../utils/format';
import { hasPortraitData, type Portrait } from '../../../../shared/src/portrait/portraitData';
import { portraitDeltaText } from '../../../../shared/src/portrait/portraitTexts';

export function PortraitTestLine({ portrait, ysqCompletedAt }: { portrait: Portrait; ysqCompletedAt: string | null }) {
  if (!ysqCompletedAt || !hasPortraitData(portrait)) return null;
  const deltaText = portraitDeltaText(portrait.delta);
  return (
    <span className="cpf-testline">
      <span>Тест на схемы · {fmtDate(momentDayKey(ysqCompletedAt))}</span>
      {deltaText && <span className={`cpf-delta${(portrait.delta ?? 0) < 0 ? ' is-better' : ''}`}>{deltaText}</span>}
    </span>
  );
}
