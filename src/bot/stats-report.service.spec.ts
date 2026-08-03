import { StatsReportService } from './stats-report.service';

describe('StatsReportService.render', () => {
  it('склеивает продуктовые метрики, карточки режимов, дневник режимов и тёплые слова', async () => {
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
    const service = new StatsReportService(
      product as never,
      modeCard as never,
      modeDiary as never,
      warmWords as never,
    );

    await expect(service.render()).resolves.toBe(
      'продуктовые метрики\n\nкарточки режимов: 9\n\nдневник режимов: 5\n\nтёплые слова: 3',
    );
  });
});
