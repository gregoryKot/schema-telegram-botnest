// Ветка «открыта запись» «Моего пути»: деталь + кнопка удаления (jscpd, правило №11); `art` — шапка и голос ЗВ.
import { JourneyItemDetail } from './JourneyItemDetail';
import type { JourneyDetailArt, JourneyDetailState } from './JourneyItemDetail';
import { JourneyDeleteButton } from './JourneyDeleteButton';
import type { JourneyDeleteState } from './journeyDelete';
import type { JourneyItem } from './journeyMeta';

export function JourneyDetailPane({
  detail,
  subtitle,
  tr,
  onShare,
  del,
  art,
}: {
  detail: JourneyDetailState;
  subtitle: (item: JourneyItem) => string | null;
  tr: (ty: string, vy: string) => string;
  onShare: (item: JourneyItem) => void;
  del: JourneyDeleteState;
  art?: JourneyDetailArt;
}) {
  const { item } = detail;
  if (!item) return null;
  return (
    <JourneyItemDetail
      detail={detail}
      subtitle={subtitle}
      art={art}
      onShare={() => onShare(item)}
      deleteButton={<JourneyDeleteButton tr={tr} item={item} del={del} />}
    />
  );
}
