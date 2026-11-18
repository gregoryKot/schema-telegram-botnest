// Подписи под ответами шкалы трекера («Совсем нет», «Наполовину», «Полностью») меняются
// с каждым открытием вопроса: по одной строке из пула потребности (ротация — exampleRotation).
import { useAddressForm, type AddressForm } from '../utils/addressForm';
import { useExampleWindow } from './exampleRotation';
import { wordAnchorDescriptions } from './ratingWords';
import { glue } from '../utils/typo';
import type { NeedId, Tr } from './types';
import type { AnchorPools } from './content/anchors/types';
import { attachmentAnchors } from './content/anchors/attachment';
import { autonomyAnchors } from './content/anchors/autonomy';
import { expressionAnchors } from './content/anchors/expression';
import { playAnchors } from './content/anchors/play';
import { limitsAnchors } from './content/anchors/limits';

export const buildAnchorPools = (tr: Tr): Record<NeedId, AnchorPools> => ({
  attachment: attachmentAnchors(tr),
  autonomy: autonomyAnchors(tr),
  expression: expressionAnchors(),
  play: playAnchors(tr),
  limits: limitsAnchors(),
});

const cache: Partial<Record<AddressForm, Record<NeedId, AnchorPools>>> = {};

export function getAnchorPools(form: AddressForm): Record<NeedId, AnchorPools> {
  return (cache[form] ??= buildAnchorPools((ty, vy) =>
    form === 'vy' ? vy : ty,
  ));
}

/**
 * Подписи пяти ответов шкалы, склеенные (glue): якорные — из пула, выбраны раз на открытие экрана.
 * Незнакомая потребность — без подписей.
 */
export function useAnchorSublabels(needId: NeedId): (string | undefined)[] {
  const pools: AnchorPools | undefined =
    getAnchorPools(useAddressForm())[needId];
  const [low] = useExampleWindow(`anchor:${needId}:low`, pools?.low, 1);
  const [mid] = useExampleWindow(`anchor:${needId}:mid`, pools?.mid, 1);
  const [high] = useExampleWindow(`anchor:${needId}:high`, pools?.high, 1);
  return wordAnchorDescriptions(
    [low, mid, high].filter(Boolean).map((s) => ({ description: glue(s) })),
  );
}
