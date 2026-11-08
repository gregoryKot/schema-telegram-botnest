// @vitest-environment jsdom
// Листы схем, режимов, YSQ и портрета — слот героя (редизайн 2026-11): SsHead с look рисует лист
// бумаги сущности (EntitySheet), SsSheet кладёт героя над содержимым или, со spread, в боковую
// колонку разворота. Без look/hero/spread разметка прежняя — листы переходят по одному.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { domainLook, modeGroupLook } from '../../../../shared/src/theme/entityLook';
import { SsSheet, SsHead } from './SsSheet';

afterEach(cleanup);

describe('SsHead', () => {
  it('без look — прежняя шапка ss-head с заголовком ss-title', () => {
    const { container } = render(<SsHead eyebrow="Схема" title="Покинутость" lede="Ожидание ухода" layers />);
    expect(container.querySelector('.ss-head .ss-title-row h1.ss-title')?.textContent).toBe('Покинутость');
    expect(container.querySelector('.pa-sheet')).toBeNull();
  });

  it('look домена — лист бумаги домена со знаком домена; h1, надпись, подводка и строка данных', () => {
    const look = domainLook('rejection')!;
    const { container } = render(<SsHead look={look} eyebrow="Схема · домен 1" title="Покинутость" lede="Ожидание ухода" meta="Выражена" />);
    const sheet = container.querySelector('.pa-sheet.ss-hero') as HTMLElement;
    expect(sheet.style.getPropertyValue('--h')).toBe(String(look.hue));
    expect(sheet.getAttribute('data-sign')).toBe('domain_rejection');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Покинутость');
    expect(sheet.querySelector('.pa-sheet-meta')?.textContent).toBe('Выражена');
    expect(container.querySelector('.ss-head')).toBeNull();
  });

  it('look группы режима — знак группы', () => {
    const { container } = render(<SsHead look={modeGroupLook('critic')} title="Карающий Критик" />);
    expect(container.querySelector('.pa-sheet')?.getAttribute('data-sign')).toBe('looming');
  });
});

describe('SsSheet — слот героя', () => {
  it('без hero и spread — тело прежнее: дети прямо в ss-inner', () => {
    const { container } = render(<SsSheet onBack={vi.fn()}><p>тело</p></SsSheet>);
    const inner = container.querySelector('.ss-inner')!;
    expect(inner.className).toBe('ss-inner');
    expect(inner.firstElementChild?.tagName).toBe('P');
  });

  it('hero — над содержимым в той же колонке', () => {
    const { container } = render(<SsSheet onBack={vi.fn()} narrow hero={<SsHead look="ysq" title="Опросник" />}><p>тело</p></SsSheet>);
    const inner = container.querySelector('.ss-inner')!;
    expect(inner.className).toBe('ss-inner ss-inner--narrow');
    expect(inner.firstElementChild?.classList.contains('pa-sheet')).toBe(true);
    expect(inner.lastElementChild?.tagName).toBe('P');
  });

  it('spread — разворот: герой в боковой колонке, содержимое в основной', () => {
    const { container } = render(<SsSheet onBack={vi.fn()} spread hero={<SsHead look="ysq" title="Опросник" />}><p>тело</p></SsSheet>);
    const inner = container.querySelector('.ss-inner.ss-inner--spread')!;
    const [side, main] = [...inner.querySelector('.pa-spread')!.children];
    expect(side.querySelector('.pa-sheet')).toBeTruthy();
    expect(main.textContent).toBe('тело');
  });
});
