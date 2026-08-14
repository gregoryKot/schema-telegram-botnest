import { InfoModal } from './ui';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';

// Модалка «Сводка для терапевта»: текст сводки плюс кнопка копирования.
// Вынесена из SettingsSheet.tsx — тот держит 728 строк при потолке 300
// (правило №10), и место под третье состояние кнопки там нашлось только
// склейкой соседних объявлений в одну строку. Склейка прячет размер, а не
// уменьшает его, поэтому блок уехал целиком: у него своё состояние
// (копирование) и никакой связи с остальными настройками.
//
// Текст сводки на экране и выделяется целиком (`userSelect: 'all'`), поэтому
// при отказе буфера достаточно подписи кнопки — отдельная строка-подсказка
// не нужна. Формулировки безличные, вилка ты/вы им не нужна.
export function ExportSummaryModal({
  text,
  onClose,
}: {
  text: string;
  onClose: () => void;
}) {
  const copy = useCopyToClipboard();
  const label = copy.copied
    ? '✓ Скопировано'
    : copy.failed
      ? 'Не скопировалось — текст выше'
      : 'Скопировать';
  return (
    <InfoModal onClose={onClose}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Сводка для терапевта</div>
      <pre style={{ fontSize: 11, color: 'var(--text-sub)', lineHeight: 1.6, background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 14, userSelect: 'all', fontFamily: 'monospace' }}>
        {text}
      </pre>
      <button onClick={() => void copy.copy(text)}
        style={{ width: '100%', padding: '12px 0', border: 'none', borderRadius: 10, background: copy.copied ? 'rgba(52,211,153,0.12)' : copy.failed ? 'rgba(196,107,107,0.12)' : 'rgba(var(--fg-rgb),0.08)', color: copy.copied ? 'var(--accent-green)' : copy.failed ? 'var(--accent-red)' : 'var(--text-sub)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
        {label}
      </button>
    </InfoModal>
  );
}
