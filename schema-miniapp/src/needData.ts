// Единственная копия — в shared (правило №3 CLAUDE.md). Раньше этот файл и
// его двойник в webapp почти дословно дублировали друг друга — весь текст
// пяти потребностей теперь живёт в shared/src/needs/.
export {
  NEED_ORDER,
  buildNeedData,
  getNeedData,
  useNeedData,
} from '../../shared/src/needs/needData';
export type {
  NeedId,
  NeedExtra,
  NeedDataMap,
} from '../../shared/src/needs/needData';
