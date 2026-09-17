// Ветка «открыта запись» экрана «Мой путь» — вынесена из обоих JourneySheet
// (webapp/schema-miniapp), где была дословным дублем (jscpd, правило №11):
// детальный просмотр + кнопка удаления. Общий компонент — правило «одна
// механика — один компонент» / №3.
import type { JourneyDetailState } from './JourneyItemDetail';
import { JourneyItemDetail } from './JourneyItemDetail';
import { JourneyDeleteButton } from './JourneyDeleteButton';
import type { JourneyDeleteState } from './journeyDelete';
import type { JourneyItem } from './journeyMeta';

export function JourneyDetailPane({
  detail,
  subtitle,
  tr,
  onShare,
  del,
}: {
  detail: JourneyDetailState;
  subtitle: (item: JourneyItem) => string | null;
  tr: (ty: string, vy: string) => string;
  onShare: (item: JourneyItem) => void;
  del: JourneyDeleteState;
}) {
  const item = detail.item;
  if (!item) return null;
  return (
    <JourneyItemDetail
      detail={detail}
      subtitle={subtitle}
      onShare={() => onShare(item)}
      deleteButton={<JourneyDeleteButton tr={tr} item={item} del={del} />}
    />
  );
}
