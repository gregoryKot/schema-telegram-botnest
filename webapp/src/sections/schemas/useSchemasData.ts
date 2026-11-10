// Данные экрана «Мои паттерны»: профиль, последний результат YSQ, прогресс теста, число карт режимов от терапевта и сохранение ручных выборов.
import { useEffect, useState } from 'react';
import { api, reportClientError } from '../../api';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY, cacheMySchemaIds, cacheMyModeIds, cacheMyPatternsFromProfile, cachedMyIds, trustedProfileLists } from '../../utils/storageKeys';
import type { YsqScore } from './schemasModel';
import { useListSave } from './useListSave';
import { useYsqProgressListener, useYsqResultVersion } from '../../../../shared/src/hooks/ysqProgressStore';

export function useSchemasData() {
  const [manualSchemaIds, setManualSchemaIds] = useState<string[]>(() => cachedMyIds(MY_SCHEMA_IDS_KEY));
  const [myModeIds, setMyModeIds] = useState<string[]>(() => cachedMyIds(MY_MODE_IDS_KEY));
  const [ysqSchemaIds, setYsqSchemaIds] = useState<string[]>([]);
  const [ysqScores, setYsqScores] = useState<Record<string, YsqScore>>({});
  const [ysqProgressAnswered, setYsqProgressAnswered] = useState<number | null>(null);
  useYsqProgressListener(setYsqProgressAnswered); // тест открыт поверх экрана — карточка «Продолжить (N из 116)» живая
  const [ysqCompletedAt, setYsqCompletedAt] = useState<string | null>(null);
  const [myMapCount, setMyMapCount] = useState(0);
  const [loading, setLoading] = useState(true);
  // Отказ записи виден человеку (SelectionSaveNote у блока схем или режимов), не только телеметрии; у
  // каждого списка свой трекер — успех одного не стирает сбой другого, «Повторить» шлёт свой же список.
  const schemasSave = useListSave(ids => api.updateSettings({ mySchemaIds: ids }), 'schemas save mySchemaIds failed');
  const modesSave = useListSave(ids => api.updateSettings({ myModeIds: ids }), 'schemas save myModeIds failed');
  const ysqVersion = useYsqResultVersion(); // тест сдан поверх экрана — перечитать профиль без F5 (QA 2026-11)

  useEffect(() => {
    Promise.all([
      api.getProfile(),
      api.getYsqHistory(),
      // Прогресс теста — необязательная подпись карточки: без него экран работает, сбой — в отчётах.
      api.getYsqProgress().catch(() => {
        reportClientError({ message: 'schemas ysq progress load failed', section: 'schemas' });
        return null;
      }),
    ]).then(([p, history, progress]) => {
      setYsqProgressAnswered(
        Array.isArray(progress?.answers) ? progress.answers.filter(a => a > 0).length : null,
      );
      // Пустой список с сервера — тоже правда (#939); нечитаемый на сервере
      // список (unreadableLists) — нет: экран и кэш остаются с локальным выбором.
      const server = p ? trustedProfileLists(p) : {};
      if (server.mySchemaIds) setManualSchemaIds(server.mySchemaIds);
      if (server.myModeIds) setMyModeIds(server.myModeIds);
      if (p) cacheMyPatternsFromProfile(p);
      setYsqSchemaIds(Array.isArray(p?.ysq?.activeSchemaIds) ? p.ysq.activeSchemaIds : []);
      setYsqCompletedAt(p?.ysq?.completedAt ?? null);
      // Баллы — из последнего прохождения YSQ.
      if (Array.isArray(history) && history.length > 0 && Array.isArray(history[0].scores)) {
        const map: Record<string, YsqScore> = {};
        for (const s of history[0].scores) map[s.id] = { pct5plus: Math.round(s.pct5plus), avg: s.avg ?? 0 };
        setYsqScores(map);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
    api.listMyModeMaps().then(list => setMyMapCount(list.length))
      .catch(() => reportClientError({ message: 'schemas mode-map count load failed', section: 'schemas' }));
  }, [ysqVersion]);

  function saveSchemas(ids: string[]) {
    cacheMySchemaIds(ids);
    setManualSchemaIds(ids);
    schemasSave.run(ids);
  }

  function saveModes(ids: string[]) {
    cacheMyModeIds(ids);
    setMyModeIds(ids);
    modesSave.run(ids);
  }

  return {
    loading, manualSchemaIds, myModeIds, ysqSchemaIds, ysqScores,
    ysqProgressAnswered, ysqCompletedAt, myMapCount, saveSchemas, saveModes,
    /** Запись списка схем / режимов: failed, blocked (409 — повтор не поможет), retry — тот же список. */
    schemasSave, modesSave,
  };
}
