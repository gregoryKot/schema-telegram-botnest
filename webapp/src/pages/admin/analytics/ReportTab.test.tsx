// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ReportTab } from './ReportTab';

vi.mock('./analyticsApi', () => ({ analyticsApi: { sections: vi.fn(), section: vi.fn() } }));
import { analyticsApi } from './analyticsApi';
const sections = analyticsApi.sections as unknown as ReturnType<typeof vi.fn>;
const section = analyticsApi.section as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => { sections.mockReset(); section.mockReset(); });
afterEach(cleanup);

describe('ReportTab', () => {
  it('список разделов, текст первого грузится, выбор другого подгружает его', async () => {
    sections.mockResolvedValue([{ id: 'a', title: 'Люди' }, { id: 'b', title: 'Деньги' }]);
    section.mockImplementation(async (_k: string, id: string) => ({ id, title: id, text: id === 'a' ? '<b>Всего</b> 1 &lt; 2' : 'второй' }));
    const { container } = render(<ReportTab adminKey="k" />);
    expect(container.querySelector('.skel')).toBeTruthy();
    expect(await screen.findByText('Всего')).toBeTruthy();
    expect(container.textContent).toContain('1 < 2');
    expect(section).toHaveBeenCalledWith('k', 'a');
    fireEvent.click(screen.getByRole('button', { name: 'Деньги' }));
    expect(await screen.findByText('второй')).toBeTruthy();
  });
  it('нет разделов — «Пока нет данных»', async () => {
    sections.mockResolvedValue([]);
    render(<ReportTab adminKey="k" />);
    expect(await screen.findByText('Пока нет данных')).toBeTruthy();
  });
  it('ошибка текста раздела — «Повторить»', async () => {
    sections.mockResolvedValue([{ id: 'a', title: 'Люди' }]);
    section.mockRejectedValueOnce(new Error('Не удалось загрузить данные'));
    render(<ReportTab adminKey="k" />);
    expect(await screen.findByRole('button', { name: 'Повторить' })).toBeTruthy();
  });
});
