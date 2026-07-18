import { useEffect, useRef } from 'react';
import { api, PairsData } from '../api';
import { UseSheetsReturn } from './useSheets';

interface Args {
  sheets: UseSheetsReturn;
  newDiaryEntry: 'schema' | 'mode' | 'gratitude' | null;
  setNewDiaryEntry: (v: 'schema' | 'mode' | 'gratitude' | null) => void;
  therapistMode: boolean;
  cabinetView: 'list' | 'client';
  therapistBackHandlerRef: { current: () => void };
  setPairData: (data: PairsData) => void;
}

// Управление Telegram BackButton — какой оверлей закрывать по кнопке
// «Назад» и когда её вообще показывать. Перенесено из App.tsx как есть
// (этап 3 REMEDIATION_PLAN), сохраняя порядок и зависимости эффектов.
export function useTelegramBackButton({
  sheets,
  newDiaryEntry,
  setNewDiaryEntry,
  therapistMode,
  cabinetView,
  therapistBackHandlerRef,
  setPairData,
}: Args) {
  const backHandlerRef = useRef<() => void>(() => {});
  useEffect(() => {
    backHandlerRef.current = newDiaryEntry
      ? () => setNewDiaryEntry(null)
      : sheets.trackerOverlay
        ? () => sheets.close('trackerOverlay', { trackerNeedId: null })
        : sheets.tracker
          ? () => sheets.close('tracker', { trackerTab: 'today' })
          : sheets.diaries
            ? () => sheets.close('diaries')
            : sheets.schemaInfo
              ? () => sheets.close('schemaInfo', { schemaAutoStartTest: false })
              : sheets.settings
                ? () => sheets.close('settings')
                : sheets.practices
                  ? () => sheets.close('practices')
                  : sheets.plans
                    ? () => sheets.close('plans')
                    : sheets.about
                      ? () => sheets.close('about')
                      : sheets.pairSheet
                        ? () => {
                            sheets.close('pairSheet');
                            void api.getPair().then(setPairData);
                          }
                        : sheets.childhoodWheel
                          ? () => sheets.close('childhoodWheel')
                          : sheets.practicesOnboarding
                            ? () => sheets.close('practicesOnboarding')
                            : sheets.todayNote
                              ? () => sheets.close('todayNote')
                              : therapistMode && cabinetView === 'client'
                                ? () => therapistBackHandlerRef.current()
                                : () => {};
    const bb = window.Telegram?.WebApp?.BackButton;
    if (!bb) return;
    const anyOpen =
      newDiaryEntry ||
      sheets.trackerOverlay ||
      sheets.tracker ||
      sheets.diaries ||
      sheets.schemaInfo ||
      sheets.settings ||
      sheets.practices ||
      sheets.plans ||
      sheets.about ||
      sheets.pairSheet ||
      sheets.childhoodWheel ||
      sheets.practicesOnboarding ||
      sheets.todayNote ||
      (therapistMode && cabinetView === 'client');
    if (anyOpen) bb.show();
    else bb.hide();
  }, [
    newDiaryEntry,
    sheets.trackerOverlay,
    sheets.tracker,
    sheets.diaries,
    sheets.schemaInfo,
    sheets.settings,
    sheets.practices,
    sheets.plans,
    sheets.about,
    sheets.pairSheet,
    sheets.childhoodWheel,
    sheets.practicesOnboarding,
    sheets.todayNote,
    therapistMode,
    cabinetView,
  ]);

  useEffect(() => {
    const bb = window.Telegram?.WebApp?.BackButton;
    if (!bb) return;
    const handler = () => backHandlerRef.current();
    bb.onClick(handler);
    return () => bb.offClick(handler);
  }, []);
}
