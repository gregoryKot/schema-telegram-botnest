// @vitest-environment jsdom
// Полный список режимов (ModeGroupList — дневник режимов, «другие режимы» разбора, мастер из ⌘K):
// клиенту видны знаки групп, как терапевту в «Справочнике» (APP_2026-11.md, принцип 10), а не
// цветные точки; группа — бумага своей группы; выбранная строка помечена.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeGroupList } from './ModeGroupList';
import { MODE_GROUPS } from '../../schemaTherapyData';
import { modeGroupLook } from '../../../../shared/src/theme/entityLook';

afterEach(cleanup);

describe('ModeGroupList', () => {
  it('каждая группа — бумага своей группы и её знак в заголовке, без цветных точек', () => {
    const { container } = render(<ModeGroupList modeId="" onPick={vi.fn()} />);
    const blocks = [...container.querySelectorAll<HTMLElement>('.sd-group-block')];
    expect(blocks).toHaveLength(MODE_GROUPS.length);
    blocks.forEach((b, i) => {
      expect(b.style.getPropertyValue('--h')).toBe(String(modeGroupLook(MODE_GROUPS[i].id).hue));
      expect(b.querySelector('.sd-group-head .sd-group-sign svg')).not.toBeNull();
      expect(b.querySelector('.sd-group-head')?.textContent).toBe(MODE_GROUPS[i].group);
    });
    expect(container.querySelector('.ds-dot, .identity-dot')).toBeNull();
  });

  it('тап по строке выбирает режим; выбранная строка — is-selected', () => {
    const onPick = vi.fn();
    render(<ModeGroupList modeId="punitive_critic" onPick={onPick} />);
    expect(screen.getByText('Карающий Критик').closest('.sd-mode-card')?.className).toContain('is-selected');
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    expect(onPick).toHaveBeenCalledWith('vulnerable_child');
  });
});
