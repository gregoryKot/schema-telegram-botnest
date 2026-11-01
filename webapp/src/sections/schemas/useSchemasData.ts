// Данные экрана «Мои паттерны»: профиль, последний результат YSQ, прогресс теста, число карт режимов от терапевта и сохранение ручных выборов.
import { useEffect, useState } from 'react';
import { api, reportClientError } from '../../api';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../../utils/storageKeys';
import { readLocalIds, type YsqScore } from './schemasModel';
import { useSaveFailure } from '../../hooks/useSaveFailure';
import { isUnwritableError } from '../../../../shared/src/api/unwritableError';

export function useSchemasData() {
  const [manualSchemaIds, setManualSchemaIds] = useState<string[]>(() => readLocalIds(localStorage.getItem(MY_SCHEMA_IDS_KEY)));
  const [myModeIds, setMyModeIds] = useState<string[]>(() => readLocalIds(localStorage.getItem(MY_MODE_IDS_KEY)));
  const [ysqSchemaIds, setYsqSchemaIds] = useState<string[]>([]);
  const [ysqScores, setYsqScores] = useState<Record<string, YsqScore>>({});
  const [ysqProgressAnswered, setYsqProgressAnswered] = useState<number | null>(null);
  const [ysqCompletedAt, setYsqCompletedAt] = useState<string | null>(null);
  const [myMapCount, setMyMapCount] = useState(0);
  const [loading, setLoading] = useState(true);
  // Отказ записи виден человеку (SaveErrorNote в SchemasSection), не только телеметрии.
  const save = useSaveFailure();

  useEffect(() => {
    Promise.all([
      api.getProfile(),
      api.getYsqHistory(),
      // Прогресс незаконченного теста — необязательная подпись на карточке:
      // без него экран работает, но сбой виден в отчётах.
      api.getYsqProgress().catch(() => {
        reportClientError({ message: 'schemas ysq progress load failed', section: 'schemas' });
        return null;
      }),
    ]).then(([p, history, progress]) => {
      setYsqProgressAnswered(
        Array.isArray(progress?.answers) ? progress.answers.filter(a => a > 0).length : null,
      );
      const serverSchemas = Array.isArray(p?.mySchemaIds) ? p.mySchemaIds : [];
      const serverModes = Array.isArray(p?.myModeIds) ? p.myModeIds : [];
      setManualSchemaIds(serverSchemas);
      if (serverSchemas.length > 0) localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(serverSchemas));
      setMyModeIds(serverModes);
      if (serverModes.length > 0) localStorage.setItem(MY_MODE_IDS_KEY, JSON.stringify(serverModes));
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
  }, []);

  function saveSchemas(ids: string[]) {
    localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(ids));
    setManualSchemaIds(ids);
    save.track(api.updateSettings({ mySchemaIds: ids }), () => reportClientError({ message: 'schemas save mySchemaIds failed', section: 'schemas' }));
  }

  function saveModes(ids: string[]) {
    localStorage.setItem(MY_MODE_IDS_KEY, JSON.stringify(ids));
    setMyModeIds(ids);
    save.track(api.updateSettings({ myModeIds: ids }), () => reportClientError({ message: 'schemas save myModeIds failed', section: 'schemas' }));
  }

  return {
    loading, manualSchemaIds, myModeIds, ysqSchemaIds, ysqScores,
    ysqProgressAnswered, ysqCompletedAt, myMapCount, saveSchemas, saveModes, saveFailed: save.failed,
    saveBlocked: save.failed && isUnwritableError(save.error), // 409: прежний список не читается — повтор не поможет
  };
}
