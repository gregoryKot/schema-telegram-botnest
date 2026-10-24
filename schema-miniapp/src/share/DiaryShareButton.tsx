// Единственная копия логики и вёрстки — в shared (правило №3): вёрстка
// была идентична webapp 1-в-1. Инъекция платформенного — ниже.
import {
  DiaryShareButton as Shared,
  type DiaryShareButtonProps,
} from '../../../shared/src/share/DiaryShareButton';
import { SharePill } from './SharePill';
import { ShareCardSheet } from './ShareCardSheet';
import { botShortUrl } from '../utils/botConfig';

type OwnProps = Pick<
  DiaryShareButtonProps,
  'emoji' | 'title' | 'color' | 'entries'
>;

export function DiaryShareButton(props: OwnProps) {
  return (
    <Shared
      {...props}
      botShortUrl={botShortUrl}
      ShareCardSheet={ShareCardSheet}
      renderButton={(onClick) => <SharePill compact onClick={onClick} />}
    />
  );
}
