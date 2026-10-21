// Строки механики «пара» живут в shared/src/pair/pairTexts.ts (правила №3/№11);
// здесь только привязка к форме обращения мини-аппа.
import { useTr } from '../../utils/addressForm';
import { pairTexts } from '../../../../shared/src/pair/pairTexts';

export function usePairTexts() {
  const tr = useTr();
  return { tr, ...pairTexts(tr) };
}
