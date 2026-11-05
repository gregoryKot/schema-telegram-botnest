import { useState } from 'react';
import { readLocal, writeLocal } from '../../../../../shared/src/utils/safeLocalStorage';
import {
  BRIEF_BLOCKS_KEY,
  parseBriefBlocks,
  serializeBriefBlocks,
  toggleBriefBlock,
  type BriefBlockId,
} from '../../../../../shared/src/therapy/conceptBrief/conceptBrief';

// Выбор блоков экрана «Главное» — на этом устройстве (localStorage), один на всех
// клиентов терапевта: «что для меня важно» — свойство терапевта, а не случая.
// В серверную синхронизацию uiPrefs ключ не входит (docs/open/therapy.md).
export function useBriefBlocks(): [BriefBlockId[], (id: BriefBlockId) => void] {
  const [ids, setIds] = useState<BriefBlockId[]>(() => parseBriefBlocks(readLocal(BRIEF_BLOCKS_KEY)));
  const toggle = (id: BriefBlockId) => {
    const next = toggleBriefBlock(ids, id);
    setIds(next);
    writeLocal(BRIEF_BLOCKS_KEY, serializeBriefBlocks(next));
  };
  return [ids, toggle];
}
