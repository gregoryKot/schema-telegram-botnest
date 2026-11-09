// @vitest-environment jsdom
// Знаки рамки (b04, docs/design/APP_2026-11.md «Меню, ⌘K»): пункт меню несёт знак сущности своего
// раздела по ENTITY_LOOK; в главном чанке — литералы (navLook.ts) и подмножество реестра (NavSign.tsx),
// поэтому сверка двух мест — здесь (правило №4): ключ раздела = знак сущности, рисунок NavSign = SignArt.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { SignArt } from '../art/SignArt';
import { NAV_ART, NavSign, type NavSignKey } from './NavSign';
import { SECTION_LOOK, THERAPIST_NAV } from './navLook';
import { DESKTOP_NAV_ITEMS, MOBILE_NAV_ITEMS } from './navItems';
import { LIST_TASKS_PATH } from '../therapist/clientTabRoute';

describe('navLook — знак раздела = знак его сущности', () => {
  it.each(Object.entries(SECTION_LOOK))('%s: знак — ENTITY_LOOK[%s]', (_, look) => {
    expect(look.sign).toBe(ENTITY_LOOK[look.entity].sign);
  });

  it('у каждого пункта меню компьютера и телефона есть знак', () => {
    for (const i of [...DESKTOP_NAV_ITEMS, ...MOBILE_NAV_ITEMS]) expect(NAV_ART[SECTION_LOOK[i.id].sign]).toBeTruthy();
  });

  it('разные разделы меню — разные знаки (иначе знак не различает пункты)', () => {
    const signs = DESKTOP_NAV_ITEMS.map(i => SECTION_LOOK[i.id].sign);
    expect(new Set(signs).size).toBe(signs.length);
  });

  it('«Практики» — дыхание, а не сердце: Heart значит «Мне плохо» (аудит 2026-11)', () => {
    expect(SECTION_LOOK.practice.sign).toBe('breath');
    expect(Object.values(SECTION_LOOK).map(l => l.sign)).not.toContain('heart');
  });

  it('кабинет: Сегодня — Talk, Справочник — Layers, доска «Задания» — Check, клиенты — Cluster (решение 9)', () => {
    expect(Object.values(THERAPIST_NAV).map(i => [i.to, i.sign])).toEqual([
      ['/cabinet/today', 'talk'], ['/cabinet/guide', 'layers'], [LIST_TASKS_PATH, 'check'], ['/cabinet', 'cluster'],
    ]);
    expect(THERAPIST_NAV.clients.end).toBe(true); // «Все клиенты» не горит на доске
  });
});

describe('NavSign — тот же рисунок, что SignArt по тому же ключу', () => {
  it.each(Object.keys(NAV_ART) as NavSignKey[])('%s', (sign) => {
    const own = render(<NavSign sign={sign} />).container.innerHTML;
    const ref = render(<SignArt sign={sign} size="nav" />).container.innerHTML;
    expect(own).toBe(ref);
    expect(own).toContain('pp-art--nav');
  });
});
