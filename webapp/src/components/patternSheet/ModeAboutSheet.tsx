// «О режиме →» на сайте: портрет режима (8 блоков из shared) в оболочке
// SsSheet. Тот же портрет показывает ModeEx перед вопросами карточки; здесь
// он открыт по запросу, без выбора и без записи. Кнопка внизу ведёт к вопросам.
// Герой — лист бумаги группы со знаком режима (patternLook, как у экрана
// паттерна), на ≥1024 — разворот: герой слева, портрет справа (b15).
import '../../styles/sheet-exercises.css';
import { SsSheet, SsHead } from '../schemaSheets/SsSheet';
import { ModePortrait } from '../exercises/ModePortrait';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { getModeById } from '../../schemaTherapyData';
import { getModeCard } from '../../../../shared/src/mode/modeCards';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { patternHue, patternLook } from './patternHue';

interface Props {
  modeId: string;
  onClose: () => void;
  onFill: () => void;
}

export function ModeAboutSheet({ modeId, onClose, onFill }: Props) {
  const goBack = useHistorySheet(onClose);
  const mode = getModeById(modeId);
  if (!mode) return null;
  const card = getModeCard(modeId);
  const look = patternLook('mode', modeId) ?? ENTITY_LOOK.modes;
  return (
    <SsSheet onBack={goBack} spread hero={<SsHead look={look} eyebrow={mode.groupName} title={mode.name} lede={card?.about ?? mode.short} />}>
      {card && <ModePortrait card={card} hue={patternHue('mode', modeId) ?? 70} onStart={onFill} ctaLabel="Заполнить карточку →" />}
    </SsSheet>
  );
}
