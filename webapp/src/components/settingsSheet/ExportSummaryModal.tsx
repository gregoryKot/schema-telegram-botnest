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
      <h2 className="dialog-title st-modal-title">Сводка для терапевта</h2>
      <pre className="st-pre">
        {text}
      </pre>
      <button className={`ds-btn ds-btn--secondary${copy.failed ? ' st-btn-danger' : ''} st-block`} onClick={() => void copy.copy(text)}>
        {label}
      </button>
    </InfoModal>
  );
}
