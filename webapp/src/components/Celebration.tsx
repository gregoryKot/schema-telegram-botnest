// Единственная копия разметки — CelebrationDialog; здесь только инъекция
// платформенного: tr (ты/вы), ссылка бота и трекинг событий.
import type { ComponentProps } from 'react';
import { CelebrationDialog } from './CelebrationDialog';
import { botShortUrl } from '../utils/botConfig';
import { api } from '../api';
import { useTr } from '../utils/addressForm';

type Props = Omit<ComponentProps<typeof CelebrationDialog>, 'tr' | 'botShortUrl' | 'trackEvent'>;

export function Celebration(props: Props) {
  const tr = useTr();
  return (
    <CelebrationDialog
      {...props}
      tr={tr}
      botShortUrl={botShortUrl}
      trackEvent={(name, meta) => api.trackEvent(name, meta)}
    />
  );
}
