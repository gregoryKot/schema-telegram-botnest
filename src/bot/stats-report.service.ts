import { Injectable } from '@nestjs/common';
import { ProductMetricsService } from './bot.product-metrics.service';
import { ModeCardMetricsService } from './mode-card-metrics.service';

// Единая склейка второго сообщения /stats (продуктовые метрики + карточки
// режимов). Отдельный модуль — правило №10: не раздувать ни
// ProductMetricsService (зафиксирован на 257 строках), ни telegram.service.ts
// (худший файл репозитория, храповик держит его без роста).
@Injectable()
export class StatsReportService {
  constructor(
    private readonly product: ProductMetricsService,
    private readonly modeCard: ModeCardMetricsService,
  ) {}

  /** Готовый текстовый блок для второго сообщения /stats. */
  async render(): Promise<string> {
    const [product, modeCard] = await Promise.all([
      this.product.render(),
      this.modeCard.render(),
    ]);
    return `${product}\n\n${modeCard}`;
  }
}
