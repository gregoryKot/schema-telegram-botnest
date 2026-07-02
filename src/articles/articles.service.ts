import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ARTICLE_SEED } from './articles.seed';

export interface ArticleDto {
  slug: string;
  title: string;
  description: string;
  content: string;
  date: string;
  readMin: number;
}

/** CRUD for blog articles. Public reads, admin-only writes. */
@Injectable()
export class ArticlesService implements OnModuleInit {
  private readonly logger = new Logger(ArticlesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // One-time seed of the articles that used to be hardcoded in the webapp.
  // Only runs while the table is empty, so it never overwrites admin edits.
  async onModuleInit() {
    const count = await this.prisma.article.count();
    if (count > 0) return;
    await this.prisma.article.createMany({
      data: ARTICLE_SEED.map((a) => ({ ...a, date: new Date(a.date) })),
    });
    this.logger.log(`Seeded ${ARTICLE_SEED.length} articles`);
  }

  async list() {
    return this.prisma.article.findMany({
      orderBy: { date: 'desc' },
      select: { id: true, slug: true, title: true, description: true, date: true, readMin: true },
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
