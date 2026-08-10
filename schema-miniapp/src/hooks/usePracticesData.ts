import { useEffect, useState } from 'react';
import { api, UserPractice } from '../api';

// Данные и мутации экрана «Мои практики» — вынесено из PracticesScreen.tsx
// (правило №10, файл был над потолком в 300 строк). UI/вёрстка остаются в
// компоненте, здесь только загрузка/сохранение/удаление.
export function usePracticesData(needId: string) {
  const [practices, setPractices] = useState<UserPractice[] | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [addedToast, setAddedToast] = useState(false);
  const [errorToast, setErrorToast] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .ratings()
      .then(setRatings)
      .catch((e) => console.error('ratings failed', e));
  }, []);

  useEffect(() => {
    setPractices(null);
    api
      .getPractices(needId)
      .then(setPractices)
      .catch(() => setPractices([]));
  }, [needId]);

  function flashToast(setFlag: (v: boolean) => void, ms: number) {
    setFlag(true);
    setTimeout(() => setFlag(false), ms);
  }

  async function addPractice(text: string): Promise<boolean> {
    if (!text.trim() || saving) return false;
    setSaving(true);
    try {
      await api.addPractice(needId, text);
      flashToast(setAddedToast, 2000);
      api
        .getPractices(needId)
        .then(setPractices)
        .catch((e) => console.error('getPractices refresh failed', e));
      return true;
    } catch {
      flashToast(setErrorToast, 2500);
      return false;
    } finally {
      setSaving(false);
    }
  }

  // Оптимистичное удаление, откат при провале — иначе практика молча
  // пропадала из UI навсегда, хотя на сервере осталась.
  function deletePractice(id: number) {
    const removed = practices?.find((x) => x.id === id);
    setPractices((prev) => prev?.filter((x) => x.id !== id) ?? null);
    api.deletePractice(id).catch((e) => {
      console.error('deletePractice failed', e);
      if (removed) setPractices((prev) => [...(prev ?? []), removed]);
      flashToast(setErrorToast, 2500);
    });
  }

  return {
    practices,
    ratings,
    addedToast,
    errorToast,
    saving,
    addPractice,
    deletePractice,
  };
}
