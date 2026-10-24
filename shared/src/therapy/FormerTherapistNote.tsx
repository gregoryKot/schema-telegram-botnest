import { useTr } from '../utils/addressForm';
import { formerTherapistText, formerTherapistTitle } from './formerTherapist';
import type { FormerTherapistInfo } from './formerTherapist';
import { useFormerTherapist } from './useFormerTherapist';

// Сообщение «терапевт больше не работает в приложении» — один компонент на
// оба фронтенда (правило «одна механика — один компонент»): профиль сайта,
// «Мой терапевт» в настройках сайта и мини-аппа. Обёртку и отступы задаёт
// экран (`className`), цвета — токены, общие для обоих фронтендов.
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
        {formerTherapistTitle(info.name)}
      </div>
      <div
        style={{
          color: 'var(--text-sub)',
          fontSize: 13,
          lineHeight: 1.5,
          marginTop: 4,
        }}
      >
        {formerTherapistText(tr)}
      </div>
    </div>
  );
}
