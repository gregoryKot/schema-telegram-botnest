// Проба D-1 (docs/open/security.md): дамп боевой БД в публичной истории
// GitHub. Фикстура — настоящий ответ Git Trees API на 2026-11-07
// (test/fixtures/recorded/github-git-tree-dump.json, правило №23).
import {
  dumpStillPublicProbe,
  DUMP_PUBLIC_DETAIL,
  DUMP_TREE_SHA,
} from './probe-dump-public';
import { loadRecordedFixture } from '../../test-support/recorded-fixture';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

function mockFetch(res: { status: number; ok: boolean; json?: () => unknown }) {
  const fn = jest.fn().mockResolvedValue({
    json: async () => ({}),
    ...res,
  });
  global.fetch = fn as never;
  return fn;
}

describe('dumpStillPublicProbe', () => {
  it('reportInHealth: false — чинит владелец, смок не должен краснеть неделями', () => {
    expect(dumpStillPublicProbe().reportInHealth).toBe(false);
  });

  it('настоящий ответ GitHub с дампом в дереве — красная, с подсказкой, что делать', async () => {
    const fixture = JSON.parse(
      loadRecordedFixture('github-git-tree-dump.json'),
    );
    const fetchMock = mockFetch({ status: 200, ok: true, json: () => fixture });

    const res = await dumpStillPublicProbe().run();

    expect(res).toEqual({ ok: false, detail: DUMP_PUBLIC_DETAIL });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe(
      `https://api.github.com/repos/gregoryKot/schema-telegram-botnest/git/trees/${DUMP_TREE_SHA}`,
    );
  });

  it('404 (репозиторий приватный или мусор собран) — зелёная', async () => {
    mockFetch({ status: 404, ok: false });
    expect(await dumpStillPublicProbe().run()).toEqual({
      ok: true,
      detail: 'GitHub дамп больше не отдаёт',
    });
  });

  it('дерево есть, а файла в нём нет — зелёная', async () => {
    const fixture = JSON.parse(
      loadRecordedFixture('github-git-tree-dump.json'),
    );
    fixture.tree = fixture.tree.filter(
      (e: { path: string }) => e.path !== 'railway_data.sql',
    );
    mockFetch({ status: 200, ok: true, json: () => fixture });
    expect((await dumpStillPublicProbe().run()).ok).toBe(true);
  });

  it('лимит GitHub (403) — красная с кодом, не «дамп убран»', async () => {
    mockFetch({ status: 403, ok: false });
    expect(await dumpStillPublicProbe().run()).toEqual({
      ok: false,
      detail: 'GitHub ответил HTTP 403',
    });
  });

  it('сеть упала — не бросает, красная с причиной', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ETIMEDOUT')) as never;
    const res = await dumpStillPublicProbe().run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('ETIMEDOUT');
  });
});
