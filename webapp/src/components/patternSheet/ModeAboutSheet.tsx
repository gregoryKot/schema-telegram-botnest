// «О режиме →» на сайте: портрет режима (8 блоков из shared) в оболочке
// SsSheet. Тот же портрет показывает ModeEx перед вопросами карточки; здесь
// он открыт по запросу, без выбора и без записи. Кнопка внизу ведёт к вопросам.
import '../../styles/sheet-exercises.css';
import { SsSheet, SsHead } from '../schemaSheets/SsSheet';
import { ModePortrait } from '../exercises/ModePortrait';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { getModeById } from '../../schemaTherapyData';
import { getModeCard } from '../../../../shared/src/mode/modeCards';
import { patternHue } from './patternHue';

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
  return (
    <SsSheet onBack={goBack} zIndex={210}>
      <SsHead eyebrow={mode.groupName} title={mode.name} lede={card?.about ?? mode.short} />
      {card && <ModePortrait card={card} hue={patternHue('mode', modeId) ?? 70} onStart={onFill} ctaLabel="Заполнить карточку →" />}
    </SsSheet>
  );
}
