import { useEffect, useState } from 'react';
import type { TherapyRelationInfo } from '../apiTypes';
import { diaryAccess, type DiaryAccess } from './diaryPrivacy';

// Загрузка «кто видит записи дневника» для листа записи (оба фронтенда
// передают свои api-функции). До ответа и при сбое — null: обещание не
// показывается вовсе (данные только реальные). Настройки спрашиваются, только
// когда терапевт подключён.
export function useDiaryAccess(
  loadRelation: () => Promise<TherapyRelationInfo | null>,
  loadSettings: () => Promise<{ therapistShareCards?: boolean }>,
): DiaryAccess | null {
  const [access, setAccess] = useState<DiaryAccess | null>(null);
  useEffect(() => {
    let alive = true;
    // Через Promise.resolve: синхронный сбой загрузчика — тоже «не знаем».
    Promise.resolve()
      .then(loadRelation)
      .then(async (rel) => {
        const share = rel
          ? (await loadSettings()).therapistShareCards
          : undefined;
        if (alive) setAccess(diaryAccess(rel, share));
      })
      .catch(() => {
        if (alive) setAccess(null);
      });
    return () => {
      alive = false;
    };
  }, [loadRelation, loadSettings]);
  return access;
}
