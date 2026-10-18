// @vitest-environment jsdom
// Телефонная «Практика»: кризисный путь обязан открываться одним касанием
// (правило №7). Строка «Мне очень плохо» раскрывает на месте тот же блок
// «Помощь рядом» с настоящей tel:-ссылкой, второе касание сворачивает.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PhoneHelpRows } from './PhoneHelpRows';
import { HELP_BLOCK_ID } from './PracticeTopRow';
import { CRISIS_HOTLINE_DISPLAY, CRISIS_HOTLINE_TEL } from '../../utils/crisisMarkers';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));

afterEach(cleanup);

const crisisRow = () => screen.getByText('Мне очень плохо').closest('[role="button"]') as HTMLElement;

describe('PhoneHelpRows', () => {
  it('до касания телефоны скрыты, обе строки на месте', () => {
    render(<PhoneHelpRows onSteps={vi.fn()} />);
    expect(screen.getByText('Мне плохо')).toBeTruthy();
    expect(crisisRow().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(CRISIS_HOTLINE_DISPLAY)).toBeNull();
  });

  it('одно касание по «Мне очень плохо» открывает телефон доверия (tel:)', () => {
    render(<PhoneHelpRows onSteps={vi.fn()} />);
    fireEvent.click(crisisRow());
    expect(crisisRow().getAttribute('aria-expanded')).toBe('true');
    const link = screen.getByText(CRISIS_HOTLINE_DISPLAY).closest('a');
    expect(link?.getAttribute('href')).toBe(CRISIS_HOTLINE_TEL);
    expect(document.getElementById(HELP_BLOCK_ID)).toBeTruthy();
  });

  it('открывается и с клавиатуры, второе нажатие сворачивает блок', () => {
    render(<PhoneHelpRows onSteps={vi.fn()} />);
    fireEvent.keyDown(crisisRow(), { key: 'Enter' });
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
    fireEvent.keyDown(crisisRow(), { key: 'Enter' });
    expect(screen.queryByText(CRISIS_HOTLINE_DISPLAY)).toBeNull();
  });

  it('«Мне плохо» запускает пять шагов и не раскрывает контакты', () => {
    const onSteps = vi.fn();
    render(<PhoneHelpRows onSteps={onSteps} />);
    fireEvent.click(screen.getByText('Мне плохо'));
    expect(onSteps).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(CRISIS_HOTLINE_DISPLAY)).toBeNull();
  });
});
