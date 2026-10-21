// Записи дневника схем и режимов для экрана «Мои паттерны»: нужны и для
// статуса строки («карточка заполнена · 3 записи»), и для списка записей
// внутри PatternSheet — один запрос на оба места. Провал загрузки не
// выдумывает пустоту молча: уходит в отчёт, а статус строки не показывается.
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { api, reportClientError } from '../../api';
import type { SchemaDiaryEntry, ModeDiaryEntry } from '../../types';

export interface PatternEntries {
  schemaEntries: SchemaDiaryEntry[];
  setSchemaEntries: Dispatch<SetStateAction<SchemaDiaryEntry[]>>;
  modeEntries: ModeDiaryEntry[];
  setModeEntries: Dispatch<SetStateAction<ModeDiaryEntry[]>>;
}

export function usePatternEntries() {
  const [schemaEntries, setSchemaEntries] = useState<SchemaDiaryEntry[]>([]);
  const [modeEntries, setModeEntries] = useState<ModeDiaryEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([api.getSchemaDiary(), api.getModeDiary()])
      .then(([s, m]) => {
        if (!alive) return;
        setSchemaEntries(s);
        setModeEntries(m);
        setReady(true);
      })
      .catch(() => reportClientError({ message: 'schemas pattern diary load failed', section: 'schemas' }));
    return () => { alive = false; };
  }, []);

  return { schemaEntries, setSchemaEntries, modeEntries, setModeEntries, ready };
}
