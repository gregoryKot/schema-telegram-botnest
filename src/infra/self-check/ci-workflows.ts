import { NIGHTLY_MAX_AGE_HOURS, SMOKE_MAX_AGE_HOURS } from './ci-run-age';

/** Мутационный прогон идёт раз в неделю (вс 04:00 UTC): 8 суток — запас. */
export const MUTATION_MAX_AGE_HOURS = 8 * 24;

export interface WorkflowSpec {
  file: string;
  /** Текст в detail, если последний завершённый прогон не success. */
  failMessage: (url: string) => string;
  /** Старше — воркфлоу не запускается вовсе (планировщик GitHub молчит). */
  maxAgeHours: number;
  notRunLabel: string;
}

export const WORKFLOWS: WorkflowSpec[] = [
  {
    file: 'nightly.yml',
    failMessage: (url) => `ночная проверка упала: ${url}`,
    maxAgeHours: NIGHTLY_MAX_AGE_HOURS,
    notRunLabel: 'ночная проверка не запускалась',
  },
  {
    file: 'prod-smoke.yml',
    failMessage: (url) => `смок прода красный: ${url}`,
    maxAgeHours: SMOKE_MAX_AGE_HOURS,
    notRunLabel: 'смок не запускался',
  },
  {
    file: 'mutation-bot.yml',
    failMessage: (url) => `мутационный прогон упал: ${url}`,
    maxAgeHours: MUTATION_MAX_AGE_HOURS,
    notRunLabel: 'мутационный прогон не запускался',
  },
];
