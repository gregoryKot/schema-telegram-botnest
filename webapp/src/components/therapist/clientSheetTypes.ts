import type { useClientDetail } from './useClientDetail';

export type ClientTab = 'overview' | 'concept' | 'mode_map' | 'sessions' | 'tasks' | 'ysq' | 'client_notes';

// Aggregate return of the useClientDetail hook — passed down to the tab
// sub-components so state/handlers stay owned by the parent sheet.
export type ClientDetail = ReturnType<typeof useClientDetail>;
