// Единственная копия логики и вёрстки — в shared (правило №3): вёрстка
// была идентична миниаппу 1-в-1. Инъекция платформенного — ниже. Кнопка — тихая
// ссылка со знаком «Записей» (Sheets) в строке серии ленты, как остальные «Поделиться…»
// дневника (ревью g3: розовая плашка-иконка без подписи выпадала из языка).
import {
  DiaryShareButton as Shared,
  type DiaryShareButtonProps,
} from '../../../shared/src/share/DiaryShareButton';
import { SignArt } from '../components/art/SignArt';
import { ShareCardSheet } from './ShareCardSheet';
import { botShortUrl } from '../utils/botConfig';

type OwnProps = Pick<DiaryShareButtonProps, 'emoji' | 'title' | 'color' | 'entries'>;

export function DiaryShareButton(props: OwnProps) {
  return (
    <Shared
      {...props}
      botShortUrl={botShortUrl}
      ShareCardSheet={ShareCardSheet}
      renderButton={(onClick) => (
        <button type="button" className="ds-link cd-share-link" onClick={onClick}>
          <span className="cd-share-sign" aria-hidden="true"><SignArt sign="sheets" size="nav" /></span>Поделиться дневником
        </button>
      )}
    />
  );
}
