// Состояние листа «Запланировать практику» (PlanSheet) — общее для обоих
// фронтендов (правило №3). Было продублировано 1-в-1 при добавлении .ics
// (правило №16): весь стейт, загрузка практик/таймзоны, выбор напоминания,
// сохранение и генерация .ics совпадали построчно — вёрстка (ExScreen
// webapp / BottomSheet+PracticeOptionRow miniapp) остаётся своя.
import { useEffect, useState } from 'react';
import { CURATED } from './curated';
import { practiceIcsDataUrl } from '../utils/ics';
import { getHost } from '../host';

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

export interface PlanSheetApi {
  getPractices: (needId: string) => Promise<UserPracticeLike[]>;
  getSettings: () => Promise<{ notifyTimezone: string }>;
  addPractice: (needId: string, text: string) => Promise<unknown>;
  deletePractice: (id: number) => Promise<unknown>;
  createPlan: (
    needId: string,
    text: string,
    reminderUtcHour?: number,
  ) => Promise<unknown>;
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
  const [savedOk, setSavedOk] = useState(false);
  const [phase, setPhase] = useState<'pick' | 'confirm'>('pick');
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [practicesFailed, setPracticesFailed] = useState(false);

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
      .then((s) => setTzOffset(ianaToUtcOffset(s.notifyTimezone)))
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

  async function handleSave() {
    if (!selectedText || saving) return;
    setSaving(true);
    try {
      const opt = REMINDER_OPTIONS[reminderIdx];
      let reminderUtcHour: number | undefined;
      if (opt.localHour !== null) {
        reminderUtcHour = (((opt.localHour - tzOffset) % 24) + 24) % 24;
      }
      if (!userPractices.some((p) => p.text === selectedText)) {
        await api.addPractice(needId, selectedText);
      }
      await api.createPlan(needId, selectedText, reminderUtcHour);
      setSavedOk(true);
      setTimeout(() => onSaved(), 1200);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  // Паритет с обеих сторон (правило №16) — генерация вынесена в shared/ics.ts
  // (чистая функция); сохранение файла остаётся платформенным
  // (getHost().saveFile — web-адаптер webapp, свой у miniapp).
  function handleIcsDownload() {
    const opt = REMINDER_OPTIONS[reminderIdx];
    const dataUrl = practiceIcsDataUrl({
      text: selectedText,
      needLabel,
      localHour: opt.localHour,
      tzOffset,
    });
    getHost().saveFile(dataUrl, 'practice.ics');
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
    savedOk,
    phase,
    setPhase,
    deletingIds,
    practicesFailed,
    allOptions,
    selectText,
    handleCustomSubmit,
    handleDeletePractice,
    handleSave,
    handleIcsDownload,
  };
}
