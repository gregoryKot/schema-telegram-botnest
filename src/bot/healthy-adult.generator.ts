import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  HEALTHY_ADULT_SYSTEM_PROMPT,
  buildHealthyAdultUserPrompt,
} from './healthy-adult.prompt';

/** Верхняя граница длины сообщения канала (символы). */
const MAX_LEN = 600;

/**
 * Генерация сообщения канала «Здоровый Взрослый» через Claude API.
 * Основной путь; при отсутствии ключа или ошибке возвращает null — тогда
 * канал берёт фразу из фолбэк-пула (гибрид по решению владельца).
 *
 * Ключ — env ANTHROPIC_API_KEY (без него фича генерации выключена).
 * Модель — env HEALTHY_ADULT_MODEL, по умолчанию claude-opus-4-8.
 */
@Injectable()
export class HealthyAdultGeneratorService {
  private readonly logger = new Logger(HealthyAdultGeneratorService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    this.model = process.env.HEALTHY_ADULT_MODEL?.trim() || 'claude-opus-4-8';
  }

  /** true, если генерация настроена (есть ключ). */
  get enabled(): boolean {
    return this.client !== null;
  }

  /**
   * Сгенерировать сообщение. `recentPosts` — последние тексты (чтобы не
   * повторять форму). Возвращает готовый текст или null (→ фолбэк на пул).
   */
  async generate(
    recentPosts: string[],
    now = new Date(),
  ): Promise<string | null> {
    if (!this.client) return null;
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: HEALTHY_ADULT_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildHealthyAdultUserPrompt(recentPosts, now),
          },
        ],
      });
      const raw = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
      return this.sanitize(raw, recentPosts);
    } catch (err) {
      this.logger.error(
        `Claude generation failed, falling back to pool: ${(err as Error)?.message}`,
      );
      return null;
    }
  }

  /** Обрезать обёртки-кавычки, отсеять пустое/длинное/точный дубль недавнего. */
  private sanitize(text: string, recentPosts: string[]): string | null {
    const clean = text.replace(/^[«"']+|[»"']+$/g, '').trim();
    if (clean.length === 0 || clean.length > MAX_LEN) return null;
    if (recentPosts.some((p) => p.trim() === clean)) return null;
    return clean;
  }
}
