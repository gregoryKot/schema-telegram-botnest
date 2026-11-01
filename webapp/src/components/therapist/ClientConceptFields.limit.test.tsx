// @vitest-environment jsdom
// Инцидент 2026-10-26 (docs/INCIDENTS.md): у полей концептуализации не было
// предела, сервер отвечал 400 на текст длиннее 5000 знаков (@MaxLength в
// ConceptualizationDto), баннер «Не удалось сохранить изменения. Попробуй ещё
// раз» не говорил, что виновато, а вместе с длинным полем не сохранялись
// остальные. Поверх НАСТОЯЩЕГО useClientDetail (мок только сети).
import { useEffect, useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../api', () => ({
  api: {
    getTherapyTasksForClient: vi.fn(), getTherapistNotes: vi.fn(),
    getConceptualization: vi.fn(), getTherapyClientData: vi.fn(),
    getClientSchemaNotes: vi.fn(), getClientModeNotes: vi.fn(),
    getTherapyClientHistory: vi.fn(), getClientDiary: vi.fn(),
    saveConceptualization: vi.fn(), trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../../api';
import { ClientConceptTab } from './ClientConceptTab';
import { useClientDetail } from './useClientDetail';
import { CONCEPT_FIELD_TEXT_MAX } from '../../../../shared/src/limits/textLimits';
import { CONCEPT_FIELDS } from '../../../../shared/src/therapy/clientSheetHelpers';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const CLIENT = {
  telegramId: 7, name: 'Анна', clientAlias: null, streak: 0, lastActiveDate: null,
  todayIndex: null, recentIndexHistory: [], relationCreatedAt: '2026-01-01',
  therapyStartDate: null, nextSession: null, meetingDays: [], schemaIds: [],
};
const concept = (patch: Record<string, unknown> = {}) => ({
  id: 1, therapistId: 1, clientId: 7, schemaIds: [], modeIds: [],
  earlyExperience: null, unmetNeeds: null, triggers: null, copingStyles: null,
  goals: null, currentProblems: null, modeTransitions: null,
  modeLinks: [], schemaLinks: [], modeMapNodes: [], modeMapEdges: [],
  history: [], updatedAt: '2026-10-01T00:00:00.000Z', ...patch,
});

function Harness() {
  const detail = useClientDetail({ switchView: () => {}, setClients: () => {} });
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void detail.openClient(CLIENT as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!detail.selectedClient || detail.tabLoading) return <div>загрузка</div>;
  return <ClientConceptTab detail={detail} />;
}

async function openFields(server: unknown) {
  mockApi.getConceptualization.mockResolvedValue(server);
  render(<Harness />);
  await screen.findByText('Концептуализация');
}
const field = (key: string) =>
  screen.getByPlaceholderText(CONCEPT_FIELDS.find(f => f.key === key)!.placeholder) as HTMLTextAreaElement;

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyTasksForClient.mockResolvedValue([]);
  mockApi.getTherapistNotes.mockResolvedValue({ notes: [], total: 0 });
  mockApi.getTherapyClientData.mockResolvedValue(null);
  mockApi.getClientSchemaNotes.mockResolvedValue([]);
  mockApi.getClientModeNotes.mockResolvedValue([]);
  mockApi.getTherapyClientHistory.mockResolvedValue([]);
  mockApi.getClientDiary.mockResolvedValue([]);
  mockApi.saveConceptualization.mockImplementation(async (_id: number, body: object) => concept(body));
});
afterEach(() => cleanup());

describe('поля концептуализации: предел сервера виден до отправки', () => {
  it('у каждого текстового поля maxLength = предел DTO (CONCEPT_FIELD_TEXT_MAX)', async () => {
    await openFields(concept());
    for (const f of CONCEPT_FIELDS) expect([f.key, field(f.key).maxLength]).toEqual([f.key, CONCEPT_FIELD_TEXT_MAX]);
  });

  it('у границы показывает остаток, на пределе — «Достигнут предел»', async () => {
    await openFields(concept({ goals: 'ц'.repeat(CONCEPT_FIELD_TEXT_MAX - 100) }));
    expect(screen.getByText(/Осталось знаков: 100/)).toBeTruthy();
    fireEvent.change(field('goals'), { target: { value: 'ц'.repeat(CONCEPT_FIELD_TEXT_MAX) } });
    expect(screen.getByText(/Достигнут предел/)).toBeTruthy();
  });

  it('тег, дописанный кнопкой к полю на пределе, не выводит его за предел', async () => {
    await openFields(concept({ triggers: 'т'.repeat(CONCEPT_FIELD_TEXT_MAX) }));
    fireEvent.click(screen.getByRole('button', { name: 'Критика' }));
    await waitFor(() => expect(mockApi.saveConceptualization).toHaveBeenCalled(), { timeout: 2000 });
    expect(mockApi.saveConceptualization.mock.calls[0][1].triggers.length).toBe(CONCEPT_FIELD_TEXT_MAX);
  });

  it('сервер отказал из-за длинного поля (сохранено до предела) — баннер называет поле', async () => {
    mockApi.saveConceptualization.mockRejectedValue(new Error('400'));
    await openFields(concept({ goals: 'ц'.repeat(CONCEPT_FIELD_TEXT_MAX + 1) }));
    fireEvent.change(field('earlyExperience'), { target: { value: 'детство' } });
    expect(await screen.findByText(/В поле «Цели схема-терапии» больше/, {}, { timeout: 2000 })).toBeTruthy();
  });
});
