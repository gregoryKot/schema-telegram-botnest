import { useTr } from '../utils/addressForm';
import { PaperAlert } from './paper/PaperAlert';

// Баннер «не удалось сохранить».
// Отказ записи не должен уходить только в телеметрию: человек видит, что
// выбор остался лишь на этом устройстве. Вид — сбой строкой на бумаге соломы
// (PaperAlert), а не красный текст: данные на месте, это не вина человека.
export function SaveErrorNote({ ty, vy }: { ty: string; vy: string }) {
  const tr = useTr();
  return <PaperAlert title={tr(ty, vy)} />;
}
