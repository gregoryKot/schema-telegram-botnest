import { useState, useEffect } from 'react';
import { api } from '../../api';
import { CaseFlowSheet } from './CaseFlowSheet';

/**
 * Разбор случая. Счётчик прошлых разборов нужен потоку, чтобы показать
 * определение режима ровно один раз — на повторных разборах абзац-объяснение
 * читается как «приложение меня не помнит».
 *
 * Сам разбор сохраняется обычной записью дневника режимов: отдельного
 * хранилища у него нет, и карта строится из тех же записей. Карточка режима
 * заводится только по вердикту «похоже на часть» — обычная досада не должна
 * оставлять след на карте.
 */
export function CaseFlowOverlay({
  sheets,
}: {
  sheets: {
    close: (k: 'caseFlow') => void;
    open: (k: 'selfMap' | 'trackerOverlay') => void;
  };
}) {
  const [caseCount, setCaseCount] = useState(0);
  const close = () => sheets.close('caseFlow');

  useEffect(() => {
    let ignore = false;
    api
      .getModeDiary()
      .then((rows) => {
        if (!ignore) setCaseCount(rows.length);
      })
      .catch((e) => console.error('case count load failed', e));
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <CaseFlowSheet
      caseCount={caseCount}
      onSave={async (data) => {
        await api.createModeDiary(data);
      }}
      onSaveCard={async (body) => {
        await api.saveModeNote(body);
      }}
      onSteadyDay={() => {
        close();
        sheets.open('trackerOverlay');
      }}
      onOpenMap={() => {
        close();
        sheets.open('selfMap');
      }}
      onClose={close}
      onDoubt={() => {}}
      onHardNow={close}
    />
  );
}
