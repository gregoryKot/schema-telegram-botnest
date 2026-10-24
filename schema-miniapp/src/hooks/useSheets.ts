import { useCallback, useMemo, useReducer } from 'react';
import { dropOpen, pushOpen } from './sheetsStack';

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
  // Разбор случая («Что это было») — новая точка входа, и карта себя, куда
  // он складывается. Открываются с «Сегодня» и друг из друга.
  caseFlow: boolean;
  selfMap: boolean;
  // Экран-подтверждение присоединения по startParam (M1, аудит 2026-08):
  // pair_/therapy_ в ссылке НЕ джойнят молча на маунте, а сначала спрашивают
  // согласие. joinKind/joinCode — что именно подтверждаем.
  joinConfirm: boolean;
  joinKind: 'pair' | 'therapy' | null;
  joinCode: string | null;
}

// openOrder — порядок открытия, см. sheetsStack.
export type SheetsState = SheetsValues & { openOrder: SheetKey[] };

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
  | 'addressPicker'
  | 'caseFlow'
  | 'selfMap'
  | 'joinConfirm';

export const initialState: SheetsState = {
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
  caseFlow: false,
  selfMap: false,
  joinConfirm: false,
  joinKind: null,
  joinCode: null,
  openOrder: [],
};

type Action =
  | { type: 'open'; sheet: SheetKey; payload?: Partial<SheetsValues> }
  | { type: 'close'; sheet: SheetKey; payload?: Partial<SheetsValues> };

function reducer(state: SheetsState, action: Action): SheetsState {
  const isOpen = action.type === 'open';
  return {
    ...state,
    ...action.payload,
    [action.sheet]: isOpen,
    openOrder: (isOpen ? pushOpen : dropOpen)(state.openOrder, action.sheet),
  };
}

// Единый реестр видимости оверлеев/шитов App.tsx (REMEDIATION_PLAN этап 3).
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

  // Memoized: identity меняется только при реальном open/close.
  return useMemo(() => ({ ...state, open, close }), [state, open, close]);
}

export type UseSheetsReturn = ReturnType<typeof useSheets>;
