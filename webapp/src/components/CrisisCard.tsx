// Тонкая обёртка над общей CrisisCardView (правило №3): прокидывает свой tr
// (ты/вы), track (аналитика) и знак Heart (ENTITY_LOOK.sos). Тело карточки — в
// shared/src/components. flat — карточка на бережном листе экрана: его знак уже
// стоит рядом, второй Heart в шаг от первого не ставится. signless — своя бумага, но без
// знака: сердце уже стоит вплотную выше (квадрат «Мне плохо» над «Помощью рядом», ревью g4 r3).
import type { ReactNode } from 'react';
import { useTr } from '../utils/addressForm';
import { CrisisCardView } from '../../../shared/src/components/CrisisCard';
import { Heart } from './art/PaperArtSigns';
import { api } from '../api';

type Props = { surface?: string; standing?: boolean; compact?: boolean; flat?: boolean; signless?: boolean; label?: ReactNode; labelAs?: 'span' | 'h2' | 'h3'; children?: ReactNode };

export function CrisisCard({ signless, ...p }: Props = {}) {
  const tr = useTr();
  return <CrisisCardView {...p} art={p.flat || signless ? undefined : <Heart size="row" />} tr={tr} track={api.trackEvent} />;
}
