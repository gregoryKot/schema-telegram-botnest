import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface MarqueeTopic { label: string; href: string; }

const KEY_HERO_PHOTO = 'heroPhoto';
const KEY_MARQUEE_A = 'marqueeTopicsA';
const KEY_MARQUEE_B = 'marqueeTopicsB';

// Falls back to the values that used to be hardcoded in LandingPage.tsx, so
// the site looks the same until the therapist actually edits them.
const DEFAULT_TOPICS_A: MarqueeTopic[] = [
  { label: 'Схема-терапия', href: '#approach' },
  { label: 'Паттерны', href: '#approach' },
  { label: 'Отношения', href: '#booking' },
  { label: 'Самооценка', href: '#booking' },
  { label: 'Тревога', href: '#booking' },
  { label: 'Идентичность', href: '#approach' },
  { label: 'КПТ', href: '#approach' },
  { label: 'Бесплатное знакомство', href: '#booking' },
  { label: 'Онлайн-сессии', href: '#prices' },
  { label: 'Отзывы', href: '/reviews' },
];
const DEFAULT_TOPICS_B: MarqueeTopic[] = [
  { label: 'Безопасная среда', href: '#about' },
  { label: 'Глубинная работа', href: '#approach' },
  { label: 'Ранние убеждения', href: '#approach' },
  { label: 'Режимы и схемы', href: '#approach' },
  { label: 'Устойчивые изменения', href: '#approach' },
  { label: 'Первая встреча бесплатно', href: '#booking' },
  { label: 'Доказательный метод', href: '#approach' },
  { label: 'Индивидуально', href: '#prices' },
  { label: 'Работаю онлайн', href: '#prices' },
  { label: 'Почему нет отзывов', href: '/reviews' },
];

/** Site-wide content editable from the admin panel (hero photo, marquee topics). */
@Injectable()
export class SiteContentService {
  constructor(private readonly prisma: PrismaService) {}

  private async get(key: string): Promise<string | null> {
    const row = await this.prisma.bookingSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  private async set(key: string, value: string): Promise<void> {
    await this.prisma.bookingSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }

  private parseTopics(raw: string | null, fallback: MarqueeTopic[]): MarqueeTopic[] {
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((t) => typeof t?.label === 'string' && typeof t?.href === 'string')) {
        return parsed;
      }
    } catch { /* fall through to default */ }
    return fallback;
  }

  async getPublicContent() {
    const [heroPhoto, topicsA, topicsB] = await Promise.all([
      this.get(KEY_HERO_PHOTO),
      this.get(KEY_MARQUEE_A),
      this.get(KEY_MARQUEE_B),
    ]);
    return {
      heroPhoto,
      marqueeTopicsA: this.parseTopics(topicsA, DEFAULT_TOPICS_A),
      marqueeTopicsB: this.parseTopics(topicsB, DEFAULT_TOPICS_B),
    };
  }

  async setHeroPhoto(dataUri: string) {
    await this.set(KEY_HERO_PHOTO, dataUri);
    return { ok: true };
  }

  async setMarqueeTopics(group: 'A' | 'B', topics: MarqueeTopic[]) {
    await this.set(group === 'A' ? KEY_MARQUEE_A : KEY_MARQUEE_B, JSON.stringify(topics));
    return { ok: true };
  }
}
