import { ExBar } from '../exercises/ExBar';
import { GlyphCheck } from '../exercises/ExScreen';
import { DoneSheet } from '../paper/DoneSheet';
import { Sprout } from '../art/AppScenes';
import { getModeById } from '../../schemaTherapyData';
import { modeLookById } from './modeLookById';
import '../../styles/sheet-diary.css';
import { ModeEntryShare } from './ModeEntryShare';
import { ModeChainSuggestion } from './ModeChainSuggestion';
import type { ModeEntryFullSource } from '../../../../shared/src/share/cards/modeEntryFullCard';

/**
 * Экран «Запись сохранена» дневника режимов: лист «готово» (DoneSheet) на бумаге группы режима —
 * знак режима с проросшим листом (Sprout, ENTITY_LOOK.diary_mode), «Готово» — главная кнопка
 * сразу под заголовком; ниже — подсказка разобрать связанный режим (ModeChainSuggestion) и тихая
 * строка шаринга. goBack — из useHistorySheet родителя (правило «Назад»/«Закрыть» — только goBack()).
 */
export function ModeEntryDone({
  modeId,
  healthyResponse,
  entry,
  goBack,
  onPickChain,
}: {
  modeId: string;
  healthyResponse: string;
  entry?: ModeEntryFullSource;
  goBack: () => void;
  onPickChain: (toModeId: string | null) => void;
}) {
  const mode = getModeById(modeId);
  const look = modeLookById(modeId);
  return (
    <div className="ex2-screen">
      <ExBar onBack={goBack} label="Закрыть" sticky />
      <div className="sd-done-page">
        <DoneSheet entity="diary_mode" hue={look.hue} scene={<Sprout sign={look.sign} hue={look.hue} />} titleAs="h1"
          label="Дневник режимов" title={<>Запись <span>сохранена</span></>}
          sub="Она в «Дневнике режимов» и в «Моём пути» — можно открыть и перечитать в любой момент."
          primary={{ label: <>Готово <GlyphCheck /></>, onClick: goBack }} />
        <ModeChainSuggestion modeId={modeId} onPick={onPickChain} />
        <div className="sd-done-share">
          <ModeEntryShare mode={mode} healthyResponse={healthyResponse} entry={entry} />
        </div>
      </div>
    </div>
  );
}
