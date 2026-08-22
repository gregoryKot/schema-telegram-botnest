// Единственная копия логики и вёрстки — в shared (правило №3): вёрстка
// была идентична webapp 1-в-1. Инъекция платформенного — ниже.
import { MonthShareButton as Shared } from '../../../../shared/src/share/MonthShareButton';
import { SharePill } from '../../share/SharePill';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { botShortUrl } from '../../utils/botConfig';

export function MonthShareButton(props: {
  activeDates: Set<string>;
  totalDays: number;
}) {
  return (
    <Shared
      {...props}
      botShortUrl={botShortUrl}
      ShareCardSheet={ShareCardSheet}
      renderButton={(onClick) => <SharePill compact onClick={onClick} />}
    />
  );
}
