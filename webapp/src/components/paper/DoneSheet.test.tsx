// @vitest-environment jsdom
// «Лист готово» (редизайн 2026-11): сцена «готово» сущности из ENTITY_LOOK (экран её не выбирает),
// бумага сущности или своя, одна залитая кнопка и тихая ссылка, кризисная карточка — отдельным
// листом над «готово». Сцена — декор, по контракту сцен.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { DoneSheet } from './DoneSheet';
import { expectSceneContract } from '../art/sceneContract.test-helpers';

afterEach(cleanup);

const base = { label: 'Записано', title: 'Готово', primary: { label: 'На главную', onClick: () => {} } };

describe('DoneSheet', () => {
  it('бумага сущности, надпись, заголовок, подпись; одна залитая кнопка зовёт primary', () => {
    const onClick = vi.fn();
    const { container } = render(<DoneSheet entity="belief_check" {...base} sub="Весы легли ровнее" primary={{ label: 'На главную', onClick }} />);
    const sheet = container.querySelector('.pa-done-sheet') as HTMLElement;
    expect(sheet.className).toBe('pp-paper pa-done-sheet');
    expect(sheet.style.getPropertyValue('--h')).toBe(String(ENTITY_LOOK.belief_check.hue));
    expect(screen.getByText('Записано').className).toContain('ds-label');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Готово');
    expect(screen.getByText('Весы легли ровнее')).toBeTruthy();
    expect(container.querySelectorAll('.ds-btn').length).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'На главную' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('сцена «готово» — из ENTITY_LOOK: Sprout со знаком сущности на её бумаге', () => {
    const { container } = render(<DoneSheet entity="letter" {...base} />);
    const scene = container.querySelector('.pa-done-scene svg.scn') as SVGElement;
    expect(scene).toBeTruthy();
    expect(scene.style.getPropertyValue('--h')).toBe(String(ENTITY_LOOK.letter.hue));
    expect(container.querySelector('.pa-done-scene')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('трекер: лист дня в серии по реальным дням; своя бумага листа', () => {
    const { container } = render(<DoneSheet entity="tracker" hue={135} days={3} {...base} />);
    expect((container.querySelector('.pa-done-sheet') as HTMLElement).style.getPropertyValue('--h')).toBe('135');
    expect(container.querySelector('.pa-done-scene svg.scn')).toBeTruthy();
  });

  it('своя сцена экрана вместо сцены сущности; у сущности без «готово» сцены нет', () => {
    const { container, rerender } = render(<DoneSheet entity="case" {...base} scene={<svg data-testid="found" />} />);
    expect(container.querySelector('.pa-done-scene [data-testid="found"]')).toBeTruthy();
    expect(container.querySelector('svg.scn')).toBeNull();
    rerender(<DoneSheet entity="note" {...base} />);
    expect(container.querySelector('.pa-done-scene')).toBeNull();
    expect(container.querySelector('.pa-done-sheet')?.firstElementChild?.className).toContain('pa-done-label');
  });

  it('кризисная карточка — над листом, отдельно; тихая ссылка — кнопка ds-link', () => {
    const onSecondary = vi.fn();
    const { container } = render(
      <DoneSheet entity="diary" {...base} crisis={<div data-testid="crisis" />} secondary={{ label: 'Ещё запись', onClick: onSecondary }} />,
    );
    const root = container.firstElementChild!;
    expect(root.firstElementChild?.className).toBe('pa-done-crisis');
    expect(root.firstElementChild?.querySelector('[data-testid="crisis"]')).toBeTruthy();
    const link = screen.getByRole('button', { name: 'Ещё запись' });
    expect(link.className).toContain('ds-link');
    fireEvent.click(link);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('сцена сущности держит контракт сцен (декор, тень слоем, токены)', () => {
    expectSceneContract(<DoneSheet entity="safe_place" {...base} />);
  });
});
