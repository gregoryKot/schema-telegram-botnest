import { useEffect, useState } from 'react';
import { api } from '../../api';
import { MY_SCHEMA_IDS_KEY, MY_MODE_IDS_KEY } from '../../utils/storageKeys';
import { readLocalIds } from './utils';

// «Мои схемы»/«мои режимы» — ручной выбор пользователя (SchemaPickerSheet/
// ModePickerSheet), не тест YSQ. Локально (localStorage + state) пишется
// сразу, оптимистично; api.updateSettings — фоновая синхронизация. Раньше
// её сбой глушился `.catch(() => {})`: пользователь видел, что выбор
// применился (лист закрылся), а при следующем visite профиль подтягивался
// с сервера и молча откатывал выбор к старому значению — ни ошибки, ни
// объяснения. Теперь сбой ловится флагом *SaveError, который экран может
// показать рядом с соответствующей вкладкой.
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
  const [schemaSaveError, setSchemaSaveError] = useState(false);
  const [modeSaveError, setModeSaveError] = useState(false);

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
  }, []);

  function saveSchemas(ids: string[]) {
    localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(ids));
    setManualSchemaIds(ids);
    setSchemaSaveError(false);
    api.updateSettings({ mySchemaIds: ids }).catch((e) => {
      console.error('updateSettings mySchemaIds failed', e);
      setSchemaSaveError(true);
    });
  }

  function saveModes(ids: string[]) {
    localStorage.setItem(MY_MODE_IDS_KEY, JSON.stringify(ids));
    setMyModeIds(ids);
    setModeSaveError(false);
    api.updateSettings({ myModeIds: ids }).catch((e) => {
      console.error('updateSettings myModeIds failed', e);
      setModeSaveError(true);
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
