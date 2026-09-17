// Куда попадает человек, запустивший УСТАНОВЛЕННОЕ приложение.
//
// Приложение одно (манифест: id/start_url = /app/, scope = /), но поверхностей
// две: мини-апп собран под телефон, а на широком экране полноценнее кабинет
// сайта — сайдбар, карта режимов, поиск по ⌘K. Поэтому на компьютере запуск
// уводит в кабинет; это осознанное правило, а не случайность установки.
//
// Не трогаем: обычную вкладку браузера (открыл /app/ руками — значит хотел
// именно его), мессенджеры (там web-хоста нет вовсе) и глубокие ссылки
// (/app/?startapp=… — приглашение в пару, оно живёт только в мини-аппе).

/** Куда ведёт кабинет сайта. Метка from=app — чтобы отчёт видел такие запуски. */
export const CABINET_PATH = '/today?from=app';

export function shouldOpenCabinet(input: {
  /** Запущено с иконки, а не вкладкой браузера. */
  standalone: boolean;
  /** Хост приложения: в Telegram/MAX перенаправлять некуда. */
  hostId: string;
  /** Ширина окна и наличие мыши — тот же порог, что у десктопной вёрстки сайта. */
  width: number;
  pointerFine: boolean;
  /** Строка запроса запуска (?startapp=… — глубокая ссылка мини-аппа). */
  search: string;
}): boolean {
  if (!input.standalone || input.hostId !== 'web') return false;
  if (input.width < 900 || !input.pointerFine) return false;
  const q = new URLSearchParams(input.search);
  return !q.has('startapp') && !q.has('start_param');
}
