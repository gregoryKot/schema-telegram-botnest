import { useEffect } from 'react';
import { api } from '../../api';
import { GAME_APP_ARRIVE_EVENT } from '../../../../shared/src/share/analytics';
import { dropUrlParam } from '../../utils/dropUrlParam';

// Кнопка финала игры ведёт на `/?from=game` (game/src/therapyCta.ts): лендинг
// считает приход в /stats и убирает метку, чтобы перезагрузка не считалась вторым.
export function useGameArrival(): void {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('from') !== 'game') return;
    api.trackPublicEvent(GAME_APP_ARRIVE_EVENT);
    dropUrlParam('from');
  }, []);
}
