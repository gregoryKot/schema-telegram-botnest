import { Injectable } from '@nestjs/common';
import { ProductMetricsService } from './bot.product-metrics.service';
import { ModeCardMetricsService } from './mode-card-metrics.service';
import { ModeDiaryMetricsService } from './mode-diary-metrics.service';
import { WarmWordsMetricsService } from './warm-words-metrics.service';
import { PhraseCheckMetricsService } from './phrase-check-metrics.service';
import { PlusMetricsService } from './plus-metrics.service';

// Единая склейка второго сообщения /stats (продуктовые метрики + карточки
// режимов + дневник режимов + тёплые слова). Отдельный модуль — правило №10:
// не раздувать ни ProductMetricsService (зафиксирован на 257 строках), ни
// telegram.service.ts (худший файл репозитория, храповик держит его без роста).
@Injectable()
export class StatsReportService {
  constructor(
    private readonly product: ProductMetricsService,
    private readonly modeCard: ModeCardMetricsService,
    private readonly modeDiary: ModeDiaryMetricsService,
    private readonly warmWords: WarmWordsMetricsService,
    private readonly phraseChecks: PhraseCheckMetricsService,
    private readonly plus: PlusMetricsService,
  ) {}

  /** Готовый текстовый блок для второго сообщения /stats. */
  async render(): Promise<string> {
    const [product, modeCard, modeDiary, warmWords, phraseChecks, plus] =
      await Promise.all([
        this.product.render(),
        this.modeCard.render(),
        this.modeDiary.render(),
        this.warmWords.render(),
        this.phraseChecks.render(),
        this.plus.render(),
      ]);
    return `${product}\n\n${modeCard}\n\n${modeDiary}\n\n${warmWords}\n\n${phraseChecks}\n\n${plus}`;
  }
}
