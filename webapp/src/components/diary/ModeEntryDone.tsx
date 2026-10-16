import { ExScreen, GlyphCheck } from '../exercises/ExScreen';
import { getModeById } from '../../schemaTherapyData';
import '../../styles/sheet-diary.css';
import { ModeEntryShare } from './ModeEntryShare';
import { ModeChainSuggestion } from './ModeChainSuggestion';
import type { ModeEntryFullSource } from '../../../../shared/src/share/cards/modeEntryFullCard';

/**
 * Экран «Запись сохранена» дневника режимов: итог + шеринг + подсказка
 * разобрать связанный режим (ModeChainSuggestion) + «Готово». Вынесено из
 * ModeEntrySheet, чтобы файл не пробивал потолок (правило №10). goBack — из
 * useHistorySheet родителя (правило «Назад»/«Закрыть» — только goBack()).
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
  return (
    <ExScreen
      onBack={goBack}
      backLabel="Закрыть"
      eyebrow="Дневник режимов"
      title={
        <>
          Запись
          <br />
          <span className="it">сохранена</span>
        </>
      }
      lede="Она в «Дневнике режимов» и в «Моём пути» — можно открыть и перечитать в любой момент."
    >
      <div className="ds-card ds-card--ink sd-done">
        <ModeEntryShare
          mode={getModeById(modeId)}
          healthyResponse={healthyResponse}
          entry={entry}
        />
      </div>
      <ModeChainSuggestion modeId={modeId} onPick={onPickChain} />
      <button className="ds-btn sd-done-btn" onClick={goBack}>
        Готово <GlyphCheck />
      </button>
    </ExScreen>
  );
}
