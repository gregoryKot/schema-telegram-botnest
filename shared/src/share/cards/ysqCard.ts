// Карточка результата теста на схемы: счёт выраженных схем + полный профиль
// всех 20 схем барами (отрисовка — ysqProfileCard.ts). Здесь — сборка пропсов
// для ShareCardSheet обоих фронтендов и короткий текст шаринга. Персональные
// данные — только агрегаты (средние баллы), без ответов на вопросы.
import { buildYsqProfile, drawYsqProfileCard } from './ysqProfileCard';

export function pluralActiveSchemas(n: number): string {
  if (n === 1) return 'выраженная схема';
  if (n >= 2 && n <= 4) return 'выраженные схемы';
  return 'выраженных схем';
}

// Короткий текст шаринга (уходит вместе с картинкой). 1-е лицо, без рода
// и без ты/вы — правило shareTexts.
export function buildYsqShareText(activeCount: number, link: string): string {
  const head =
    activeCount === 0
      ? '🧠 Мой результат теста на схемы: выраженных схем не обнаружено.'
      : `🧠 Мой результат теста на схемы: ${activeCount} ${pluralActiveSchemas(activeCount)} из 20.`;
  return `${head}\n\n${link}`;
}

/** Заголовок-счёт над профилем карточки. */
export function ysqCardHeadline(activeCount: number): string {
  return activeCount === 0
    ? 'Выраженных схем не обнаружено'
    : `${activeCount} ${pluralActiveSchemas(activeCount)} из 20`;
}

// Готовые пропсы для ShareCardSheet обоих фронтендов (одно место сборки,
// чтобы вилка webapp/miniapp не расползалась и не плодила клоны).
export function ysqShareCard(
  scores: Record<string, { pct5plus: number; avg: number }>,
  view: { activeCount: number; dateLabel: string | null },
  link: string,
) {
  const domains = buildYsqProfile(scores);
  const opts = {
    headline: ysqCardHeadline(view.activeCount),
    dateLabel: view.dateLabel,
  };
  return {
    title: 'Результат теста',
    draw: (canvas: HTMLCanvasElement) =>
      drawYsqProfileCard(canvas, domains, opts),
    shareText: buildYsqShareText(view.activeCount, link),
    filename: 'schema-test.png',
    eventKind: 'ysq' as const,
  };
}
