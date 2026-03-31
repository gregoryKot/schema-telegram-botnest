import { useEffect, useState, useCallback } from 'react';
import { DiaryType, SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry, UserProfile } from './types';
import { api } from './api';
import { HomeView } from './components/HomeView';
import { DiaryListView } from './components/DiaryListView';
import { SchemaEntrySheet } from './components/SchemaEntrySheet';
import { ModeEntrySheet } from './components/ModeEntrySheet';
import { GratitudeEntrySheet } from './components/GratitudeEntrySheet';

const TODAY = new Date().toISOString().split('T')[0];

export default function App() {
  const [activeDiary, setActiveDiary] = useState<DiaryType | null>(null);
  const [newEntry, setNewEntry] = useState<DiaryType | null>(null);

  const [schemaEntries, setSchemaEntries] = useState<SchemaDiaryEntry[]>([]);
  const [modeEntries, setModeEntries] = useState<ModeDiaryEntry[]>([]);
  const [gratitudeEntries, setGratitudeEntries] = useState<GratitudeDiaryEntry[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      await api.init();
      const [schema, mode, gratitude, userProfile] = await Promise.all([
        api.getSchemaDiary(),
        api.getModeDiary(),
        api.getGratitudeDiary(),
        api.getProfile().catch(() => null),
      ]);
      setSchemaEntries(schema);
      setModeEntries(mode);
      setGratitudeEntries(gratitude);
      if (userProfile) setProfile(userProfile);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
    load();
  }, [load]);

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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
        Загрузка...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117' }}>
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
        />
      )}

      {newEntry === 'schema' && (
        <SchemaEntrySheet
          activeSchemaIds={profile?.ysq.activeSchemaIds}
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
