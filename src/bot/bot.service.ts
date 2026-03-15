import { Injectable } from '@nestjs/common';

export type NeedId =
  | 'safety'
  | 'attachment'
  | 'autonomy'
  | 'expression'
  | 'limits'
  | 'play';

export interface Need {
  id: NeedId;
  title: string;
}

@Injectable()
export class BotService {
  // In-memory store keyed by `${userId}:${date}` storing partial ratings per need
  // value is integer 0..10
  private store = new Map<string, Partial<Record<NeedId, number>>>();

  // Define needs
  private readonly needs: Need[] = [
    { id: 'safety', title: 'Безопасность' },
    { id: 'attachment', title: 'Привязанность' },
    {
      id: 'autonomy',
      title: 'Автономия / компетентность / успех / самоидентичность',
    },
    { id: 'expression', title: 'Выражение потребностей и чувств' },
    { id: 'limits', title: 'Разумные ограничения и самоконтроль' },
    { id: 'play', title: 'Удовольствие / спонтанность / игра' },
  ];

  getNeeds(): Need[] {
    return this.needs;
  }

  private todayDateString(date = new Date()): string {
    // local server date YYYY-MM-DD
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private keyFor(userId: number, date?: string): string {
    const dt = date ?? this.todayDateString();
    return `${userId}:${dt}`;
  }

  saveRating(userId: number, needId: NeedId, value: number, date?: string) {
    if (!Number.isInteger(value) || value < 0 || value > 10) {
      throw new Error('Rating must be integer 0..10');
    }
    const key = this.keyFor(userId, date);
    const existing = this.store.get(key) ?? {};
    existing[needId] = value;
    this.store.set(key, existing);
  }

  // For debugging / retrieval in the future
  getRatings(userId: number, date?: string) {
    return this.store.get(this.keyFor(userId, date ?? undefined)) ?? {};
  }
}

