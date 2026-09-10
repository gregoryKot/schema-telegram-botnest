// Выгрузка данных (152-ФЗ / GDPR art.15,20). Контроллер тонкий, но два его
// свойства проверять обязательно: он берёт userId ТОЛЬКО из проверенной
// авторизации (иначе выгрузку чужого аккаунта можно было бы запросить
// параметром) и отдаёт файл, а не строку в теле страницы.
import { AccountExportController } from './account-export.controller';
import type { DataExportResult } from '../account/data-export.service';

function makeResult(): DataExportResult {
  return {
    exportedAt: '2026-09-06T10:11:12.000Z',
    account: { id: 42 },
    providers: [],
    data: { Rating: [] },
    withheld: [{ table: 'WebSession', reason: 'секрет входа' }],
  };
}

function make() {
  const result = makeResult();
  const dataExport = { buildExport: jest.fn(async () => result) };
  const headers: Record<string, string> = {};
  const res = { setHeader: (k: string, v: string) => (headers[k] = v) };
  return {
    controller: new AccountExportController(dataExport as never),
    dataExport,
    headers,
    res,
    result,
  };
}

describe('AccountExportController', () => {
  it('выгружает данные того, кто вошёл, — id берётся из авторизации', async () => {
    const { controller, dataExport, res } = make();
    const req = { webUser: { userId: 7007n } };

    await controller.exportData(req as never, res as never);

    // Именно значение из webUser: подстановка id из query/params была бы
    // выдачей чужой выгрузки по номеру.
    expect(dataExport.buildExport).toHaveBeenCalledWith(7007n);
  });

  it('отдаётся файлом с датой в имени, а не текстом в браузере', async () => {
    const { controller, headers, res } = make();

    await controller.exportData(
      { webUser: { userId: 1n } } as never,
      res as never,
    );

    expect(headers['Content-Disposition']).toBe(
      'attachment; filename="schemehappens-export-2026-09-06.json"',
    );
  });

  it('возвращает то, что собрал сервис, без урезания', async () => {
    const { controller, res, result } = make();

    const out = await controller.exportData(
      { webUser: { userId: 1n } } as never,
      res as never,
    );

    // Контроллер не фильтрует и не переупаковывает: решение о составе живёт в
    // export-policy.ts, и раздвоение этого решения здесь было бы вторым
    // местом, где можно случайно потерять или добавить данные.
    expect(out).toBe(result);
  });
});
