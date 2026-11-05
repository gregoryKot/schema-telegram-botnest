import { useTr } from '../utils/addressForm';
import { formerTherapistText, formerTherapistTitle } from './formerTherapist';
import type { FormerTherapistInfo } from './formerTherapist';
import { useFormerTherapist } from './useFormerTherapist';

// Строка о бывшем терапевте (отказ от роли, терапевт убрал клиента, клиент
// отключился сам — текст по причине, formerTherapist.ts) — один компонент на
// все места (правило «одна механика — один компонент»): профиль сайта и
// «Мой терапевт» в настройках. Обёртку и отступы задаёт экран (`className`),
// цвета — токены.
export function FormerTherapistNote({
  load,
  enabled,
  className,
}: {
  load: () => Promise<FormerTherapistInfo | null>;
  enabled: boolean;
  className?: string;
}) {
  const tr = useTr();
  const info = useFormerTherapist(load, enabled);
  if (!info) return null;
  return (
    <div role="note" className={className}>
      <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>
        {formerTherapistTitle(info, tr)}
      </div>
      <div
        style={{
          color: 'var(--text-sub)',
          fontSize: 13,
          lineHeight: 1.5,
          marginTop: 4,
        }}
      >
        {formerTherapistText(info, tr)}
      </div>
    </div>
  );
}
