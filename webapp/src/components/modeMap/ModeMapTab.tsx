import type { UserId } from '../../api';
import { ModeMapSelector } from '../ModeMapSelector';
import { PaperEmpty } from '../art/PaperEmpty';
import { Cluster } from '../art/PaperArtSigns';
import { useIsMobile } from '../useIsMobile';

// Вкладка «Графические карты» карточки клиента. На телефоне холста нет: палитра,
// тулбар, его меню и подсказка пустого холста ложились друг на друга, а узлы и
// связи на экране телефона не разглядеть (владелец 2026-11-05: «убрать совсем,
// просто сообщение, что откройте на компе»). Вместо холста — одна строка;
// карты никуда не деваются, на компьютере и планшете они те же.
// Условие «телефон» — общее для сайта (useIsMobile). Знак — круги режимов, как у пустого холста.
export function ModeMapTab({ clientId, initialMapId }: { clientId: UserId; initialMapId?: number }) {
  const mobile = useIsMobile();
  if (mobile) return <ModeMapDesktopOnly />;
  return <ModeMapSelector clientId={clientId} initialMapId={initialMapId} />;
}

export const MODE_MAP_DESKTOP_ONLY =
  'Графические карты открываются на компьютере или планшете: на экране телефона холсту с режимами и связями тесно';

function ModeMapDesktopOnly() {
  return (
    <div className="mm2-center">
      <PaperEmpty art={Cluster}>{MODE_MAP_DESKTOP_ONLY}</PaperEmpty>
    </div>
  );
}
