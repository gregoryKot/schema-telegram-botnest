// Вид записки «Тёплых слов» (WarmWordNote, b18): бумага — тёплые оттенки по очереди (персик, роза, солома),
// соседние записки разной бумаги; знак — кому отвечали слова: группа режима (modeLookById: Looming у
// критиков, ChildCare у детских, Flare у «Сердитого Ребёнка»), у переписанной фразы режима нет — знак
// заботы Together (так звучит голос, который помогает), режим вне реестра — общий знак режимов Cluster.
import type { WarmWordsItem } from '../../../../shared/src/warmWords/collectWarmWords';
import { MODE_GROUP_SIGN, PAPER_HUE, type Look } from '../../../../shared/src/theme/entityLook';
import { modeLookById } from '../diary/modeLookById';

export const WARM_NOTE_HUES = [PAPER_HUE.peach, PAPER_HUE.rose, PAPER_HUE.straw] as const;

export function warmNoteLook(item: Pick<WarmWordsItem, 'source' | 'modeId'>, index: number): Look {
  const hue = WARM_NOTE_HUES[index % WARM_NOTE_HUES.length];
  const sign = item.source === 'phrase' ? MODE_GROUP_SIGN.healthy : modeLookById(item.modeId).sign;
  return { hue, sign };
}
