// @vitest-environment jsdom
// Тест общего CTA «разобраться глубже» в результатах теста схем
// (shared/src/components/YsqTherapyCta). Проверяем связку: рендер в вы-форме,
// ссылка на практику, клик зовёт onLinkClick (правило №8 — трекинг
// practice_link_click place 'ysq_result' навешивают обёртки фронтендов).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { YsqTherapyCta } from '../../../shared/src/components/YsqTherapyCta';
import type { ContactCta } from '../../../shared/src/utils/therapistContact';

const CTA: ContactCta = {
  isSelf: false,
  label: 'Поговорить с психологом →',
  url: 'https://kotlarewski.gr/#booking',
};

const trVy = (_ty: string, vy: string) => vy;

afterEach(() => cleanup());

describe('YsqTherapyCta', () => {
  it('рендерит вы-форму заголовка и метку ссылки', () => {
    render(<YsqTherapyCta cta={CTA} tr={trVy} onLinkClick={() => {}} />);
    expect(screen.getByText('Хотите разобраться глубже?')).toBeTruthy();
    expect(screen.getByText('Поговорить с психологом →')).toBeTruthy();
  });

  it('ссылка ведёт на сайт практики и открывается в новой вкладке', () => {
    render(<YsqTherapyCta cta={CTA} tr={trVy} onLinkClick={() => {}} />);
    const link = screen.getByRole('link') as HTMLAnchorElement;
    expect(link.href).toBe('https://kotlarewski.gr/#booking');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });

  it('клик по ссылке зовёт onLinkClick (трекинг перехода)', () => {
    const onLinkClick = vi.fn();
    render(<YsqTherapyCta cta={CTA} tr={trVy} onLinkClick={onLinkClick} />);
    fireEvent.click(screen.getByRole('link'));
    expect(onLinkClick).toHaveBeenCalledTimes(1);
  });

  it('ты-форма: заголовок в ты-варианте', () => {
    const trTy = (ty: string) => ty;
    render(<YsqTherapyCta cta={CTA} tr={trTy} onLinkClick={() => {}} />);
    expect(screen.getByText('Хочешь разобраться глубже?')).toBeTruthy();
  });
});
