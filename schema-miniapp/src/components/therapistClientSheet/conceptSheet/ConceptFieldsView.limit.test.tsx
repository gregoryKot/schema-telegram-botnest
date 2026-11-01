// @vitest-environment jsdom
// Инцидент 2026-10-26 (docs/INCIDENTS.md), пара сайту (правило №3): у полей
// концептуализации не было предела, сервер отвечал 400 на текст длиннее
// CONCEPT_FIELD_TEXT_MAX (@MaxLength в ConceptualizationDto), а ошибка не
// говорила, какое поле виновато, — и вместе с ним не сохранялись остальные.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { ConceptFieldsView } from './ConceptFieldsView';
import type { ClientDetail } from '../types';
import { CONCEPT_FIELD_TEXT_MAX } from '../../../../../shared/src/limits/textLimits';
import { CONCEPT_FIELDS } from '../../../../../shared/src/therapy/clientSheetHelpers';

vi.mock('../../../api', () => ({
  api: {
    getTherapyTasksForClient: vi.fn(async () => []),
    getTherapistNotes: vi.fn(async () => ({ notes: [], total: 0 })),
    getConceptualization: vi.fn(),
    getTherapyClientData: vi.fn(async () => null),
    getClientSchemaNotes: vi.fn(async () => []),
    getClientModeNotes: vi.fn(async () => []),
    saveConceptualization: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../../../api';
import { useClientDetail } from '../../therapist/useClientDetail';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

afterEach(() => {
  cleanup();
});

function renderFields(localConcept: Record<string, string>) {
  const detail = {
    localConcept,
    activeSchemaIds: [],
    ysqSchemaIds: [],
    activeModeIds: [],
    patchConcept: vi.fn(),
    toggleSchemaId: vi.fn(),
    toggleModeId: vi.fn(),
  } as unknown as ClientDetail;
  render(<ConceptFieldsView detail={detail} />);
}
const field = (key: string) =>
  screen.getByPlaceholderText<HTMLTextAreaElement>(
    CONCEPT_FIELDS.find((f) => f.key === key)!.placeholder,
  );

describe('ConceptFieldsView — предел сервера виден до отправки', () => {
  it('у каждого текстового поля maxLength = предел DTO', () => {
    renderFields({});
    for (const f of CONCEPT_FIELDS)
      expect([f.key, field(f.key).maxLength]).toEqual([
        f.key,
        CONCEPT_FIELD_TEXT_MAX,
      ]);
  });

  it('у границы — остаток, на пределе — «Достигнут предел»', () => {
    renderFields({
      goals: 'ц'.repeat(CONCEPT_FIELD_TEXT_MAX - 100),
      triggers: 'т'.repeat(CONCEPT_FIELD_TEXT_MAX),
    });
    expect(screen.getByText(/Осталось знаков: 100/)).toBeTruthy();
    expect(screen.getByText(/Достигнут предел/)).toBeTruthy();
  });
});

describe('ошибка сохранения называет поле длиннее предела', () => {
  it('поле, сохранённое до появления предела, — в тексте ошибки, а не «ошибка сервера»', async () => {
    mockApi.getConceptualization.mockResolvedValue({
      id: 1,
      schemaIds: [],
      modeIds: [],
      goals: 'ц'.repeat(CONCEPT_FIELD_TEXT_MAX + 1),
    });
    mockApi.saveConceptualization.mockRejectedValue(new Error('API 400'));
    const { result } = renderHook(() =>
      useClientDetail({ switchView: vi.fn(), setClients: vi.fn() }),
    );
    await act(async () => {
      await result.current.openClient({
        telegramId: 1,
        name: 'Алиса',
      } as never);
    });
    act(() => result.current.patchConcept({ earlyExperience: 'детство' }));
    await act(async () => {
      await result.current.saveConcept();
    });
    expect(result.current.conceptError).toMatch(
      /В поле «Цели схема-терапии» больше/,
    );
  });
});
