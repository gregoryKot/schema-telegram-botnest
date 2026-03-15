import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { Need, NeedId } from '../bot/bot.service';

const COLORS: Record<NeedId, string> = {
  attachment: '#FF6B9D',
  autonomy:   '#4FACFE',
  expression: '#FFD93D',
  play:       '#6BCB77',
  limits:     '#C77DFF',
};

const SIZE = 600;
const CX = SIZE / 2;
const CY = SIZE / 2;
const MAX_R = 195;
const LEVELS = 5;
const FONT = 'Liberation Sans, DejaVu Sans, Arial, sans-serif';

@Injectable()
export class ChartService {
  async generateRadarChart(
    needs: Need[],
    ratings: Partial<Record<NeedId, number>>,
  ): Promise<Buffer> {
    const svg = this.buildSvg(needs, ratings);
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private buildSvg(needs: Need[], ratings: Partial<Record<NeedId, number>>): string {
    const n = needs.length;
    const angles = needs.map((_, i) => (i * 2 * Math.PI) / n - Math.PI / 2);
    const pt = (a: number, r: number) => ({ x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) });
    const f = (v: number) => v.toFixed(2);

    // Sector backgrounds — цвет + прозрачность от значения
    const halfStep = Math.PI / n;
    const sectors = needs.map((need, i) => {
      const value = ratings[need.id] ?? 0;
      const opacity = (0.08 + (value / 10) * 0.22).toFixed(2);
      const a1 = angles[i] - halfStep;
      const a2 = angles[i] + halfStep;
      const p1 = pt(a1, MAX_R);
      const p2 = pt(a2, MAX_R);
      return `<path d="M ${f(CX)} ${f(CY)} L ${f(p1.x)} ${f(p1.y)} A ${MAX_R} ${MAX_R} 0 0 1 ${f(p2.x)} ${f(p2.y)} Z" fill="${COLORS[need.id]}" opacity="${opacity}"/>`;
    }).join('');

    // Сетка — концентрические круги
    const grid = Array.from({ length: LEVELS }, (_, l) => {
      const r = ((l + 1) / LEVELS) * MAX_R;
      return `<circle cx="${CX}" cy="${CY}" r="${f(r)}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
    }).join('');

    // Подписи уровней (2, 4, 6, 8, 10)
    const gridLabels = Array.from({ length: LEVELS }, (_, l) => {
      const r = ((l + 1) / LEVELS) * MAX_R;
      return `<text x="${f(CX + 5)}" y="${f(CY - r + 11)}" font-family="${FONT}" font-size="9" fill="rgba(255,255,255,0.25)">${(l + 1) * 2}</text>`;
    }).join('');

    // Оси
    const axes = angles.map(a => {
      const p = pt(a, MAX_R);
      return `<line x1="${f(CX)}" y1="${f(CY)}" x2="${f(p.x)}" y2="${f(p.y)}" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`;
    }).join('');

    // Polygon данных
    const dataPoints = needs.map((need, i) => {
      const value = ratings[need.id] ?? 0;
      return pt(angles[i], (value / 10) * MAX_R);
    });
    const polyPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(p.x)} ${f(p.y)}`).join(' ') + ' Z';
    const polygon = `<path d="${polyPath}" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.65)" stroke-width="2.5" stroke-linejoin="round"/>`;

    // Точки на осях
    const dots = needs.map((need, i) => {
      const value = ratings[need.id];
      if (!value) return '';
      const p = dataPoints[i];
      return `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="5.5" fill="${COLORS[need.id]}" stroke="rgba(255,255,255,0.9)" stroke-width="2"/>`;
    }).join('');

    // Подписи потребностей
    const LABEL_R = MAX_R + 42;
    const labels = needs.map((need, i) => {
      const p = pt(angles[i], LABEL_R);
      const color = COLORS[need.id];
      const lines = need.chartLabel.split('\n');
      const lh = 16;
      const startY = p.y - ((lines.length - 1) * lh) / 2;
      return lines.map((line, li) =>
        `<text x="${f(p.x)}" y="${f(startY + li * lh)}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT}" font-size="12" font-weight="bold" fill="${color}">${line}</text>`
      ).join('');
    }).join('');

    // Дата
    const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const dateLabel = `<text x="${CX}" y="${SIZE - 14}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="rgba(255,255,255,0.2)">${today}</text>`;

    // Заголовок
    const title = `<text x="${CX}" y="24" text-anchor="middle" font-family="${FONT}" font-size="13" fill="rgba(255,255,255,0.35)" letter-spacing="2">КОЛЕСО ПОТРЕБНОСТЕЙ</text>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${SIZE}" height="${SIZE}" fill="#0f0f1a" rx="20"/>
  ${title}
  ${sectors}
  ${grid}
  ${axes}
  ${polygon}
  ${dots}
  ${labels}
  ${gridLabels}
  ${dateLabel}
</svg>`;
  }
}
