import { useCallback, useEffect, useState } from 'react';
import {
  DiaryType,
  SchemaDiaryEntry,
  ModeDiaryEntry,
  GratitudeDiaryEntry,
} from '../types';
import { api } from '../api';
import { HomeView } from '../components/diary/HomeView';
import { DiaryListView } from '../components/diary/DiaryListView';
import { SchemaEntrySheet } from '../components/diary/SchemaEntrySheet';
import { ModeEntrySheet } from '../components/diary/ModeEntrySheet';
import { GratitudeEntrySheet } from '../components/diary/GratitudeEntrySheet';
import { useTr } from '../utils/addressForm';

const TODAY = new Date().toISOString().split('T')[0];

interface Props {
  onClose?: () => void;
  onOpenTracker?: () => void;
}

export function DiarySection({ onClose, onOpenTracker }: Props = {}) {
  const tr = useTr();
  const [activeDiary, setActiveDiary] = useState<DiaryType | null>(null);
  const [newEntry, setNewEntry] = useState<DiaryType | null>(null);
  const [schemaEntries, setSchemaEntries] = useState<SchemaDiaryEntry[]>([]);
  const [modeEntries, setModeEntries] = useState<ModeDiaryEntry[]>([]);
  const [gratitudeEntries, setGratitudeEntries] = useState<
    GratitudeDiaryEntry[]
  >([]);
  const [activeSchemaIds, setActiveSchemaIds] = useState<string[] | undefined>(
    undefined,
  );
  // Серия и последняя отметка трекера — из профиля, а не из константы: на
  // чистом аккаунте чип серии просто не рисуется (правило «никаких заглушек»).
  const [streak, setStreak] = useState<number | undefined>(undefined);
  const [lastNeedsDate, setLastNeedsDate] = useState<string | undefined>(
    undefined,
  );
  // Сбой ≠ пусто: отказ ЛЮБОГО из трёх дневников раньше оставлял entries []
  // — дневник выглядел стёртым, хотя записи (терапевтические данные) целы на
  // сервере. loadFailed рисует предупреждение, но не прячет остальной UI —
  // человек может хотеть создать запись прямо сейчас.
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [schema, mode, gratitude, profile] = await Promise.all([
        api.getSchemaDiary(),
        api.getModeDiary(),
        api.getGratitudeDiary(),
        api.getProfile().catch(() => null),
      ]);
      setLoadFailed(false);
      setSchemaEntries(schema);
      setModeEntries(mode);
      setGratitudeEntries(gratitude);
      if (profile) {
        setActiveSchemaIds(profile.ysq.activeSchemaIds);
        setStreak(profile.streak);
        setLastNeedsDate(profile.lastActivity.needsTracker ?? undefined);
      }
    } catch (err) {
      console.error(err);
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (type: DiaryType, id: number) => {
    try {
      if (type === 'schema') {
        await api.deleteSchemaDiary(id);
        setSchemaEntries((prev) => prev.filter((e) => e.id !== id));
      } else if (type === 'mode') {
        await api.deleteModeDiary(id);
        setModeEntries((prev) => prev.filter((e) => e.id !== id));
      } else {
        await api.deleteGratitudeDiary(id);
        setGratitudeEntries((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const todayGratitude = gratitudeEntries.find((e) => e.date === TODAY);

  return (
    <div style={{ minHeight: '100vh' }}>
      {loadFailed && (
        // Предупреждение НЕ прячет остальной UI (записи могли не загрузиться,
        // но пользователь может хотеть создать новую прямо сейчас) — только
        // баннер сверху над списком/домашним экраном.
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-10)',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            padding: '10px 16px',
            background: 'rgba(248,113,113,0.1)',
            borderBottom: '1px solid rgba(248,113,113,0.25)',
            fontSize: 13,
            color: 'var(--accent-red)',
            lineHeight: 1.5,
          }}
        >
          <span>
            {tr(
              'Не удалось загрузить записи дневника. Проверь соединение — записи на месте, просто не загрузились',
              'Не удалось загрузить записи дневника. Проверьте соединение — записи на месте, просто не загрузились',
            )}
          </span>
          <button
            onClick={() => void load()}
            style={{
              flexShrink: 0,
              padding: '6px 14px',
              borderRadius: 'var(--r-10)',
              border: 'none',
              fontFamily: 'inherit',
              background: 'rgba(248,113,113,0.15)',
              color: 'var(--accent-red)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Обновить
          </button>
        </div>
      )}
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
          streak={streak}
          lastNeedsDate={lastNeedsDate}
          onOpen={(type) => setActiveDiary(type)}
          onOpenTracker={onOpenTracker}
          onClose={onClose}
        />
      )}

      {newEntry === 'schema' && (
        <SchemaEntrySheet
          activeSchemaIds={activeSchemaIds}
          onClose={() => setNewEntry(null)}
          onSave={async (data) => {
            const entry = await api.createSchemaDiary(data);
            setSchemaEntries((prev) => [entry, ...prev]);
          }}
        />
      )}

      {newEntry === 'mode' && (
        <ModeEntrySheet
          onClose={() => setNewEntry(null)}
          onSave={async (data) => {
            const entry = await api.createModeDiary(data);
            setModeEntries((prev) => [entry, ...prev]);
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
            setGratitudeEntries((prev) => {
              const filtered = prev.filter((e) => e.date !== date);
              return [entry, ...filtered].sort((a, b) =>
                b.date.localeCompare(a.date),
              );
            });
          }}
        />
      )}
    </div>
  );
}
