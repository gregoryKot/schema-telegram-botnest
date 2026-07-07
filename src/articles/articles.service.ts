import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ARTICLE_SEED } from './articles.seed';
import { ARTICLE_DIAGRAM_KEYS } from './article-diagrams';

// Bump this when the built-in article content changes (e.g. new diagrams) so a
// running instance refreshes the seeded articles on next start.
const SEED_VERSION = '5';
const SEED_VERSION_KEY = 'articlesSeedVersion';

export interface ArticleDto {
  slug: string;
  title: string;
  description: string;
  content: string;
  date: string;
  readMin: number;
  heroImage?: string | null;
  diagramKey?: string | null;
}

/** CRUD for blog articles. Public reads, admin-only writes. */
@Injectable()
export class ArticlesService implements OnModuleInit {
  private readonly logger = new Logger(ArticlesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Seed / refresh the built-in articles (the ones that used to be hardcoded in
  // the webapp). Version-gated: on an empty table we insert everything; on a
  // SEED_VERSION bump we refresh the built-in articles' text/diagrams by slug.
  // heroImage is never overwritten (admin uploads survive), and articles the
  // admin created (slugs not in the seed) are never touched.
  async onModuleInit() {
    const stored = await this.prisma.bookingSetting.findUnique({ where: { key: SEED_VERSION_KEY } });
    if (stored?.value === SEED_VERSION) return;

    const seed = ARTICLE_SEED.map((a) => ({
      ...a,
      date: new Date(a.date),
      // The diagram is a separate field rendered client-side — it is NOT baked
      // into `content`, so editing an article never strips it.
      diagramKey: ARTICLE_DIAGRAM_KEYS[a.slug] ?? null,
    }));

    for (const a of seed) {
      const existing = await this.prisma.article.findUnique({ where: { slug: a.slug } });
      if (!existing) {
        await this.prisma.article.create({ data: a });
      } else {
        // Refresh built-in text + diagram key; keep any admin-uploaded hero image.
        await this.prisma.article.update({
          where: { slug: a.slug },
          data: { title: a.title, description: a.description, content: a.content, date: a.date, readMin: a.readMin, diagramKey: a.diagramKey },
        });
      }
    }

    await this.prisma.bookingSetting.upsert({
      where: { key: SEED_VERSION_KEY },
      create: { key: SEED_VERSION_KEY, value: SEED_VERSION },
      update: { value: SEED_VERSION },
    });
    this.logger.log(`Articles seeded/refreshed to version ${SEED_VERSION}`);
  }

  async list() {
    return this.prisma.article.findMany({
      orderBy: { date: 'desc' },
      select: { id: true, slug: true, title: true, description: true, date: true, readMin: true, heroImage: true, diagramKey: true },
    });
  }

  async findBySlug(slug: string) {
    const article = await this.prisma.article.findUnique({ where: { slug } });
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  async adminList() {
    return this.prisma.article.findMany({ orderBy: { date: 'desc' } });
  }

  async create(dto: ArticleDto) {
    return this.prisma.article.create({ data: { ...dto, date: new Date(dto.date) } });
  }

  async update(id: number, dto: Partial<ArticleDto>) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    return this.prisma.article.update({
      where: { id },
      data: { ...dto, ...(dto.date ? { date: new Date(dto.date) } : {}) },
    });
  }

  async remove(id: number) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    await this.prisma.article.delete({ where: { id } });
    return { ok: true };
  }
}
