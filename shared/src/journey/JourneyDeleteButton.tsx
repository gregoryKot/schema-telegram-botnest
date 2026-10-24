// Кнопка удаления записи в детальном просмотре «Моего пути» — общая для
// обоих фронтендов (правило №3). Удаляемы только упражнения с собственным
// DELETE-роутом (journeyDelete.ts): проверка убеждения, письмо себе,
// кризисная карточка. Двухтапное подтверждение — общий хук useConfirmTap
// (правило «одна механика — один компонент»), стиль — как в PracticesList.tsx.
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
    <div style={{ marginTop: 10 }}>
      {del.failed && (
        <div
          role="alert"
          style={{
            fontSize: 13,
            color: 'rgba(255,100,100,0.9)',
            marginBottom: 8,
            lineHeight: 1.5,
          }}
        >
          {tr(
            'Не получилось удалить. Проверь связь и попробуй ещё раз.',
            'Не получилось удалить. Проверьте связь и попробуйте ещё раз.',
          )}
        </div>
      )}
      <button
        onClick={() => tap(CONFIRM_ID)}
        disabled={del.busy}
        style={{
          width: '100%',
          minHeight: 44,
          padding: '13px 0',
          borderRadius: 14,
          border: 'none',
          fontFamily: 'inherit',
          fontSize: 14,
          fontWeight: 600,
          cursor: del.busy ? 'default' : 'pointer',
          opacity: del.busy ? 0.6 : 1,
          background: pending
            ? 'rgba(255,100,100,0.16)'
            : 'rgba(255,100,100,0.1)',
          color: 'rgba(255,100,100,0.9)',
        }}
      >
        {label}
      </button>
    </div>
  );
}
