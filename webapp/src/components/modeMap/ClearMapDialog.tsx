import { HistoryConfirmDialog } from '../HistoryConfirmDialog';

// «Очистить карту?» — просьба владельца «кнопка стереть всё», как «Reset the
// canvas» у Excalidraw. Подтверждение — общий ConfirmDialog с записью в истории
// браузера (HistoryConfirmDialog, как «Удалить карту?» в ModeMapSelector):
// «Назад» закрывает диалог, а не уводит из карточки клиента. Очистка обратима —
// снимок истории холста делает onConfirm до очистки.
export function ClearMapDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <HistoryConfirmDialog
      title="Очистить карту?"
      message="Уберутся все фигуры и линии этой карты. Концептуализация клиента не изменится. Вернуть можно кнопкой «Отменить» или ⌘Z."
      confirmLabel="Очистить"
      cancelLabel="Отмена"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
