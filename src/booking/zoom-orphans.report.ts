// Строки отчёта /scrub_foreign о комнатах Zoom вне базы (zoom-orphans.ts).
// Текст для владельца, не для клиента: формы «ты/вы» в нём нет.
import type { OrphanReport } from './zoom-orphans';
import type { ZoomListResult } from './zoom-room';

const LIST_TROUBLE: Record<Exclude<ZoomListResult, 'ok'>, string> = {
  forbidden: 'нет права читать список встреч (403)',
  limited: 'лимит запросов',
  failed: 'список встреч не получен',
};

export function orphanLines(o: OrphanReport, live: boolean): string[] {
  const head = 'Комнаты Zoom вне базы: ';
  if (o.list !== 'ok') {
    const detail = o.list === 'failed' && o.detail ? ` (${o.detail})` : '';
    return [`${head}не проверены — ${LIST_TROUBLE[o.list]}${detail}`];
  }
  if (!o.orphans) return [`${head}нет`, ...otherLine(o)];
  const verb = live ? '' : 'будет ';
  const lines = [
    `${head}${o.orphans} — ${verb}удалено ${o.deleted}, ${verb}переименовано ${o.renamed}, ` +
      `оставлено из-за брони ${o.kept}, ошибок ${o.failed}`,
  ];
  if (o.unreadable)
    lines.push(
      `Не прочитано ссылок в бронях: ${o.unreadable} — комнаты вне базы не удаляются, только переименовываются.`,
    );
  if (o.manual.length)
    lines.push(
      `Нет права на удаление встреч — удалить вручную в кабинете Zoom: ${o.manual.join(', ')}.`,
    );
  return [...lines, ...otherLine(o)];
}

const OTHER_HINT =
  'тема или тип не как у комнат бота, не тронуты. Если в теме имя клиента — поправить вручную в кабинете Zoom.';
function otherLine(o: OrphanReport): string[] {
  return o.other ? [`Других встреч в Zoom: ${o.other} — ${OTHER_HINT}`] : [];
}

/** Повтор боевого прогона поможет: были ошибки или список не получен. */
export function orphansRetry(o: OrphanReport | null): boolean {
  return !!o && (o.failed > 0 || o.list === 'failed');
}
