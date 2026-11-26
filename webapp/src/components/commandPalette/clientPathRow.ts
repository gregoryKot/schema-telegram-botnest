import { clientMark } from './clientRows';
import type { CmdRow } from './cmdRow';
import type { PaletteInput } from './paletteRows';
import { clientDisplayName } from '../../../../shared/src/therapy/clientInitials';
import { clientRef } from '../../../../shared/src/utils/clientRef';
import type { TherapyClientSummary } from '../../api';
import { planPhasesPath } from '../therapist/plan/planLayoutParam';

const LABEL = 'Путь терапии';

/** «Иван путь»: «План работы» клиента в раскладке по фазам. */
export function clientPathRow(c: TherapyClientSummary, run: PaletteInput['run']): CmdRow {
  const name = clientDisplayName(c);
  return {
    key: `client-tab:${c.telegramId}:path`, kind: 'client_tab', group: 'Карточка клиента', label: `${name} · ${LABEL}`,
    sub: 'План по фазам', mark: clientMark(c), search: `${name} ${LABEL}`, action: () => run.path(planPhasesPath(clientRef(c))),
  };
}
