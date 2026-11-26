import { useState } from 'react';
import { readLocal, writeLocal } from '../../../../../shared/src/utils/safeLocalStorage';
import { notifyPrefsChanged } from '../../../utils/uiPrefsSync';
import {
  BRIEF_BLOCKS_KEY,
  parseBriefBlocks,
  serializeBriefBlocks,
  toggleBriefBlock,
  type BriefBlockId,
} from '../../../../../shared/src/therapy/conceptBrief/conceptBrief';

// Выбор блоков «Главного» — свойство терапевта, один на всех клиентов; между устройствами ходит через uiPrefs.
export function useBriefBlocks(): [BriefBlockId[], (id: BriefBlockId) => void] {
  const [ids, setIds] = useState<BriefBlockId[]>(() => parseBriefBlocks(readLocal(BRIEF_BLOCKS_KEY)));
  const toggle = (id: BriefBlockId) => {
    const next = toggleBriefBlock(ids, id);
    setIds(next);
    writeLocal(BRIEF_BLOCKS_KEY, serializeBriefBlocks(next));
    notifyPrefsChanged();
  };
  return [ids, toggle];
}
