// @vitest-environment jsdom
// Реестр знаков (SignArt.tsx) и таблица вида сущностей (shared/src/theme/entityLook.ts):
// у каждого ключа есть рисунок, рисунок — декор без фильтров и литеральных цветов, знак по
// ключу — тот же мотив, что в кабинете (не перерисован), незнакомый ключ — без картинки.
// Размеры nav и scene — классы paper.css (CSS в jsdom не исполняется — читаем исходник,
// приём styles/safeTop.test.ts). Сверки с таблицами webapp, которых shared не видит:
// достижения профиля и таблицы переноса данных.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import {
  SIGN_KEYS, ACHIEVEMENT_LOOK, DATA_KIND_ENTITY, ENTITY_LOOK, type SignKey,
} from '../../../../shared/src/theme/entityLook';
import { SignArt } from './SignArt';
import { NeedArt } from './NeedArt';
import { DomainArt } from './DomainArt';
import { Strokes } from './PaperArt';
import { GUIDE_SIGNS } from './guideSignsModel';
import { ArtFrameContext } from './paper';
import { ACHIEVEMENT_META } from '../../sections/profile/profileMeta';
import { TABLE_LABELS } from '../../utils/mergeLabels';

const PAINT_OK = (v: string) => v === 'none' || (/var\(--[a-z0-9-]+\)/.test(v) && !/#[0-9a-f]{3,8}\b|rgba?\(/i.test(v));

const draw = (sign: SignKey, size?: 'row' | 'nav' | 'scene') => {
  const { container, unmount } = render(<SignArt sign={sign} size={size} />);
  const html = container.innerHTML;
  const svgs = [...container.querySelectorAll('svg')];
  unmount();
  return { html, svgs };
};

describe('SignArt: реестр знаков по ключу', () => {
  it.each(SIGN_KEYS)('%s — один svg-декор, без фильтров, цвета токенами', (sign) => {
    const { svgs } = draw(sign, 'row');
    expect(svgs).toHaveLength(1);
    const svg = svgs[0];
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('class')).toBe('pp-art pp-art--row');
    expect(svg.querySelector('filter, [filter], image')).toBeNull();
    expect(svg.children.length).toBeGreaterThan(0);
    for (const el of svg.querySelectorAll('[fill], [stroke]')) {
      for (const attr of ['fill', 'stroke']) {
        const v = el.getAttribute(attr);
        if (v !== null) expect(PAINT_OK(v), `${sign}: ${attr}="${v}"`).toBe(true);
      }
    }
  });

  it('знаки листов подсказок — подмножество реестра (один язык у терапевта и клиента)', () => {
    for (const s of GUIDE_SIGNS) expect(SIGN_KEYS).toContain(s);
  });

  it('потребность и домен по ключу — те же мотивы NeedArt и DomainArt, не перерисованные', () => {
    const { container: need } = render(<NeedArt id="play" size="row" />);
    expect(draw('need_play', 'row').html).toBe(need.innerHTML);
    const { container: dom } = render(<DomainArt domain={4} size="row" />);
    expect(draw('domain_other_directed', 'row').html).toBe(dom.innerHTML);
    const { container: tr } = render(<Strokes size="row" />);
    expect(draw('strokes', 'row').html).toBe(tr.innerHTML);
  });

  it('незнакомый ключ (данные с сервера, старая запись) — без выдуманной картинки', () => {
    const { container } = render(<SignArt sign={'mystery' as SignKey} />);
    expect(container.innerHTML).toBe('');
  });

  it('размеры nav и scene: класс знака и его размер в paper.css', () => {
    expect(draw('leaf', 'nav').svgs[0].getAttribute('class')).toBe('pp-art pp-art--nav');
    expect(draw('strokes', 'scene').svgs[0].getAttribute('class')).toBe('pp-art pp-art--scene');
    const css = readFileSync(join(__dirname, '../../styles/paper.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(/\.pp-art--nav\s*\{\s*width:\s*24px;\s*height:\s*14px;/);
    expect(css).toMatch(/\.pp-art--scene\s*\{\s*width:\s*180px;\s*height:\s*150px;/);
  });

  it('внутри сцены (рамка) знак ложится вложенным svg рамки, без класса размера', () => {
    const { container } = render(
      <svg><ArtFrameContext.Provider value={{ x: 10, y: 20, w: 120, h: 64 }}><SignArt sign="heart" size="hero" /></ArtFrameContext.Provider></svg>,
    );
    const inner = container.querySelector('svg svg') as SVGSVGElement;
    expect(inner.getAttribute('class')).toBe('pp-art');
    expect([inner.getAttribute('x'), inner.getAttribute('y'), inner.getAttribute('width'), inner.getAttribute('height')]).toEqual(['10', '20', '120', '64']);
    expect(inner.getAttribute('viewBox')).toBe('0 0 120 64');
  });
});

describe('таблицы вида против таблиц webapp', () => {
  it('у каждого достижения профиля есть значок, лишних нет', () => {
    expect(Object.keys(ACHIEVEMENT_LOOK).sort()).toEqual(Object.keys(ACHIEVEMENT_META).sort());
  });

  it('у каждой таблицы переноса данных есть сущность, лишних нет', () => {
    expect(Object.keys(DATA_KIND_ENTITY).sort()).toEqual(Object.keys(TABLE_LABELS).sort());
  });

  it('у каждой сущности знак рисуется', () => {
    for (const [id, l] of Object.entries(ENTITY_LOOK)) expect(draw(l.sign).svgs, id).toHaveLength(1);
  });
});
