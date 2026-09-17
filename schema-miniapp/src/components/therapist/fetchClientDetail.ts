import { api } from '../../api';
import type {
  UserTask,
  TherapistNote,
  ClientConceptualization,
  ClientData,
} from '../../api';

export interface ClientSchemaNoteRow {
  schemaId: string;
  triggers: string;
  feelings: string;
  thoughts: string;
  origins: string;
  reality: string;
  healthyView: string;
  behavior: string;
}

export interface ClientModeNoteRow {
  modeId: string;
  triggers: string;
  feelings: string;
  thoughts: string;
  needs: string;
  behavior: string;
  origins: string;
  healthyView: string;
  modeFunction: string;
  needsMet: string;
}

export interface ClientDetailFetchResult {
  tasks: UserTask[];
  notes: TherapistNote[];
  concept: ClientConceptualization | null;
  clientData: ClientData | null;
  schemaNotes: ClientSchemaNoteRow[];
  modeNotes: ClientModeNoteRow[];
  // Хотя бы один из шести запросов упал. Раньше каждый глушился отдельным
  // no-op фолбэком — терапевт видел «у клиента нет заметок/задач» на
  // сетевом сбое неотличимо от того, что их и правда нет.
  loadError: boolean;
}

/**
 * Все данные карточки клиента одним заходом. Один упавший запрос не должен
 * молча превращать данные клиента в пустые — Promise.allSettled вместо
 * Promise.all с индивидуальными no-op фолбэками на каждый промис, плюс
 * явный флаг loadError, который вызывающая сторона может показать терапевту.
 */
export async function fetchClientDetail(
  clientId: number,
): Promise<ClientDetailFetchResult> {
  const results = await Promise.allSettled([
    api.getTherapyTasksForClient(clientId),
    api.getTherapistNotes(clientId),
    api.getConceptualization(clientId),
    api.getTherapyClientData(clientId),
    api.getClientSchemaNotes(clientId),
    api.getClientModeNotes(clientId),
  ]);
  const [tasksR, notesR, conceptR, dataR, snR, mnR] = results;
  const loadError = results.some((r) => r.status === 'rejected');
  if (loadError) {
    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('fetchClientDetail: часть запросов упала', r.reason);
      }
    }
  }
  return {
    tasks: tasksR.status === 'fulfilled' ? tasksR.value : [],
    notes: notesR.status === 'fulfilled' ? notesR.value : [],
    concept: conceptR.status === 'fulfilled' ? conceptR.value : null,
    clientData: dataR.status === 'fulfilled' ? dataR.value : null,
    schemaNotes: snR.status === 'fulfilled' ? snR.value : [],
    modeNotes: mnR.status === 'fulfilled' ? mnR.value : [],
    loadError,
  };
}
