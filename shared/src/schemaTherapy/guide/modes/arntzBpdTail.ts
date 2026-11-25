import { angryCh9 } from './angryChildCh9';
import { detachedCh9 } from './detachedProtectorCh9';
import { happyCh9 } from './happyChildCh9';
import { undisciplinedCh9 } from './undisciplinedChildCh9';
import { vulnerableCh9 } from './vulnerableChildCh9';

/** Дополнения гл. 9 Арнца и ван Гендерен о ПРЛ по id режима; подключается в arntzModeMore.ts. */
export const BPD_MODE_TAIL: Record<string, string[]> = {
  detached_protector: detachedCh9,
  vulnerable_child: vulnerableCh9,
  angry_child: angryCh9,
  happy_child: happyCh9,
  undisciplined_child: undisciplinedCh9,
};
