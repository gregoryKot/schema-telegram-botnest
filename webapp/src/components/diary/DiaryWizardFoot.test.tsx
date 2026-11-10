// @vitest-environment jsdom
// Подвал мастеров дневников — одна строка (редизайн 2026-11, APP_2026-11.md, b10b): на 390 ряд
// «Назад / Сохранить / Дальше» переносил «Дальше» под «Назад», и главная кнопка вставала ниже
// второстепенных. CSS в jsdom не считается — порядок кнопок сверяем разметкой, раскладку —
// исходником diary-wizard.css (без переноса; уже 560 «Назад» — круг 44, главная — на остаток).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DiaryWizardFoot } from './DiaryWizardFoot';

afterEach(cleanup);

const css = readFileSync(join(__dirname, '../../styles/diary-wizard.css'), 'utf8');
const rule = (src: string, sel: string) => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return src.match(new RegExp(`(?:^|\\n|,\\s*)\\s*${esc}\\s*(?:,[^{]*)?\\{([^}]*)\\}`))?.[1] ?? '';
};
const narrow = css.slice(css.indexOf('@media (max-width: 559px)'));

const base = {
  onBack: vi.fn(), canSave: true, isLast: false, saving: false, onSave: vi.fn(),
  curFilled: true, curRequired: false, onNext: vi.fn(),
};

describe('DiaryWizardFoot — подвал мастера в одну строку', () => {
  it('порядок: «Назад», ранний «Сохранить», главная последней', () => {
    const { container } = render(<DiaryWizardFoot {...base} />);
    const buttons = [...container.querySelectorAll('.sd-wfoot > button')];
    expect(buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim())).toEqual(['Назад', 'Сохранить', 'Дальше']);
    expect(buttons[2].className).toContain('sd-wfoot-next');
    expect(buttons[2].className).not.toContain('ds-btn--secondary');
  });

  it('«Назад» называется подписью экрана и на узком экране, где видна только стрелка', () => {
    const onBack = vi.fn();
    render(<DiaryWizardFoot {...base} onBack={onBack} backLabel="К режимам" />);
    fireEvent.click(screen.getByRole('button', { name: 'К режимам' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('последний шаг — «Сохранить запись» главной, без раннего «Сохранить»', () => {
    render(<DiaryWizardFoot {...base} isLast />);
    expect(screen.getByText('Сохранить запись')).toBeTruthy();
    expect(screen.queryByText('Сохранить')).toBeNull();
  });

  it('ряд не переносится; уже 560 «Назад» — круг 44, главная забирает остаток', () => {
    expect(rule(css, '.sd-wfoot')).toMatch(/flex-wrap:\s*nowrap/);
    expect(rule(narrow, '.ds-btn.sd-wfoot-back')).toMatch(/width:\s*44px/);
    expect(rule(narrow, '.sd-wfoot-back-label')).toMatch(/display:\s*none/);
    expect(rule(narrow, '.ds-btn.sd-wfoot-next')).toMatch(/flex:\s*1 1 auto/);
  });
});
