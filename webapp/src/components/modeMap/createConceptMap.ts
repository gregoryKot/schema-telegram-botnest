import { api, reportClientError, type ModeMapFull, type UserId } from '../../api';
import { buildConceptGraph } from '../../../../shared/src/therapy/conceptGraph/conceptGraphModel';
import type { ConceptGraphSource } from '../../../../shared/src/therapy/conceptGraph/conceptGraphTypes';
import { pickForm, type AddressForm } from '../../utils/addressForm';
import { conceptToModeMap } from './conceptToModeMap';
import { conceptMapTitle, distinctTitle } from './mapKinds';

const SECTION = 'therapist.conceptCanvas';

/**
 * Карта «Концептуализация» (#963): поля концептуализации → граф схемы случая →
 * фигуры холста → новая карта kind `concept`. Один путь на два входа: тип в
 * «Новая карта» (`useNewMap`) и «Открыть на холсте» во вкладке
 * «Концептуализация» (`useOpenConceptCanvas`, там `source` — с несохранёнными
 * правками). Не записались фигуры — пустая карта удаляется: повторная попытка
 * создала бы вторую рядом. Отказ уходит в телеметрию и пробрасывается дальше —
 * как его показать, решает вызывающий.
 */
export async function createConceptMap({ clientId, source, form, taken }: {
  clientId: UserId;
  source: ConceptGraphSource;
  form: AddressForm;
  /** Заголовки карт клиента: вторая карта за день получает номер. */
  taken: string[];
}): Promise<ModeMapFull> {
  let created: ModeMapFull | null = null;
  try {
    const { nodes, edges } = conceptToModeMap(buildConceptGraph(source, (ty, vy) => pickForm(form, ty, vy)));
    created = await api.createModeMap(clientId, distinctTitle(conceptMapTitle(), taken), 'concept');
    await api.updateModeMap(created.id, { nodes, edges });
    api.trackEvent('concept_canvas_open');
    return { ...created, nodes, edges };
  } catch (e) {
    reportClientError({ message: `concept canvas open failed: ${e instanceof Error ? e.message : 'unknown'}`, section: SECTION });
    if (created !== null) {
      api.deleteModeMap(created.id).catch(() => reportClientError({ message: 'concept canvas cleanup failed', section: SECTION }));
    }
    throw e;
  }
}
