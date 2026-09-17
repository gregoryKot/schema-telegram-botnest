// @vitest-environment jsdom
// NeedDetailSheet — детальная карточка потребности (0% покрытия). Проверяем
// ветки уровня оценки детства (low/medium/high → разные ranges/tips),
// отсутствие оценки (падает на actions), связанные активные схемы и защиту
// от неизвестного needId (сущность отсутствует в NEED_DATA — должен вернуть
// null, а не упасть).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { NeedDetailSheet } from './NeedDetailSheet';

afterEach(cleanup);

describe('NeedDetailSheet — без оценки детства', () => {
  it('показывает объяснение и общие действия (actions), без блока «детство»', () => {
    render(
      <NeedDetailSheet
        needId="attachment"
        activeSchemaIds={[]}
        onClose={() => {}}
      />,
    );
    // Заголовок «Практика» — общий кейс без childhoodRating (нет ветки low).
    expect(screen.getByText('Практика')).toBeTruthy();
    expect(screen.queryByText('Что поможет сейчас')).toBeNull();
    expect(screen.queryByText('детство')).toBeNull();
  });
});

describe('NeedDetailSheet — уровни оценки детства', () => {
  it('низкая оценка (≤3) — заголовок «Что поможет сейчас», значение видно', () => {
    render(
      <NeedDetailSheet
        needId="attachment"
        childhoodRating={2}
        activeSchemaIds={[]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Что поможет сейчас')).toBeTruthy();
    // Значение оценки рендерится прямо перед подписью «детство» — в списке
    // подсказок тоже есть цифры-номера (1/2/3), поэтому ищем по соседству.
    expect(
      screen.getByText('детство').previousElementSibling?.textContent,
    ).toBe('2');
  });

  it('высокая оценка (>6) — заголовок «Практика»', () => {
    render(
      <NeedDetailSheet
        needId="attachment"
        childhoodRating={9}
        activeSchemaIds={[]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Практика')).toBeTruthy();
    expect(
      screen.getByText('детство').previousElementSibling?.textContent,
    ).toBe('9');
  });

  it('средняя оценка (4-6) тоже рендерит «Практика» без падения', () => {
    render(
      <NeedDetailSheet
        needId="attachment"
        childhoodRating={5}
        activeSchemaIds={[]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Практика')).toBeTruthy();
  });
});

describe('NeedDetailSheet — связанные схемы', () => {
  it('активная схема из связанного домена (rejection→attachment) — показывается блоком', () => {
    render(
      <NeedDetailSheet
        needId="attachment"
        activeSchemaIds={['abandonment']}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Связанные схемы')).toBeTruthy();
  });

  it('нет активных связанных схем — блок «Связанные схемы» не рендерится', () => {
    render(
      <NeedDetailSheet
        needId="attachment"
        activeSchemaIds={[]}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText('Связанные схемы')).toBeNull();
  });
});

describe('NeedDetailSheet — неизвестный needId', () => {
  it('нет такой потребности в NEED_DATA — рендерит null, не падает', () => {
    const onClose = vi.fn();
    const { container } = render(
      <NeedDetailSheet
        needId="not_a_real_need"
        activeSchemaIds={[]}
        onClose={onClose}
      />,
    );
    expect(container.textContent).toBe('');
  });
});
