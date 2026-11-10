// @vitest-environment jsdom
// Тест CTA «разобраться глубже» в результатах теста схем
// (components/ysq/YsqTherapyCta). Проверяем связку: рендер в вы-форме,
// ссылка на практику, клик зовёт onLinkClick (правило №8 — трекинг
// practice_link_click place 'ysq_result' навешивают обёртки фронтендов).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { YsqTherapyCta } from './YsqTherapyCta';
import type { ContactCta } from '../../../../shared/src/utils/therapistContact';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';

const CTA: ContactCta = {
  isSelf: false,
  label: 'Записаться на консультацию →',
  url: 'https://kotlarewski.gr/#booking',
};

const trVy = (_ty: string, vy: string) => vy;

afterEach(() => cleanup());

describe('YsqTherapyCta', () => {
  it('рендерит вы-форму заголовка и метку ссылки', () => {
    render(<YsqTherapyCta cta={CTA} tr={trVy} onLinkClick={() => {}} />);
    expect(screen.getByText('Хотите разобраться глубже?')).toBeTruthy();
    expect(screen.getByText('Записаться на консультацию →')).toBeTruthy();
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

  it('лист — бумага терапевта из ENTITY_LOOK, а не свой литерал (ревью g5 r1)', () => {
    const { container } = render(<YsqTherapyCta cta={CTA} tr={trVy} onLinkClick={() => {}} />);
    const sheet = container.querySelector<HTMLElement>('.ss-deep')!;
    expect(sheet.style.getPropertyValue('--h')).toBe(String(ENTITY_LOOK.therapist.hue));
  });
});
