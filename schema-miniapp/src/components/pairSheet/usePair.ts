import { api, reportClientError } from '../../api';
import { usePairMechanics } from '../../../../shared/src/pair/usePairMechanics';

// Привязка общего хука пары к api мини-аппа и к отчёту наверх: обе поверхности
// (лист «Вместе», секция настроек) подключают его одинаково.
export function usePair(onInviteCreated?: (code: string, url: string) => void) {
  return usePairMechanics(api, {
    onInviteCreated,
    reportError: (message) => reportClientError({ message, section: 'pair' }),
  });
}
