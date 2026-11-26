// Кнопка удаления записи в детальном просмотре «Моего пути» — общая для
// обоих фронтендов (правило №3). Удаляемы только упражнения с собственным
// DELETE-роутом (journeyDelete.ts): проверка убеждения, письмо себе,
// кризисная карточка. Двухтапное подтверждение — общий хук useConfirmTap
// (правило «одна механика — один компонент»). Вид — тихая ссылка под «Поделиться карточкой»
// (одна залитая кнопка на экран), подтверждение — красным словом (webapp/src/styles/journey.css).
import { useConfirmTap } from '../hooks/useConfirmTap';
import { isJourneyDeletable, type JourneyDeleteState } from './journeyDelete';
import type { JourneyItem } from './journeyMeta';

// Один и тот же item виден всё время, пока лист открыт — id для useConfirmTap
// нужен только чтобы отличать «тот же элемент/другой», здесь он один.
const CONFIRM_ID = 'journey-delete';

export function JourneyDeleteButton({
  tr,
  item,
  del,
}: {
  tr: (ty: string, vy: string) => string;
  item: JourneyItem;
  del: JourneyDeleteState;
}) {
  const { tap, isPending } = useConfirmTap<string>(() => del.remove(item));

  if (!isJourneyDeletable(item.type)) return null;

  const pending = isPending(CONFIRM_ID);
  const label = del.busy
    ? 'Удаляю…'
    : pending
      ? 'Точно удалить? Это навсегда'
      : 'Удалить запись';

  return (
    <div className="jr-delete">
      {del.failed && (
        <p role="alert" className="jr-delete-err">
          {tr(
            'Не получилось удалить. Проверь связь и попробуй ещё раз.',
            'Не получилось удалить. Проверьте связь и попробуйте ещё раз.',
          )}
        </p>
      )}
      <button
        type="button"
        className={'ds-link jr-delete-btn' + (pending ? ' is-pending' : '')}
        onClick={() => tap(CONFIRM_ID)}
        disabled={del.busy}
      >
        {label}
      </button>
    </div>
  );
}
