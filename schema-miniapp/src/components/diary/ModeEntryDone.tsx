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
        {/* Спокойный зелёный круг вместо эмодзи: цвет и форма, без картинки. */}
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            background: 'var(--calm)',
            margin: '0 auto 14px',
          }}
        />
        <div className="d-display" style={{ fontSize: 22, marginBottom: 8 }}>
          Записано
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--muted)',
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          Заметить режим и назвать его — это уже работа, и она считается. Запись
          в «Дневнике режимов» и в «Моём пути»: можно открыть и перечитать в
          любой момент.
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
            marginTop: 20,
            width: '100%',
            padding: '16px 0',
            borderRadius: 16,
            border: 'none',
            fontFamily: 'inherit',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            background: 'var(--surface-2)',
            color: 'var(--text)',
          }}
        >
          Готово
        </button>
      </div>
    </BottomSheet>
  );
}
