import { ExScreen, GlyphCheck } from '../exercises/ExScreen';
import { getModeById } from '../../schemaTherapyData';
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
      eyebrowColor="var(--c-moss)"
      title={
        <>
          Запись
          <br />
          <span className="it">сохранена</span>
        </>
      }
      lede="Она в «Дневнике режимов» и в «Моём пути» — можно открыть и перечитать в любой момент."
    >
      <ModeEntryShare
        mode={getModeById(modeId)}
        healthyResponse={healthyResponse}
        entry={entry}
        color="var(--c-moss)"
      />
      <ModeChainSuggestion modeId={modeId} onPick={onPickChain} />
      <button
        className="ex-btn ex-btn-primary"
        onClick={goBack}
        style={{
          marginTop: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        Готово <GlyphCheck />
      </button>
    </ExScreen>
  );
}
