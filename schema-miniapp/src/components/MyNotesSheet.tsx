import { useState, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import { SkeletonList } from './Skeleton';
import { api } from '../api';
import { getModeById } from '../schemaTherapyData';
import { SchemaIntroSheet } from './SchemaIntroSheet';
import { ModeIntroSheet } from './ModeIntroSheet';
import {
  EmptyState,
  SchemaNote,
  ModeNote,
  DiaryEntry,
  Exercise,
  SafeEntry,
} from './myNotes/shared';
import { MyNotesSchemaCards } from './myNotes/MyNotesSchemaCards';
import { MyNotesModeCards } from './myNotes/MyNotesModeCards';
import { MyNotesDiaryTab } from './myNotes/MyNotesDiaryTab';
import { MyNotesExercisesTab } from './myNotes/MyNotesExercisesTab';

// ─── Tabs ────────────────────────────────────────────────────────────────────

type Tab = 'cards' | 'diary' | 'exercises';

interface Props {
  onClose: () => void;
}

export function MyNotesSheet({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('cards');
  const [loading, setLoading] = useState(true);

  // Profile
  const [mySchemaIds, setMySchemaIds] = useState<string[]>([]);
  const [ysqSchemaIds, setYsqSchemaIds] = useState<string[]>([]);
  const [myModeIds, setMyModeIds] = useState<string[]>([]);

  // Cards
  const [schemaNotes, setSchemaNotes] = useState<SchemaNote[]>([]);
  const [modeNotes, setModeNotes] = useState<ModeNote[]>([]);
  const [openSchemaId, setOpenSchemaId] = useState<string | null>(null);
  const [openModeId, setOpenModeId] = useState<string | null>(null);

  // Diary
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);

  // Exercises
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [safePlace, setSafePlace] = useState<SafeEntry>(null);

  useEffect(() => {
    void Promise.all([
      api
        .getProfile()
        .then((p) => {
          setMySchemaIds(p.mySchemaIds ?? []);
          setYsqSchemaIds(p.ysq.activeSchemaIds ?? []);
          setMyModeIds(p.myModeIds ?? []);
        })
        .catch(() => {}),
      api
        .getSchemaNotes()
        .then(setSchemaNotes)
        .catch(() => {}),
      api
        .getModeNotes()
        .then(setModeNotes)
        .catch(() => {}),
      // Diary
      Promise.all([
        api.getSchemaDiary().catch(() => []),
        api.getModeDiary().catch(() => []),
        api.getGratitudeDiary().catch(() => []),
      ]).then(([sd, md, gd]) => {
        const entries: DiaryEntry[] = [
          ...sd.map((e) => ({
            id: e.id,
            createdAt: e.createdAt,
            type: 'schema' as const,
            label: 'Схемный дневник',
            preview: e.trigger ?? '',
          })),
          ...md.map((e) => ({
            id: e.id,
            createdAt: e.createdAt,
            type: 'mode' as const,
            label: `Режим: ${getModeById(e.modeId)?.name ?? e.modeId}`,
            preview: e.situation ?? '',
          })),
          ...gd.map((e) => ({
            id: e.id,
            createdAt: e.createdAt,
            type: 'gratitude' as const,
            label: 'Благодарность',
            preview: Array.isArray(e.items)
              ? e.items.slice(0, 2).join(', ')
              : '',
          })),
        ]
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .slice(0, 30);
        setDiaryEntries(entries);
      }),
      // Exercises
      Promise.all([
        api.getBeliefChecks().catch(() => []),
        api.getLetters().catch(() => []),
        api.getFlashcards().catch(() => []),
        api.getSafePlace().catch(() => null),
      ]).then(([bc, lt, fc, sp]) => {
        setSafePlace(sp);
        const exs: Exercise[] = [
          ...bc.map((e) => ({
            id: e.id,
            createdAt: e.createdAt,
            type: 'belief' as const,
            label: 'Проверка убеждения',
            preview: e.belief ?? '',
          })),
          ...lt.map((e) => ({
            id: e.id,
            createdAt: e.createdAt,
            type: 'letter' as const,
            label: 'Письмо себе',
            preview: e.text?.slice(0, 70) ?? '',
          })),
          ...fc.map((e) => ({
            id: e.id,
            createdAt: e.createdAt,
            type: 'flashcard' as const,
            label: `Кризис: ${e.modeId}`,
            preview: e.action ?? e.reflection ?? '',
          })),
        ]
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .slice(0, 30);
        setExercises(exs);
      }),
    ]).finally(() => setLoading(false));
  }, []);

  // Все уникальные ID схем и режимов
  const allSchemaIds = [...new Set([...mySchemaIds, ...ysqSchemaIds])];
  const allModeIds = myModeIds;

  const schemaCount = allSchemaIds.length;
  const modeCount = allModeIds.length;
  const cardCount = schemaCount + modeCount;

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'cards', label: 'Мои карточки', count: cardCount },
    { id: 'diary', label: 'Дневник', count: diaryEntries.length },
    {
      id: 'exercises',
      label: 'Упражнения',
      count: exercises.length + (safePlace ? 1 : 0),
    },
  ];

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 16,
          }}
        >
          Мои записи
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: '7px 4px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                background:
                  tab === t.id
                    ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
                    : 'rgba(var(--fg-rgb),0.04)',
                color: tab === t.id ? 'var(--accent)' : 'var(--text-sub)',
                fontSize: 12,
                fontWeight: tab === t.id ? 600 : 400,
              }}
            >
              {t.label}
              {t.count > 0 ? ` · ${t.count}` : ''}
            </button>
          ))}
        </div>

        {loading ? (
          <SkeletonList rows={4} h={72} />
        ) : (
          <>
            {tab === 'cards' &&
              (allSchemaIds.length === 0 && allModeIds.length === 0 ? (
                <EmptyState
                  emoji="🧩"
                  text="Схемы и режимы не выбраны"
                  sub="Добавь их в разделе Паттерны"
                />
              ) : (
                <>
                  <MyNotesSchemaCards
                    allSchemaIds={allSchemaIds}
                    schemaNotes={schemaNotes}
                    onOpenSchema={setOpenSchemaId}
                  />
                  <MyNotesModeCards
                    allModeIds={allModeIds}
                    modeNotes={modeNotes}
                    onOpenMode={setOpenModeId}
                  />
                </>
              ))}

            {tab === 'diary' && <MyNotesDiaryTab diaryEntries={diaryEntries} />}

            {tab === 'exercises' && (
              <MyNotesExercisesTab
                exercises={exercises}
                safePlace={safePlace}
              />
            )}
          </>
        )}
      </div>

      {openSchemaId && (
        <SchemaIntroSheet
          schemaId={openSchemaId}
          onClose={() => setOpenSchemaId(null)}
          onComplete={() => {
            api
              .getSchemaNotes()
              .then(setSchemaNotes)
              .catch(() => {});
          }}
        />
      )}
      {openModeId && (
        <ModeIntroSheet
          modeId={openModeId}
          onClose={() => setOpenModeId(null)}
          onComplete={() => {
            api
              .getModeNotes()
              .then(setModeNotes)
              .catch(() => {});
          }}
        />
      )}
    </BottomSheet>
  );
}
