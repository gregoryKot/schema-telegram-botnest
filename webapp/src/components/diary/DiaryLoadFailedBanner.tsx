import { useTr } from '../../utils/addressForm';
import { PaperAlert } from '../paper/PaperAlert';
import { alertParts } from '../paper/entryLook';

// Сбой ≠ пусто: НЕблокирующая строка-лист на месте ленты (пара к miniapp DiarySection/LoadErrorBanner) —
// отказ загрузки не прячет остальной UI: «Записать» остаётся. Бумага соломы без красной обводки (PaperAlert,
// b11): текст успокаивает — «записи на месте», знак «Записей» (Sheets — то, что уже собрано). Первая фраза —
// заголовок, остальное тише (alertParts); текст не меняется. Отдельный файл — правило №10 (DiarySection).
export function DiaryLoadFailedBanner({ onRetry }: { onRetry: () => void }) {
  const tr = useTr();
  const { title, text } = alertParts(tr(
    'Не удалось загрузить записи дневника. Проверь соединение — записи на месте, просто не загрузились',
    'Не удалось загрузить записи дневника. Проверьте соединение — записи на месте, просто не загрузились',
  ));
  return <PaperAlert title={title} text={text} sign="sheets" onRetry={onRetry} retryLabel="Обновить" />;
}
