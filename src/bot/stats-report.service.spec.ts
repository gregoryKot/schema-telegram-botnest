import { StatsReportService } from './stats-report.service';

describe('StatsReportService.render', () => {
  const build = () => {
    const product = {
      render: jest.fn().mockResolvedValue('продуктовые метрики'),
    };
    const modeCard = {
      render: jest.fn().mockResolvedValue('карточки режимов: 9'),
    };
    const modeDiary = {
      render: jest.fn().mockResolvedValue('дневник режимов: 5'),
    };
    const warmWords = {
      render: jest.fn().mockResolvedValue('тёплые слова: 3'),
    };
    const phraseChecks = {
      render: jest.fn().mockResolvedValue('разборы фраз: 7'),
    };
    const accountLink = {
      render: jest.fn().mockResolvedValue('перенос данных: 2'),
    };
    const plus = {
      render: jest.fn().mockResolvedValue('кнопка плюс: 4'),
    };
    const screen = {
      render: jest.fn().mockResolvedValue('настройка экранов: 1'),
    };
    return {
      blocks: { accountLink, plus, screen },
      service: new StatsReportService(
        product as never,
        modeCard as never,
        modeDiary as never,
        warmWords as never,
        phraseChecks as never,
        accountLink as never,
        plus as never,
        screen as never,
      ),
    };
  };

  it('склеивает все блоки отчёта в одном порядке', async () => {
    const { service } = build();

    await expect(service.render()).resolves.toBe(
      'продуктовые метрики\n\nкарточки режимов: 9\n\nдневник режимов: 5\n\n' +
        'тёплые слова: 3\n\nразборы фраз: 7\n\nперенос данных: 2\n\n' +
        'кнопка плюс: 4\n\nнастройка экранов: 1',
    );
  });

  it('новый блок реально спрашивается — событие без строки в отчёте невидимо', async () => {
    // Правило №8: подключить сервис в модуль и забыть вызвать его здесь —
    // ровно тот случай, когда метрика «есть», а в /stats её нет.
    const { service, blocks } = build();
    const out = await service.render();
    expect(blocks.accountLink.render).toHaveBeenCalledTimes(1);
    expect(blocks.plus.render).toHaveBeenCalledTimes(1);
    expect(blocks.screen.render).toHaveBeenCalledTimes(1);
    expect(out).toContain('перенос данных: 2');
    expect(out).toContain('кнопка плюс: 4');
    expect(out).toContain('настройка экранов: 1');
  });
});
