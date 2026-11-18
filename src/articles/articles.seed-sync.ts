// Сид встроенных статей на старте (ArticlesService.onModuleInit).
// Версия в BookingSetting решает, когда сверять; хеш того, что сид записал в
// каждую статью, решает, можно ли её перезаписать: правку из админки сид не трогает.
import { createHash } from 'crypto';
import type { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { ARTICLE_SEED } from './articles.seed';
import { ARTICLE_DIAGRAM_KEYS } from './article-diagrams';

const SEED_VERSION_KEY = 'articlesSeedVersion';
const SEED_HASHES_KEY = 'articlesSeedHashes';

/** Поля, которые пишет сид: по ним считается хеш. */
export interface SeedFields {
  title: string;
  description: string;
  content: string;
  date: Date;
  readMin: number;
  diagramKey: string | null;
}

export function articleFieldsHash(a: SeedFields): string {
  const fields = [
    a.title,
    a.description,
    a.content,
    a.date.toISOString(),
    a.readMin,
    a.diagramKey ?? null,
  ];
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}

export function builtinArticles() {
  return ARTICLE_SEED.map((a) => ({
    ...a,
    date: new Date(a.date),
    // Диаграмма рисуется на клиенте и в `content` не вшита: правка статьи её не сотрёт.
    diagramKey: ARTICLE_DIAGRAM_KEYS[a.slug] ?? null,
  }));
}

/** Хеш всего сида: его закрепляет за версией `articles.seed.lock.json`. */
export function seedContentHash(): string {
  const h = createHash('sha256');
  for (const a of builtinArticles())
    h.update(`${a.slug}:${articleFieldsHash(a)}\n`);
  return h.digest('hex');
}

// Битое значение = хешей нет: правленые статьи тогда пропускаются, а не затираются.
function parseHashes(
  raw: string | undefined,
  logger: Logger,
): Record<string, string> {
  try {
    const v: unknown = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' ? (v as Record<string, string>) : {};
  } catch (e) {
    logger.warn(
      `${SEED_HASHES_KEY}: не JSON (${String(e)}), хеши сида начинаются заново`,
    );
    return {};
  }
}

export async function syncArticleSeed(
  prisma: PrismaService,
  version: string,
  logger: Logger,
): Promise<void> {
  const [storedVersion, storedHashes] = await Promise.all([
    prisma.bookingSetting.findUnique({ where: { key: SEED_VERSION_KEY } }),
    prisma.bookingSetting.findUnique({ where: { key: SEED_HASHES_KEY } }),
  ]);
  const versionChanged = storedVersion?.value !== version;
  if (!versionChanged && storedHashes) return;
  // Хешей ещё нет (первый старт с этой защитой): при смене версии ведём себя как раньше.
  const legacy = !storedHashes;
  const written = parseHashes(storedHashes?.value, logger);
  const skipped: string[] = [];

  for (const a of builtinArticles()) {
    const target = articleFieldsHash(a);
    const existing = await prisma.article.findUnique({
      where: { slug: a.slug },
    });
    if (!existing) {
      await prisma.article.create({ data: a });
      written[a.slug] = target;
      continue;
    }
    const current = articleFieldsHash(existing);
    if (current === target) {
      written[a.slug] = target;
      continue;
    }
    if (!versionChanged) continue;
    if (!legacy && written[a.slug] !== current) {
      skipped.push(a.slug);
      continue;
    }
    const { title, description, content, date, readMin, diagramKey } = a;
    await prisma.article.update({
      where: { slug: a.slug },
      data: { title, description, content, date, readMin, diagramKey },
    });
    written[a.slug] = target;
  }

  const value = JSON.stringify(written);
  await prisma.bookingSetting.upsert({
    where: { key: SEED_HASHES_KEY },
    create: { key: SEED_HASHES_KEY, value },
    update: { value },
  });
  await prisma.bookingSetting.upsert({
    where: { key: SEED_VERSION_KEY },
    create: { key: SEED_VERSION_KEY, value: version },
    update: { value: version },
  });
  for (const slug of skipped) {
    logger.warn(
      `Встроенная статья ${slug} правлена в админке, сид версии ${version} её не перезаписал ` +
        '(текст из сида переносится в админке вручную).',
    );
  }
  logger.log(`Articles seeded/refreshed to version ${version}`);
}
