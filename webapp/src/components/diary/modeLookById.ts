// Вид режима по id для экранов дневника режимов (выбор, форма, сомнение, «готово», цепочка):
// бумага группы и знак — свой (Flare у «Сердитого Ребёнка») или группы (modeLook, shared). Группу
// находит getModeById этого фронта; неизвестный режим — небо режимов и Cluster, без выдуманной группы.
import { getModeById } from '../../schemaTherapyData';
import { modeLook, type ModeLook } from '../../../../shared/src/theme/entityLook';

export const modeLookById = (modeId: string): ModeLook => modeLook(modeId, getModeById(modeId)?.groupId);

/** Виды режимов без повторов, по порядку: цепочка «Критик → Ребёнок» показывает знак группы
 *  кандидатов один раз, а не три одинаковых знака подряд. */
export function uniqueModeLooks(ids: string[]): ModeLook[] {
  const seen = new Set<string>();
  return ids.map(modeLookById).filter((l) => {
    const key = `${l.hue}:${l.sign}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
