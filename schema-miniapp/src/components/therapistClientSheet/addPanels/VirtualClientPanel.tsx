import { AddClient } from '../types';
import { AddInputPanel } from './AddInputPanel';
import { CLIENT_NAME_MAX } from '../../../../../shared/src/limits/textLimits';

// Панель «оффлайн-клиент»: одно поле с именем. Предел длины — тот же, что у
// сервера (`VirtualClientDto.name`): без него набранное длинное имя вернулось
// бы 400 на «Создать». Вынесено из ClientListView.tsx (правило №10).
export function VirtualClientPanel({
  addClient,
  inputRef,
}: {
  addClient: AddClient;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <AddInputPanel
      addClient={addClient}
      inputRef={inputRef}
      onSubmit={addClient.addVirtualClient}
      placeholder="Имя клиента"
      maxLength={CLIENT_NAME_MAX}
      submitLabel="Создать"
      accent
      hint="Для работы без Telegram: заметки, концептуализация, задания"
    />
  );
}
