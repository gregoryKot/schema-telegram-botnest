import { useCallback, useMemo, useReducer } from 'react';

export type SchemaTab = 'needs' | 'schemas' | 'modes';
export type TrackerTabName = 'today' | 'history';

export interface SheetsValues {
  about: boolean;
  schemaInfo: boolean;
  schemaAutoStartTest: boolean;
  schemaInitialTab: SchemaTab;
  schemaHighlight: string | undefined;
  settings: boolean;
  practices: boolean;
  plans: boolean;
  todayNote: boolean;
  pairSheet: boolean;
  childhoodWheel: boolean;
  tracker: boolean;
  trackerTab: TrackerTabName;
  trackerOverlay: boolean;
  trackerNeedId: string | null;
  trackerGoal: boolean;
  diaries: boolean;
  addressPicker: boolean;
}

export type SheetKey =
  | 'about'
  | 'schemaInfo'
  | 'settings'
  | 'practices'
  | 'plans'
  | 'todayNote'
  | 'pairSheet'
  | 'childhoodWheel'
  | 'tracker'
  | 'trackerOverlay'
  | 'trackerGoal'
  | 'diaries'
  | 'addressPicker';

const initialState: SheetsValues = {
  about: false,
  schemaInfo: false,
  schemaAutoStartTest: false,
  schemaInitialTab: 'needs',
  schemaHighlight: undefined,
  settings: false,
  practices: false,
  plans: false,
  todayNote: false,
  pairSheet: false,
  childhoodWheel: false,
  tracker: false,
  trackerTab: 'today',
  trackerOverlay: false,
  trackerNeedId: null,
  trackerGoal: false,
  diaries: false,
  addressPicker: false,
};

type Action =
  | { type: 'open'; sheet: SheetKey; payload?: Partial<SheetsValues> }
  | { type: 'close'; sheet: SheetKey; payload?: Partial<SheetsValues> };

function reducer(state: SheetsValues, action: Action): SheetsValues {
  switch (action.type) {
    case 'open':
      return { ...state, ...action.payload, [action.sheet]: true };
    case 'close':
      return { ...state, ...action.payload, [action.sheet]: false };
    default:
      return state;
  }
}

// Единый реестр видимости оверлеев/шитов App.tsx. open/close вместо
// отдельных useState на каждый showX — механическая замена без смены
// поведения (см. REMEDIATION_PLAN этап 3).
export function useSheets() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const open = useCallback(
    (sheet: SheetKey, payload?: Partial<SheetsValues>) =>
      dispatch({ type: 'open', sheet, payload }),
    [],
  );
  const close = useCallback(
    (sheet: SheetKey, payload?: Partial<SheetsValues>) =>
      dispatch({ type: 'close', sheet, payload }),
    [],
  );

  // Memoized so consumers can safely put `sheets` (or a field of it) into
  // effect/callback dependency arrays without picking up a new identity on
  // every unrelated re-render — only on an actual open/close.
  return useMemo(() => ({ ...state, open, close }), [state, open, close]);
}

export type UseSheetsReturn = ReturnType<typeof useSheets>;
