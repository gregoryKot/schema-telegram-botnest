// @vitest-environment jsdom
// Кнопка удаления доказательства в «Проверке убеждения» (сайт). Видимость на
// телефоне RTL не доказывает — jsdom не применяет @media (hover: none); её
// держит гейт check-hover-only-reveal.mjs. Здесь — что кнопка находится по
// роли и имени и зовёт onRemove с индексом своей строки.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EviList } from './EviList';

afterEach(cleanup);

describe('EviList — удаление', () => {
  it('кнопка «Удалить» каждой строки зовёт onRemove со своим индексом', () => {
    const onRemove = vi.fn();
    render(
      <EviList
        items={['первое', 'второе']}
        onRemove={onRemove}
        input=""
        onInput={() => {}}
        onAdd={() => {}}
        placeholder="Добавить"
      />,
    );
    const buttons = screen.getAllByRole('button', { name: 'Удалить' });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect(onRemove).toHaveBeenCalledWith(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
