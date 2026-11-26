// Записи дневников схем и режимов для «Мои паттерны»: статус строки и список в PatternSheet — один запрос.
// Провал — отчёт, статус строки не показывается. Есть source (профиль: useAboutMe) — своего запроса нет.
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { api, reportClientError } from '../../api';
import type { SchemaDiaryEntry, ModeDiaryEntry } from '../../types';

export interface PatternEntries {
  schemaEntries: SchemaDiaryEntry[];
  setSchemaEntries: Dispatch<SetStateAction<SchemaDiaryEntry[]>>;
  modeEntries: ModeDiaryEntry[];
  setModeEntries: Dispatch<SetStateAction<ModeDiaryEntry[]>>;
}
export type PatternEntriesSource = PatternEntries & { ready: boolean };

export function usePatternEntries(source?: PatternEntriesSource): PatternEntriesSource {
  const [schemaEntries, setSchemaEntries] = useState<SchemaDiaryEntry[]>([]);
  const [modeEntries, setModeEntries] = useState<ModeDiaryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const external = !!source;
  useEffect(() => {
    if (external) return;
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
  }, [external]);

  return source ?? { schemaEntries, setSchemaEntries, modeEntries, setModeEntries, ready };
}
