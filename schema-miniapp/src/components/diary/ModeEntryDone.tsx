import { BottomSheet } from '../BottomSheet';
import { getModeById } from '../../schemaTherapyData';
import { ModeEntryShare } from './ModeEntryShare';
import { ModeChainSuggestion } from './ModeChainSuggestion';
import type { ModeEntryFullSource } from '../../../../shared/src/share/cards/modeEntryFullCard';

/**
 * Экран «Запись сохранена» дневника режимов: итог + шеринг + подсказка
 * разобрать связанный режим (ModeChainSuggestion) + «Готово». Вынесено из
 * ModeEntrySheet, чтобы файл не пробивал потолок (правило №10).
 */
export function ModeEntryDone({
  modeId,
  healthyResponse,
  entry,
  onClose,
  onPickChain,
}: {
  modeId: string;
  healthyResponse: string;
  entry?: ModeEntryFullSource;
  onClose: () => void;
  onPickChain: (toModeId: string | null) => void;
}) {
  return (
    <BottomSheet onClose={onClose}>
      <div style={{ textAlign: 'center', padding: '12px 6px 16px' }}>
        <div style={{ fontSize: 46, marginBottom: 8 }}>🌿</div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 6,
          }}
        >
          Запись сохранена
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: 'var(--text-sub)',
            lineHeight: 1.6,
            marginBottom: 16,
          }}
        >
          Она в «Дневнике режимов» и в «Моём пути» — можно открыть и перечитать
          в любой момент.
        </div>
        <div style={{ textAlign: 'left' }}>
          <ModeEntryShare
            mode={getModeById(modeId)}
            healthyResponse={healthyResponse}
            entry={entry}
          />
          <ModeChainSuggestion modeId={modeId} onPick={onPickChain} />
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: 18,
            width: '100%',
            padding: '13px 0',
            borderRadius: 14,
            border: 'none',
            fontFamily: 'inherit',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            background: 'rgba(var(--fg-rgb),0.08)',
            color: 'var(--text)',
          }}
        >
          Готово
        </button>
      </div>
    </BottomSheet>
  );
}
