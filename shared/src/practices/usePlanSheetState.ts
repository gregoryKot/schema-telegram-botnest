// Состояние листа «Запланировать практику» (PlanSheet, правило №3): загрузка
// практик и пояса, выбор часа, сохранение и .ics; вёрстка — в PlanSheet.
import { useEffect, useState } from 'react';
import { CURATED } from './curated';
import { savePracticeIcs, type PracticeIcsLink } from './savePracticeIcs';
import { notifyReachable } from '../settings/notifyReach';

export const REMINDER_OPTIONS: Array<{
  label: string;
  localHour: number | null;
}> = [
  { label: 'Утром', localHour: 9 },
  { label: 'Днём', localHour: 13 },
  { label: 'Вечером', localHour: 19 },
  { label: 'Без напоминания', localHour: null },
];

export function defaultReminderIdx(): number {
  const h = new Date().getHours();
  if (h < 12) return 0; // Утром
  if (h < 17) return 1; // Днём
  return 2; // Вечером
}

function ianaToUtcOffset(iana: string): number {
  try {
    const now = new Date();
    const utcMs = new Date(
      now.toLocaleString('en-US', { timeZone: 'UTC' }),
    ).getTime();
    const localMs = new Date(
      now.toLocaleString('en-US', { timeZone: iana }),
    ).getTime();
    return Math.round((localMs - utcMs) / 3600000);
  } catch {
    return 3;
  }
}

export interface UserPracticeLike {
  id: number;
  text: string;
}

type PlanSettings = { notifyTimezone: string; notifyReachable?: boolean };
export interface PlanSheetApi {
  getPractices: (needId: string) => Promise<UserPracticeLike[]>;
  getSettings: () => Promise<PlanSettings>;
  addPractice: (needId: string, text: string) => Promise<unknown>;
  deletePractice: (id: number) => Promise<unknown>;
  createPlan: (
    needId: string,
    text: string,
    reminderLocalHour?: number,
  ) => Promise<unknown>;
  practiceIcsLink: PracticeIcsLink;
}

export interface PlanSheetOption {
  text: string;
  isUser: boolean;
  id: number | undefined;
}

export function usePlanSheetState(
  needId: string,
  needLabel: string,
  api: PlanSheetApi,
  onSaved: () => void,
) {
  const [userPractices, setUserPractices] = useState<UserPracticeLike[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [customText, setCustomText] = useState('');
  const [reminderIdx, setReminderIdx] = useState(defaultReminderIdx);
  const [tzOffset, setTzOffset] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [icsFailed, setIcsFailed] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [phase, setPhase] = useState<'pick' | 'confirm'>('pick');
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [practicesFailed, setPracticesFailed] = useState(false);
  const [notifyReach, setNotifyReach] = useState<boolean | null>(null); // U5: дойдёт ли напоминание; null — ещё не знаем

  useEffect(() => {
    // Сбой ≠ пусто (правило CLAUDE.md): без флага свои практики молча
    // пропадали из выбора — виден был только готовый список, как будто
    // своих нет.
    api
      .getPractices(needId)
      .then((p) => {
        setUserPractices(p);
        setPracticesFailed(false);
      })
      .catch(() => setPracticesFailed(true));
    // Часовой пояс — деградация подсказки времени до дефолта, лог достаточен.
    api
      .getSettings()
      .then((s) => {
        setTzOffset(ianaToUtcOffset(s.notifyTimezone));
        setNotifyReach(notifyReachable(s));
      })
      .catch((e) => console.error('getSettings failed', e));
  }, [needId]);

  const curated = CURATED[needId] ?? [];
  const allOptions: PlanSheetOption[] = [
    ...userPractices.map((p) => ({ text: p.text, isUser: true, id: p.id })),
    ...curated
      .filter((t) => !userPractices.some((p) => p.text === t))
      .map((t) => ({
        text: t,
        isUser: false,
        id: undefined as number | undefined,
      })),
  ];

  function selectText(text: string) {
    setSelectedText(text);
    setCustomText('');
    setPhase('confirm');
  }

  function handleCustomSubmit() {
    const t = customText.trim();
    if (!t) return;
    setSelectedText(t);
    setPhase('confirm');
  }

  function handleDeletePractice(id: number) {
    if (deletingIds.has(id)) return;
    setDeletingIds((prev) => new Set([...prev, id]));
    api
      .deletePractice(id)
      .then(() => setUserPractices((prev) => prev.filter((p) => p.id !== id)))
      .catch(() =>
        setDeletingIds((prev) => {
          const s = new Set(prev);
          s.delete(id);
          return s;
        }),
      );
  }

  const { localHour } = REMINDER_OPTIONS[reminderIdx];
  async function handleSave() {
    // savedOk: второй тап по календарной кнопке до закрытия — не второй план.
    if (!selectedText || saving || savedOk) return;
    setSaving(true);
    try {
      if (!userPractices.some((p) => p.text === selectedText)) {
        await api.addPractice(needId, selectedText);
      }
      // Час — по поясу человека: день и момент напоминания считает сервер.
      // Перевод в UTC здесь брал смещение «сейчас» и терял день (E11).
      await api.createPlan(needId, selectedText, localHour ?? undefined);
      setSavedOk(true);
      setTimeout(() => onSaved(), 1200);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  // Файл с устройства или ссылка с сервера — по хосту (savePracticeIcs.ts).
  function handleIcsDownload() {
    setIcsFailed(false);
    const params = { text: selectedText, needLabel, localHour, tzOffset };
    void savePracticeIcs(params, api.practiceIcsLink).catch(() =>
      setIcsFailed(true),
    );
  }

  return {
    userPractices,
    selectedText,
    customText,
    setCustomText,
    reminderIdx,
    setReminderIdx,
    saving,
    saveError,
    setSaveError,
    icsFailed,
    savedOk,
    phase,
    setPhase,
    deletingIds,
    practicesFailed,
    notifyReach,
    tzOffset, // ссылка «Google Календарь» ставит то же событие, что .ics
    allOptions,
    selectText,
    handleCustomSubmit,
    handleDeletePractice,
    handleSave,
    handleIcsDownload,
  };
}
