// @vitest-environment jsdom
// Шапка окон первого входа (b06-entry): лист бумаги сущности во всю ширину окна, знак — на втором
// листе (ef-art); без надписи заголовок встаёт рядом со знаком (ef-bare); сцена приветствия — над
// листом, наклейка беты читается, сама сцена скрыта от чтения; шаги — бумажками оттенков шагов.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EntryBrand, EntryHead, EntrySteps } from './EntryHead';

afterEach(cleanup);

const hueOf = (el: Element) => (el as HTMLElement).style.getPropertyValue('--h');

describe('EntryHead', () => {
  it('сущность по id: лист с её знаком, заголовок h2; без надписи — ef-bare', () => {
    const { container } = render(<EntryHead look="therapist" title="Открыть доступ терапевту?" sub="Приглашение от терапевта: Анна" />);
    const sheet = container.querySelector('.ef-head > .pa-sheet')!;
    expect(sheet.getAttribute('data-sign')).toBe('talk');
    expect(sheet.className).toContain('ef-art');
    expect(sheet.className).toContain('ef-bare');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Открыть доступ терапевту?');
    expect(screen.getByText('Приглашение от терапевта: Анна')).toBeTruthy();
  });

  it('с надписью шага — обычный лист: надпись в строке знака, заголовок под ней', () => {
    const { container } = render(<EntryHead look={{ hue: 240, sign: 'limits' }} label="Шаг 2 из 3" title="Данные" />);
    const sheet = container.querySelector('.ef-head > .pa-sheet')!;
    expect(sheet.className).not.toContain('ef-bare');
    expect(hueOf(sheet)).toBe('240');
    expect(screen.getByText('Шаг 2 из 3').className).toContain('ds-label');
  });

  it('слово длиннее колонки рядом со знаком — ef-long (знак над заголовком на 320), короткие — без него', () => {
    const { container, rerender } = render(<EntryHead look="pair" title="Присоединиться к паре?" />);
    const sheet = () => container.querySelector('.ef-head > .pa-sheet')!;
    expect(sheet().className).toContain('ef-long');
    rerender(<EntryHead look={{ hue: 70 }} title="Поддержать проект" />);
    expect(sheet().className).not.toContain('ef-long');
  });

  it('сцена над листом: та же бумага, сцена скрыта от чтения, наклейка — текст; лист без знака', () => {
    const { container } = render(
      <EntryHead look={{ hue: 45 }} title="Всё по схеме" scene={{ art: <svg data-testid="art" />, hue: 45, sticker: 'БЕТА-ВЕРСИЯ' }} />,
    );
    const strip = container.querySelector('.ef-head-scene')!;
    expect(hueOf(strip)).toBe('45');
    expect(strip.querySelector('.ef-head-scene-art')!.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('БЕТА-ВЕРСИЯ').closest('[aria-hidden]')).toBeNull();
    const sheet = container.querySelector('.ef-head > .pa-sheet')!;
    expect(sheet.className).toContain('pa-sheet--plain');
    expect(hueOf(sheet)).toBe('45');
  });

  it('своя картинка (знак продукта) вместо знака сущности — в углу листа, скрыта от чтения', () => {
    const { container } = render(<EntryHead look={{ hue: 70 }} art={<EntryBrand />} title="Поддержать проект" />);
    const art = container.querySelector('.pa-sheet-art')!;
    expect(art.getAttribute('aria-hidden')).toBe('true');
    expect(art.querySelector('[data-brand-mark]')).not.toBeNull();
    expect(container.querySelector('.pa-sheet')!.className).toContain('pa-sheet--scene');
  });
});

describe('EntrySteps', () => {
  it('пройденные — is-done, текущий — is-on, впереди — без класса; каждый своей бумаги, декор скрыт', () => {
    const { container } = render(<EntrySteps hues={[45, 240, 135]} at={1} />);
    const row = container.querySelector('.ef-steps')!;
    expect(row.getAttribute('aria-hidden')).toBe('true');
    const marks = Array.from(row.children);
    expect(marks.map((m) => m.className)).toEqual(['is-done', 'is-on', '']);
    expect(marks.map(hueOf)).toEqual(['45', '240', '135']);
  });
});
