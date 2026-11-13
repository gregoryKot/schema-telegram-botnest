// Плитка «Мой портрет» на витрине профиля: бумага и знак ENTITY_LOOK.portrait, подпись «откуда и
// зачем» (с данными) или объяснение пустого портрета, внизу итог «N схем · M режимов» из данных.
// Вся плитка открывает лист; полосы потребностей, дата теста и дельта — в листе (PortraitSheet).
// Пусто — вложенная «Пройти тест» (stopPropagation): лист не открывается; схемы отмечены, теста не было —
// «Пройти тест на схемы →» под итогом. Тексты — shared/src/portrait.
import type { MouseEvent } from 'react';
import { useTr } from '../../utils/addressForm';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { hasPortraitData, type Portrait } from '../../../../shared/src/portrait/portraitData';
import { portraitTexts, portraitTotalsText } from '../../../../shared/src/portrait/portraitTexts';
import { glue } from '../../../../shared/src/utils/typo';
import { ShelfTile } from './ShelfTile';

interface Props {
  portrait: Portrait;
  /** Последний тест на схемы; нет — у портрета с данными приглашение пройти тест. */
  ysqCompletedAt: string | null;
  onOpenSheet: () => void;
  onTakeTest?: () => void;
}

export function PortraitCard({ portrait, ysqCompletedAt, onOpenSheet, onTakeTest }: Props) {
  const tr = useTr();
  const txt = portraitTexts(tr);
  const hasData = hasPortraitData(portrait);
  const takeTest = (e: MouseEvent) => { e.stopPropagation(); onTakeTest?.(); };
  const link = (label: string) => onTakeTest && <button type="button" className="ds-link cpf-tile-link" onClick={takeTest}>{label}</button>;
  // Схемы отмечены вручную, теста не было — под итогом приглашение пройти тест.
  const foot = hasData
    ? <span className="cpf-tile-metas"><span className="pp-meta">{portraitTotalsText(portrait)}</span>{!ysqCompletedAt && link(txt.takeTestArrow)}</span>
    : link(txt.takeTest);
  return (
    <ShelfTile look={ENTITY_LOOK.portrait} title={txt.title} label={txt.title} onOpen={onOpenSheet} foot={foot || undefined}>
      {glue(hasData ? txt.hint : txt.emptyCard)}
    </ShelfTile>
  );
}
