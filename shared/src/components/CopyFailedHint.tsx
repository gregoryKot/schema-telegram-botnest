import { useTr } from '../utils/addressForm';

// Единая формулировка «не удалось скопировать» (правило №3/«одна механика —
// один компонент») — раньше повторялась инлайном в каждом месте, где
// navigator.clipboard.writeText мог отказать (см. useCopyToClipboard).
// tr — необязательный override для мест без AddressFormContext (Celebration
// получает tr пропом, а не из контекста, — см. её комментарий).
export function CopyFailedHint({
  show,
  tr,
  marginTop = 8,
}: {
  show: boolean;
  tr?: (ty: string, vy: string) => string;
  marginTop?: number;
}) {
  const ctxTr = useTr();
  if (!show) return null;
  const t = tr ?? ctxTr;
  return (
    <div style={{ fontSize: 12, color: 'var(--accent-red)', marginTop }}>
      {t(
        'Не удалось скопировать — скопируй вручную',
        'Не удалось скопировать — скопируйте вручную',
      )}
    </div>
  );
}
