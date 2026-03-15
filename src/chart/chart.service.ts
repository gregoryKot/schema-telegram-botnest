import { Injectable } from '@nestjs/common';
import { Need, NeedId } from '../bot/bot.service';

const QUICKCHART_URL = 'https://quickchart.io/chart';

const COLORS: Record<NeedId, { bg: string; border: string }> = {
  attachment: { bg: 'rgba(255, 107, 157, 0.75)', border: '#FF6B9D' },
  autonomy:   { bg: 'rgba(79, 172, 254, 0.75)',  border: '#4FACFE' },
  expression: { bg: 'rgba(255, 217, 61, 0.75)',  border: '#FFD93D' },
  play:       { bg: 'rgba(107, 203, 119, 0.75)', border: '#6BCB77' },
  limits:     { bg: 'rgba(199, 125, 255, 0.75)', border: '#C77DFF' },
};

@Injectable()
export class ChartService {
  async generateRadarChart(
    needs: Need[],
    ratings: Partial<Record<NeedId, number>>,
  ): Promise<Buffer> {
    const labels = needs.map((n) => n.chartLabel.replace('\n', ' '));
    const data = needs.map((n) => ratings[n.id] ?? 0);

    const config = {
      type: 'polarArea',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: needs.map((n) => COLORS[n.id].bg),
          borderColor: needs.map((n) => COLORS[n.id].border),
          borderWidth: 2,
        }],
      },
      options: {
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: '#333',
              font: { size: 13, weight: 'bold' },
              padding: 20,
            },
          },
        },
        scales: {
          r: {
            min: 0,
            max: 10,
            ticks: {
              stepSize: 2,
              color: '#aaa',
              backdropColor: 'transparent',
              font: { size: 10 },
            },
            grid: { color: 'rgba(0,0,0,0.07)' },
            angleLines: { color: 'rgba(0,0,0,0.07)' },
          },
        },
      },
    };

    const response = await fetch(QUICKCHART_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backgroundColor: 'white', width: 600, height: 600, chart: config }),
    });

    if (!response.ok) {
      throw new Error(`QuickChart API error: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}
