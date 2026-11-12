import type { TherapySignal } from '../../../../shared/src/therapy/bridge/therapySignal';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { Strokes } from '../art/PaperArt';
import { SignArt } from '../art/SignArt';

/**
 * Знак карточки моста (b24): спокойная — `Talk` (разговор с человеком); по сигналу — знак того, что заметили.
 * Низкий индекс — `Strokes days`: три полоски одного тона, высота — индекс каждого из трёх последних заполненных дней сигнала
 * (нет значений — обезличенные полоски, выдуманных оценок нет); повторяющийся режим — `Cluster`;
 * тяжёлый день — `Heart`.
 */
export function TherapyCardSign({ signal }: { signal?: TherapySignal | null }) {
  if (!signal) return <SignArt sign={ENTITY_LOOK.therapist.sign} size="row" />;
  if (signal.trigger === 'low_index') {
    return signal.days?.length ? <Strokes size="row" days={signal.days} /> : <Strokes size="row" />;
  }
  return <SignArt sign={signal.trigger === 'repeat_mode' ? 'cluster' : 'heart'} size="row" />;
}
