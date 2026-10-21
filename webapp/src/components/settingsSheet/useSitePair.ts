import { api, reportClientError } from '../../api';
import { usePairMechanics } from '../../../../shared/src/pair/usePairMechanics';

// Привязка общего хука пары к api сайта. Смена роли (reloadKey) перезагружает
// пару, как делал прежний usePairSettings; сбои уходят наверх отчётом.
export function useSitePair(
  userRole: 'CLIENT' | 'THERAPIST' | undefined,
  onInviteCreated: (code: string, url: string) => void,
) {
  return usePairMechanics(api, {
    reloadKey: userRole,
    onInviteCreated,
    reportError: (message) => reportClientError({ message, section: 'pair' }),
  });
}
