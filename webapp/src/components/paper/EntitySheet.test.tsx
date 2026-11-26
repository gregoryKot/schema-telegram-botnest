// @vitest-environment jsdom
// Лист-герой сущности и разворот (редизайн 2026-11): вид берётся из ENTITY_LOOK по id или
// готовым видом (домен, группа режима), знак — тот же мотив по ключу с тенью-вырезкой, декор
// скрыт от чтения с экрана; разворот кладёт лист в боковую колонку, форму — в основную.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ENTITY_LOOK, domainLook } from '../../../../shared/src/theme/entityLook';
import { EntitySheet } from './EntitySheet';
import { SpreadLayout } from './SpreadLayout';

afterEach(cleanup);

const hueOf = (el: Element) => (el as HTMLElement).style.getPropertyValue('--h');

describe('EntitySheet', () => {
  it('по id сущности: бумага и знак из ENTITY_LOOK, надпись, заголовок и подпись на месте', () => {
    const { container } = render(<EntitySheet look="case" label="Разбор" title="Что случилось?" sub="Пара минут" />);
    const sheet = container.firstElementChild!;
    expect(sheet.className).toBe('pp-paper pa-sheet');
    expect(hueOf(sheet)).toBe(String(ENTITY_LOOK.case.hue));
    expect(sheet.getAttribute('data-sign')).toBe(ENTITY_LOOK.case.sign);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Что случилось?');
    expect(screen.getByText('Разбор').className).toContain('ds-label');
    expect(screen.getByText('Пара минут').className).toBe('pa-sheet-sub');
  });

  it('знак — крупно с тенью-вырезкой (два слоя одного мотива), вся картинка скрыта от чтения', () => {
    const { container } = render(<EntitySheet look="tracker" title="Как ты сегодня?" />);
    const art = container.querySelector('.pa-sheet-art')!;
    expect(art.getAttribute('aria-hidden')).toBe('true');
    const layers = art.querySelectorAll('.scn-sign > svg.pp-art');
    expect(layers.length).toBe(2);
    expect(layers[0].innerHTML).toBe(layers[1].innerHTML);
  });

  it('готовый вид (домен схемы) и h1 для героя потока', () => {
    const look = domainLook('rejection')!;
    const { container } = render(<EntitySheet look={look} title="Покинутость" titleAs="h1" />);
    expect(hueOf(container.firstElementChild!)).toBe(String(look.hue));
    expect(container.firstElementChild!.getAttribute('data-sign')).toBe('domain_rejection');
    expect(screen.getByRole('heading', { level: 1 }).className).toBe('pa-sheet-title');
  });

  it('своя сцена вместо знака (pa-sheet--scene: на узком листе — в угол, крупнее знака); compact — класс шага; meta и дети — в теле листа', () => {
    const { container } = render(
      <EntitySheet look="tracker" title="Автономия" compact art={<svg className="scn" data-testid="scene" />} meta="Шаг 2 из 5">
        <button type="button">Ответ</button>
      </EntitySheet>,
    );
    const sheet = container.firstElementChild!;
    expect(sheet.className).toBe('pp-paper pa-sheet pa-sheet--compact pa-sheet--scene');
    expect(sheet.hasAttribute('data-sign')).toBe(false);
    expect(container.querySelector('.pa-sheet-art [data-testid="scene"]')).toBeTruthy();
    expect(container.querySelector('.scn-sign')).toBeNull();
    expect(container.querySelector('.pa-sheet-body .pa-sheet-meta')?.textContent).toBe('Шаг 2 из 5');
    expect(container.querySelector('.pa-sheet-body button')?.textContent).toBe('Ответ');
  });

  it('вид без знака и без сцены — лист без картинки, ничего не выдумано', () => {
    const { container } = render(<EntitySheet look={{ hue: 70 }} title="Вход" />);
    expect(container.firstElementChild!.className).toContain('pa-sheet--plain');
    expect(container.querySelector('.pa-sheet-art')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('SpreadLayout', () => {
  it('лист — в боковой колонке, форма — в основной, в этом порядке (на узком экране лист сверху)', () => {
    const { container } = render(
      <SpreadLayout side={<EntitySheet look="tracker" title="Трекер" />} className="tq-spread">
        <textarea aria-label="Ответ" />
      </SpreadLayout>,
    );
    const root = container.firstElementChild!;
    expect(root.className).toBe('pa-spread tq-spread');
    const [side, main] = [...root.children];
    expect(side.className).toBe('pa-spread-side');
    expect(side.querySelector('.pa-sheet')).toBeTruthy();
    expect(main.className).toBe('pa-spread-main');
    expect(main.contains(screen.getByLabelText('Ответ'))).toBe(true);
  });
});
