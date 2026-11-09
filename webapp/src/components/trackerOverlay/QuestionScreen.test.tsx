// @vitest-environment jsdom
// Вопрос трекера на листе потребности (редизайн 2026-11, APP_2026-11.md, b07): лист — бумага
// и знак самой потребности, а не мотив размером строки рядом с заголовком; сбой сохранения —
// в колонке ответов, а не у края окна (раньше SaveErrorNote был сиблингом колонки).
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuestionScreen } from './QuestionScreen';
import { NEED_HUE } from '../../../../shared/src/theme/entityHue';
import { NEED_DATA_PAPER } from '../art/paper';
import type { NeedExtra } from '../../../../shared/src/needs/types';

const DATA = {
  name: 'Спонтанность', short: 'Спонт.', desc: 'Игра и лёгкость', question: 'Было ли сегодня место игре?',
  examples: ['Смеялся с другом'], ranges: [],
} as unknown as NeedExtra;

const renderQ = (alert?: React.ReactNode) => render(
  <QuestionScreen
    idx={3} total={5} name="Спонтанность" needId="play" data={DATA} value={0} hue={NEED_HUE.play}
    caption="10 июля" showOriginNote={false} alert={alert} onAnswer={vi.fn()} onMore={vi.fn()}
  />,
);

describe('QuestionScreen — лист потребности', () => {
  it('название — заголовок h1 на листе бумаги потребности с её знаком', () => {
    const { container } = renderQ();
    const h1 = screen.getByRole('heading', { level: 1, name: 'Спонтанность' });
    const sheet = h1.closest('.pa-sheet') as HTMLElement;
    expect(sheet.classList.contains('pp-paper')).toBe(true);
    expect(sheet.style.getPropertyValue('--h')).toBe(String(NEED_HUE.play));
    expect(sheet.getAttribute('data-sign')).toBe('need_play');
    expect(sheet.querySelector('.pa-sheet-art svg')).not.toBeNull();
    expect(container.querySelector('.pp-art--row')).toBeNull(); // мотива размером строки больше нет
  });

  it('надпись листа — номер и дата дооценки; описание и примеры — на том же листе', () => {
    renderQ();
    expect(screen.getByText('Потребность 4 из 5 · 10 июля')).toBeTruthy();
    const sheet = screen.getByRole('heading', { level: 1 }).closest('.pa-sheet') as HTMLElement;
    expect(sheet.querySelector('.tq-desc')?.textContent).toBe('Игра и лёгкость');
    expect(sheet.querySelector('details.tq-examples')).not.toBeNull();
  });

  it('вопрос и ответы — в колонке разворота, сбой — там же, над ответами', () => {
    renderQ(<p role="alert">не сохранилась</p>);
    const main = document.querySelector('.pa-spread-main') as HTMLElement;
    const alert = screen.getByRole('alert');
    const group = screen.getByRole('group', { name: 'Спонтанность' });
    expect(main.contains(alert) && main.contains(group)).toBe(true);
    expect(alert.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('шкала берёт цвет данных потребности', () => {
    renderQ();
    const group = screen.getByRole('group', { name: 'Спонтанность' }) as HTMLElement;
    expect(group.style.getPropertyValue('--nd')).toBe(NEED_DATA_PAPER[3]);
  });
});
