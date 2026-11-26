// @vitest-environment jsdom
// R6 (аудит 2026-11), шов «Мой путь» → api.ts → сеть: запись открывалась
// поиском в списке, а список отдаёт 30 последних — 31-я приходила пустой.
// Тест идёт через настоящий api-клиент сайта и общий makeJourneyProps: тап по
// записи обязан уйти в GET …/:id, а не в список. Мок — только fetch.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, setTokenProvider } from './api';
import { clearApiCache } from '../../shared/src/api/apiCache';
import { makeJourneyProps } from '../../shared/src/journey/useJourney';
import type { JourneyItem } from '../../shared/src/journey/journeyMeta';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
const paths = () =>
  fetchMock.mock.calls.map(([url]) => new URL(String(url), 'http://x').pathname);

const jp = makeJourneyProps(api, {
  getModeById: () => undefined,
  getSchemaById: () => undefined,
});
const open = (type: string, id: number) =>
  jp.fetchDetail({ type, id, at: '2025-01-01T10:00:00Z' } as JourneyItem);

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  clearApiCache();
  setTokenProvider(() => 'token');
});
afterEach(() => vi.unstubAllGlobals());

describe('«Мой путь»: открытие записи ходит в GET …/:id', () => {
  it.each([
    ['schema_diary', '/api/diary/schema/31', { trigger: 'Тридцать первая' }],
    ['mode_diary', '/api/diary/mode/31', { situation: 'Тридцать первая' }],
    ['gratitude', '/api/diary/gratitude/31', { items: ['Тридцать первая'] }],
    ['belief_check', '/api/belief-checks/31', { belief: 'Тридцать первая' }],
    ['letter', '/api/letters/31', { text: 'Тридцать первая' }],
    ['flashcard', '/api/flashcards/31', { reflection: 'Тридцать первая' }],
  ])('%s → %s', async (type, path, body) => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 31, ...body }));
    const parts = await open(type, 31);
    expect(paths()).toEqual([path]);
    expect(parts.map((p) => p.text)).toContain('Тридцать первая');
  });

  it('попытка теста → /api/ysq-history/:id', async () => {
    const attempt = { id: 21, completedAt: '2025-01-01', scores: [] };
    fetchMock.mockResolvedValue(jsonResponse(200, attempt));
    await jp.fetchResult({ type: 'ysq', id: 21, at: '2025-01-01' });
    expect(paths()).toEqual(['/api/ysq-history/21']);
  });

  it('удалённая запись (404) — пустой просмотр, а не падение', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { message: 'Entry not found' }));
    await expect(open('letter', 31)).resolves.toEqual([]);
  });
});
