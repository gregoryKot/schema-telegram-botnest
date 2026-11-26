// Кабинет не загрузился (useBootstrapLoad вернул error). Вынесен из AppShell.tsx (правило №10): до
// 2026-11 экран был инлайн-стилями — голый текст, прижатый влево на компьютере, и почти чёрная
// кнопка вне языка продукта. Теперь — полноэкранный исход «на нашей стороне» (PaperOutcome:
// Breath на персике, docs/design/APP_2026-11.md, «Исходы служебных страниц»), тексты прежние.
import { useTr } from '../../utils/addressForm';
import { PaperOutcome } from '../paper/PaperOutcome';

export function LoadErrorScreen({ onRetry = () => window.location.reload() }: { onRetry?: () => void }) {
  const tr = useTr();
  return (
    <PaperOutcome
      outcome="our_side"
      title="Не удалось загрузить"
      lead={tr('Проверь подключение и попробуй ещё раз', 'Проверьте подключение и попробуйте ещё раз')}
      action={{ label: 'Повторить', onClick: onRetry }}
    />
  );
}
