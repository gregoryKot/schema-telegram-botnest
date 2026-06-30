import { useCallback, useEffect, useState } from 'react';
import { DiaryType, SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry } from '../types';
import { api } from '../api';
import { HomeView } from '../components/diary/HomeView';
import { DiaryListView } from '../components/diary/DiaryListView';
import { SchemaEntrySheet } from '../components/diary/SchemaEntrySheet';
import { ModeEntrySheet } from '../components/diary/ModeEntrySheet';
import { GratitudeEntrySheet } from '../components/diary/GratitudeEntrySheet';

const TODAY = new Date().toISOString().split('T')[0];

interface Props { onClose?: () => void; }

export function DiarySection({ onClose }: Props = {}) {
  const [activeDiary, setActiveDiary] = useState<DiaryType | null>(null);
  const [newEntry, setNewEntry] = useState<DiaryType | null>(null);
  const [schemaEntries, setSchemaEntries] = useState<SchemaDiaryEntry[]>([]);
  const [modeEntries, setModeEntries] = useState<ModeDiaryEntry[]>([]);
  const [gratitudeEntries, setGratitudeEntries] = useState<GratitudeDiaryEntry[]>([]);
  const [activeSchemaIds, setActiveSchemaIds] = useState<string[] | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const [schema, mode, gratitude, profile] = await Promise.all([
        api.getSchemaDiary(),
        api.getModeDiary(),
        api.getGratitudeDiary(),
        api.getProfile().catch(() => null),
      ]);
      setSchemaEntries(schema);
      setModeEntries(mode);
      setGratitudeEntries(gratitude);
      if (profile) setActiveSchemaIds(profile.ysq.activeSchemaIds);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (type: DiaryType, id: number) => {
    try {
      if (type === 'schema') {
        await api.deleteSchemaDiary(id);
        setSchemaEntries(prev => prev.filter(e => e.id !== id));
      } else if (type === 'mode') {
        await api.deleteModeDiary(id);
        setModeEntries(prev => prev.filter(e => e.id !== id));
      } else {
        await api.deleteGratitudeDiary(id);
        setGratitudeEntries(prev => prev.filter(e => e.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const todayGratitude = gratitudeEntries.find(e => e.date === TODAY);

  return (
    <div style={{ minHeight: '100vh' }}>
      {activeDiary ? (
        <DiaryListView
          type={activeDiary}
          schemaEntries={schemaEntries}
          modeEntries={modeEntries}
          gratitudeEntries={gratitudeEntries}
          onBack={() => setActiveDiary(null)}
          onNewEntry={() => setNewEntry(activeDiary)}
          onDelete={handleDelete}
        />
      ) : (
        <HomeView
          schemaDiaryCount={schemaEntries.length}
          modeDiaryCount={modeEntries.length}
          gratitudeDiaryCount={gratitudeEntries.length}
          lastSchemaDiaryDate={schemaEntries[0]?.createdAt}
          lastModeDiaryDate={modeEntries[0]?.createdAt}
          lastGratitudeDiaryDate={gratitudeEntries[0]?.date}
          onOpen={type => setActiveDiary(type)}
          onClose={onClose}
        />
      )}

      {newEntry === 'schema' && (
        <SchemaEntrySheet
          activeSchemaIds={activeSchemaIds}
          onClose={() => setNewEntry(null)}
          onSave={async (data) => {
            const entry = await api.createSchemaDiary(data);
            setSchemaEntries(prev => [entry, ...prev]);
          }}
        />
      )}

      {newEntry === 'mode' && (
        <ModeEntrySheet
          onClose={() => setNewEntry(null)}
          onSave={async (data) => {
            const entry = await api.createModeDiary(data);
            setModeEntries(prev => [entry, ...prev]);
          }}
        />
      )}

      {newEntry === 'gratitude' && (
        <GratitudeEntrySheet
          onClose={() => setNewEntry(null)}
          date={TODAY}
          existingItems={todayGratitude?.items}
          onSave={async (date, items) => {
            const entry = await api.createGratitudeDiary(date, items);
            setGratitudeEntries(prev => {
              const filtered = prev.filter(e => e.date !== date);
              return [entry, ...filtered].sort((a, b) => b.date.localeCompare(a.date));
            });
          }}
        />
      )}
    </div>
  );
}
