// Подписи под пятью ответами шкалы трекера меняются
// с каждым открытием вопроса: по одной строке из пула потребности (ротация — exampleRotation).
import { useAddressForm, type AddressForm } from '../utils/addressForm';
import { useExampleWindow } from './exampleRotation';
import { glue } from '../utils/typo';
import type { NeedId, Tr } from './types';
import type { AnchorPools, AnchorStep } from './content/anchors/types';
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
 * Подписи пяти ответов шкалы, склеенные (glue): по одной из пула ступени, выбраны раз на открытие экрана.
 * Незнакомая потребность — без подписей.
 */
export function useAnchorSublabels(needId: NeedId): (string | undefined)[] {
  const pools: AnchorPools | undefined =
    getAnchorPools(useAddressForm())[needId];
  const key = (step: AnchorStep) => `anchor:${needId}:${step}`;
  const picked = [
    useExampleWindow(key('low'), pools?.low, 1),
    useExampleWindow(key('little'), pools?.little, 1),
    useExampleWindow(key('mid'), pools?.mid, 1),
    useExampleWindow(key('mostly'), pools?.mostly, 1),
    useExampleWindow(key('high'), pools?.high, 1),
  ];
  return picked.map(([s]) => (s ? glue(s) : undefined));
}
