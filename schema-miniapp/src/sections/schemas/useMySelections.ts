import { useEffect, useState } from 'react';
import { api } from '../../api';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../../utils/storageKeys';
import { readLocalIds } from './utils';
import { isUnwritableError } from '../../../../shared/src/api/unwritableError';
import { useYsqResultVersion } from '../../../../shared/src/hooks/ysqProgressStore';

// «Мои схемы»/«мои режимы» — ручной выбор (Schema/ModePickerSheet) плюс
// схемы по тесту YSQ из профиля. Выбор пишется сразу в localStorage + state,
// api.updateSettings — фоном; сбой — флаг *SaveError вкладки, 'blocked' — 409
// unreadable_data (прежний список не читается, сервер не дал его стереть).
export type SaveErr = null | 'failed' | 'blocked';
export function useMySelections() {
  const [manualSchemaIds, setManualSchemaIds] = useState<string[]>(() =>
    readLocalIds(MY_SCHEMA_IDS_KEY),
  );
  const [myModeIds, setMyModeIds] = useState<string[]>(() =>
    readLocalIds(MY_MODE_IDS_KEY),
  );
  const [ysqSchemaIds, setYsqSchemaIds] = useState<string[]>([]);
  const [ysqCompletedAt, setYsqCompletedAt] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [schemaSaveError, setSchemaSaveError] = useState<SaveErr>(null);
  const [modeSaveError, setModeSaveError] = useState<SaveErr>(null);
  const ysqVersion = useYsqResultVersion(); // тест сдан поверх экрана (B-З5)

  useEffect(() => {
    api
      .getProfile()
      .then((p) => {
        const serverSchemas = p.mySchemaIds ?? [];
        const serverModes = p.myModeIds ?? [];
        setManualSchemaIds(serverSchemas);
        if (serverSchemas.length > 0)
          localStorage.setItem(
            MY_SCHEMA_IDS_KEY,
            JSON.stringify(serverSchemas),
          );
        setMyModeIds(serverModes);
        if (serverModes.length > 0)
          localStorage.setItem(MY_MODE_IDS_KEY, JSON.stringify(serverModes));
        setYsqSchemaIds(p.ysq.activeSchemaIds ?? []);
        setYsqCompletedAt(p.ysq.completedAt);
        setProfileLoading(false);
      })
      .catch((e) => {
        console.error('getProfile failed (mySelections)', e);
        setProfileLoading(false);
      });
  }, [ysqVersion]);

  function saveSchemas(ids: string[]) {
    localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(ids));
    setManualSchemaIds(ids);
    setSchemaSaveError(null);
    api.updateSettings({ mySchemaIds: ids }).catch((e) => {
      console.error('updateSettings mySchemaIds failed', e);
      setSchemaSaveError(isUnwritableError(e) ? 'blocked' : 'failed');
    });
  }

  function saveModes(ids: string[]) {
    localStorage.setItem(MY_MODE_IDS_KEY, JSON.stringify(ids));
    setMyModeIds(ids);
    setModeSaveError(null);
    api.updateSettings({ myModeIds: ids }).catch((e) => {
      console.error('updateSettings myModeIds failed', e);
      setModeSaveError(isUnwritableError(e) ? 'blocked' : 'failed');
    });
  }

  return {
    manualSchemaIds,
    myModeIds,
    ysqSchemaIds,
    ysqCompletedAt,
    profileLoading,
    schemaSaveError,
    modeSaveError,
    saveSchemas,
    saveModes,
  };
}
