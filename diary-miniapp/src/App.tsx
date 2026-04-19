import { useEffect, useState, useCallback } from 'react';
import { DiaryType, SchemaDiaryEntry, ModeDiaryEntry, GratitudeDiaryEntry, UserProfile } from './types';
import { api } from './api';
import { HomeView } from './components/HomeView';
import { DiaryListView } from './components/DiaryListView';
import { SchemaEntrySheet } from './components/SchemaEntrySheet';
import { ModeEntrySheet } from './components/ModeEntrySheet';
import { GratitudeEntrySheet } from './components/GratitudeEntrySheet';

const TODAY = new Date().toISOString().split('T')[0];

const SKELETON_COLOR = 'rgba(255,255,255,0.07)';
const SKELETON_SHIMMER = 'rgba(255,255,255,0.04)';

function SkeletonBar({ w, h = 14, radius = 6 }: { w: number | string; h?: number; radius?: number }) {
  return <div style={{ width: w, height: h, borderRadius: radius, background: SKELETON_COLOR }} />;
}

function SkeletonCard({ accentOpacity = 0.06 }: { accentOpacity?: number }) {
  return (
    <div style={{
      background: SKELETON_SHIMMER, borderRadius: 18, marginBottom: 10,
      display: 'flex', alignItems: 'stretch',
      border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', height: 80,
    }}>
      <div style={{ width: 3, background: `rgba(255,255,255,${accentOpacity})`, flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '0 14px' }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: SKELETON_COLOR, flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBar w={110} h={13} />
          <SkeletonBar w={160} h={11} />
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: '20px 16px', animation: 'fade-in 200ms ease' }}>
      <div style={{ marginBottom: 26 }}>
        <SkeletonBar w={130} h={26} radius={8} />
        <div style={{ marginTop: 10 }}>
          <SkeletonBar w={200} h={13} />
        </div>
      </div>
      <SkeletonCard accentOpacity={0.12} />
      <SkeletonCard accentOpacity={0.09} />
      <SkeletonCard accentOpacity={0.07} />
    </div>
  );
}

export default function App() {
  const [activeDiary, setActiveDiary] = useState<DiaryType | null>(null);
  const [newEntry, setNewEntry] = useState<DiaryType | null>(null);

  const [schemaEntries, setSchemaEntries] = useState<SchemaDiaryEntry[]>([]);
  const [modeEntries, setModeEntries] = useState<ModeDiaryEntry[]>([]);
  const [gratitudeEntries, setGratitudeEntries] = useState<GratitudeDiaryEntry[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div style={{ minHeight: '100vh', background: '#0d0f18' }}>
      {loading ? (
        <LoadingSkeleton />
      ) : activeDiary ? (
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
          streak={profile?.streak}
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
