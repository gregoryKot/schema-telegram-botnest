import { StatsReportService } from './stats-report.service';

describe('StatsReportService.render', () => {
  it('склеивает продуктовые метрики, карточки режимов, дневник режимов, тёплые слова и разборы фраз', async () => {
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
    const service = new StatsReportService(
      product as never,
      modeCard as never,
      modeDiary as never,
      warmWords as never,
      phraseChecks as never,
    );

    await expect(service.render()).resolves.toBe(
      'продуктовые метрики\n\nкарточки режимов: 9\n\nдневник режимов: 5\n\n' +
        'тёплые слова: 3\n\nразборы фраз: 7',
    );
  });
});
