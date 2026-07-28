import { useState } from 'react';
import type { EmotionEntry } from '../types';
import {
  SCHEMA_DIARY_FIELD_KEYS,
  type SchemaDiaryFieldKey,
} from './schemaDiarySteps';

export interface SchemaDiaryDraftData extends Record<
  SchemaDiaryFieldKey,
  string
> {
  emotions: EmotionEntry[];
  schemaIds: string[];
}

interface HapticLike {
  select: () => void;
}

/**
 * Состояние формы дневника схем (текстовые поля + эмоции + схемы) и
 * переключатели чипов — было продублировано дословно между miniapp/webapp
 * SchemaEntrySheet при переводе на визард (правило №3/№11 CLAUDE.md).
 * Черновик передаётся снаружи (у каждого фронта свой loadDraft-вызов),
 * хук только держит state и переключатели.
 */
export function useSchemaDiaryDraftState(
  draft: SchemaDiaryDraftData | null | undefined,
  haptic: HapticLike,
) {
  const [values, setValues] = useState<Record<SchemaDiaryFieldKey, string>>(
    () =>
      Object.fromEntries(
        SCHEMA_DIARY_FIELD_KEYS.map((k) => [k, draft?.[k] ?? '']),
      ) as Record<SchemaDiaryFieldKey, string>,
  );
  const [emotions, setEmotions] = useState<EmotionEntry[]>(
    draft?.emotions ?? [],
  );
  const [schemaIds, setSchemaIds] = useState<string[]>(draft?.schemaIds ?? []);

  const setField = (k: SchemaDiaryFieldKey, v: string) =>
    setValues((p) => ({ ...p, [k]: v }));

  const toggleEmotion = (id: string) => {
    haptic.select();
    setEmotions((prev) =>
      prev.find((e) => e.id === id)
        ? prev.filter((e) => e.id !== id)
        : [...prev, { id, intensity: 3 }],
    );
  };

  const setIntensity = (id: string, intensity: number) => {
    haptic.select();
    setEmotions((prev) =>
      prev.map((e) => (e.id === id ? { ...e, intensity } : e)),
    );
  };

  const toggleSchema = (id: string) => {
    haptic.select();
    setSchemaIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  return {
    values,
    setField,
    emotions,
    toggleEmotion,
    setIntensity,
    schemaIds,
    toggleSchema,
  };
}
