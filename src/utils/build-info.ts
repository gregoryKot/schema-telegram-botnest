import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Когда собран образ, который сейчас работает.
 *
 * 31.07.2026 полдня ушло на вопрос «а какой код на проде»: хостинг не смог
 * подтянуть свежий коммит, пересборка собрала старое, и понять это удалось
 * только по формулировке сообщения об ошибке. Метку пишет Dockerfile сразу
 * после копирования исходников — если образ старый, это видно сразу, а не
 * через час сравнения текстов.
 *
 * Хэша коммита тут нет намеренно: `.git` исключён из контекста сборки
 * (`.dockerignore`), а на хостинге репозиторий свой, и его хэш ничего не
 * сказал бы про наш. Время сборки отвечает на нужный вопрос честно.
 */
const FILE = 'BUILD_INFO';

let cached: Date | null | undefined;

/** Разбор содержимого метки. Пустая/битая — как будто метки нет. */
export function parseBuildInfo(raw: string | null): Date | null {
  const at = raw ? new Date(raw.trim()) : null;
  return at && !Number.isNaN(at.getTime()) ? at : null;
}

/** Время сборки образа или null, если метки нет (локальный запуск). */
export function builtAt(): Date | null {
  if (cached !== undefined) return cached;
  try {
    cached = parseBuildInfo(readFileSync(join(process.cwd(), FILE), 'utf8'));
  } catch {
    cached = null;
  }
  return cached;
}

/** Сброс между тестами: файл читается один раз на процесс. */
export function resetBuildInfo(): void {
  cached = undefined;
}
