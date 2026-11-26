// .ics шага плана: отдать хосту (аудит 2026-11, E6). Браузер берёт файл,
// собранный на устройстве (data:-URL, utils/ics.ts). Telegram (openLink) и
// MAX (downloadFile) пускают только http(s) — Telegram бросал WebAppTgUrlInvalid.
// Там файл отдаёт сервер — по ссылке, которую выдаёт POST /api/plan/ics
// (src/api/practice-ics.ts); событие то же: начало — planEventStartMs.
import { getHost } from '../host';
import { practiceIcsDataUrl, type PracticeIcsParams } from '../utils/ics';
import { planEventStartMs } from '../utils/planEventStart';

export const PRACTICE_ICS_FILE = 'practice.ics';

export type PracticeIcsLinkBody = {
  text: string;
  needLabel: string;
  startMs: number;
};
export type PracticeIcsLink = (
  body: PracticeIcsLinkBody,
) => Promise<{ path: string }>;

/**
 * Файл с устройства уходит синхронно — в обработчике тапа (иначе браузер
 * может не счесть скачивание жестом); ссылка с сервера — после ответа.
 * Отказ сервера — отклонённый промис: экран говорит о нём сам.
 */
export function savePracticeIcs(
  params: PracticeIcsParams,
  link: PracticeIcsLink,
): Promise<void> {
  const host = getHost();
  if (host.capabilities.dataUrlFiles) {
    host.saveFile(practiceIcsDataUrl(params), PRACTICE_ICS_FILE);
    return Promise.resolve();
  }
  const startMs = planEventStartMs(params.localHour, params.tzOffset);
  return link({ text: params.text, needLabel: params.needLabel, startMs }).then(
    ({ path }) =>
      host.saveFile(
        new URL(path, window.location.origin).href,
        PRACTICE_ICS_FILE,
      ),
  );
}
