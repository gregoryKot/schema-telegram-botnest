import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { syncArticleSeed } from './articles.seed-sync';
import type { ArticleDto } from './article.dto';

// Поднимается вместе с правкой articles.seed.ts: пару «версия, хеш сида»
// сверяет articles.seed.lock.spec.ts с articles.seed.lock.json.
export const SEED_VERSION = '24';

/** CRUD for blog articles. Public reads, admin-only writes. */
@Injectable()
export class ArticlesService implements OnModuleInit {
  private readonly logger = new Logger(ArticlesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Сид встроенных статей: пустая таблица заполняется, при смене SEED_VERSION
  // статьи обновляются по slug, кроме правленых в админке (articles.seed-sync.ts).
  // Обложки статей рисует сайт по slug (webapp/src/components/art/articleCoverScenes.ts).
  // Статьи, созданные админом (слаги вне сида), сид не трогает.
  async onModuleInit() {
    await syncArticleSeed(this.prisma, SEED_VERSION, this.logger);
  }

  async list() {
    return this.prisma.article.findMany({
      orderBy: { date: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        date: true,
        updatedAt: true,
        readMin: true,
        diagramKey: true,
      },
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
    return this.prisma.article.create({
      data: { ...dto, date: new Date(dto.date) },
    });
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
