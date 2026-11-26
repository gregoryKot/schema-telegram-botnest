// @vitest-environment jsdom
// Полный список режимов (ModeGroupList — дневник режимов, «другие режимы» разбора, мастер из ⌘K):
// группа — общий лист SignGroup со знаком группы у подписи, как в «Справочнике» (APP_2026-11.md,
// принцип 10), а не своя копия шапки sd-group-*; без цветных точек; выбранная строка помечена.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeGroupList } from './ModeGroupList';
import { MODE_GROUPS } from '../../schemaTherapyData';
import { modeGroupLook } from '../../../../shared/src/theme/entityLook';
import { glue } from '../../../../shared/src/utils/typo';

afterEach(cleanup);

describe('ModeGroupList', () => {
  it('каждая группа — лист SignGroup: бумага и знак своей группы у подписи, строки в его белом списке', () => {
    const { container } = render(<ModeGroupList modeId="" onPick={vi.fn()} />);
    const groups = [...container.querySelectorAll<HTMLElement>('.sd-groups > .sg-group')];
    expect(groups).toHaveLength(MODE_GROUPS.length);
    groups.forEach((g, i) => {
      expect(g.className).toBe('pp-paper sg-group');
      expect(g.style.getPropertyValue('--h')).toBe(String(modeGroupLook(MODE_GROUPS[i].id).hue));
      expect(g.querySelector('h3.sg-head > .sg-sign svg')).not.toBeNull();
      expect(g.querySelector('.sg-head .sg-name')?.textContent).toBe(glue(MODE_GROUPS[i].group));
      expect(g.querySelectorAll('.sg-rows > .sd-mode-card')).toHaveLength(MODE_GROUPS[i].items.length);
    });
    expect(container.querySelector('[class*="sd-group-"], .ds-dot, .identity-dot')).toBeNull();
  });

  it('тап по строке выбирает режим; выбранная строка — is-selected', () => {
    const onPick = vi.fn();
    render(<ModeGroupList modeId="punitive_critic" onPick={onPick} />);
    expect(screen.getByText('Карающий Критик').closest('.sd-mode-card')?.className).toContain('is-selected');
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    expect(onPick).toHaveBeenCalledWith('vulnerable_child');
  });
});
