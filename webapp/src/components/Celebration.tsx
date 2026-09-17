// Единственная копия — в shared (правило №3); здесь только инъекция
// платформенного: tr (ты/вы), ссылка бота и трекинг событий.
import { Celebration as SharedCelebration } from '../../../shared/src/components/Celebration';
import { botShortUrl } from '../utils/botConfig';
import { api } from '../api';
import { useTr } from '../utils/addressForm';

interface Props {
  streak: number;
  onDone: () => void;
  insight?: string | null;
}

export function Celebration(props: Props) {
  const tr = useTr();
  return (
    <SharedCelebration
      {...props}
      tr={tr}
      botShortUrl={botShortUrl}
      trackEvent={(name, meta) => api.trackEvent(name, meta)}
    />
  );
}
