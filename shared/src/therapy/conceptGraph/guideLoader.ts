// Тексты подсказок терапевту (#995) — отдельный чанк сборки: ~180 КБ текста
// справочника, которые нужны только терапевту на виде «Схема». Статический
// импорт клал их в чанк кабинета (TherapistClientSheet), и он стал самым
// тяжёлым в бандле (check-bundle-size-ratchet). Отсюда — только `import type`
// и динамический import(); статический импорт guide/index вернул бы тексты
// в кабинет.
import { useEffect, useState } from 'react';
import type * as GuideModule from '../../schemaTherapy/guide';

export type Guide = typeof GuideModule;

let loaded: Guide | null = null;
let pending: Promise<Guide> | null = null;

/** Грузит тексты один раз на страницу; не доехали (сеть, деплой) — следующий вызов пробует снова. */
export function loadGuide(): Promise<Guide> {
  pending ??= import('../../schemaTherapy/guide').then(
    (m) => (loaded = m),
    (e: unknown) => {
      pending = null;
      throw e;
    },
  );
  return pending;
}

/**
 * Модуль подсказок для компонента: undefined — ещё грузится, null — не
 * загрузился (плашка остаётся строкой группы, листов нет). Уже загруженный
 * отдаётся с первого рендера, без мигания.
 */
export function useGuide(): Guide | null | undefined {
  const [mod, setMod] = useState<Guide | null | undefined>(
    () => loaded ?? undefined,
  );
  useEffect(() => {
    if (mod !== undefined) return;
    let alive = true;
    void loadGuide().then(
      (m) => {
        if (alive) setMod(m);
      },
      () => {
        if (alive) setMod(null);
      },
    );
    return () => {
      alive = false;
    };
  }, [mod]);
  return mod;
}
