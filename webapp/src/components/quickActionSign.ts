// Знак быстрого действия в палитре ⌘K (CommandPalette.tsx) и листе «Инструментов» — знак его сущности.
import { ENTITY_LOOK, QUICK_ACTION_ENTITY, type SignKey } from '../../../shared/src/theme/entityLook';
import type { QuickActionId } from '../../../shared/src/quickActions/quickActions';

/** Знак быстрого действия — знак его сущности (QUICK_ACTION_ENTITY → ENTITY_LOOK): одна сущность — один знак. */
export const quickActionSign = (id: QuickActionId): SignKey => ENTITY_LOOK[QUICK_ACTION_ENTITY[id]].sign;
