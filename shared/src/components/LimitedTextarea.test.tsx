// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createRef } from 'react';
import { LimitedTextarea } from './LimitedTextarea';

afterEach(() => {
  cleanup();
});

describe('LimitedTextarea', () => {
  it('ставит maxLength из max и отдаёт остальные пропсы textarea', () => {
    render(
      <LimitedTextarea
        max={200}
        value=""
        onChange={() => {}}
        placeholder="Текст"
        rows={3}
      />,
    );
    const area = screen.getByPlaceholderText('Текст');
    expect(area.maxLength).toBe(200);
    expect(area.rows).toBe(3);
  });

  it('поле несёт метку ym-disable-keys и сохраняет класс вызывающего (Вебвизор не пишет свободный текст)', () => {
    render(
      <LimitedTextarea
        max={200}
        value=""
        onChange={() => {}}
        placeholder="С классом"
        className="field"
      />,
    );
    const area = screen.getByPlaceholderText('С классом');
    expect(area.classList.contains('ym-disable-keys')).toBe(true);
    expect(area.classList.contains('field')).toBe(true);
    cleanup();
    render(
      <LimitedTextarea
        max={200}
        value=""
        onChange={() => {}}
        placeholder="Без класса"
      />,
    );
    expect(screen.getByPlaceholderText('Без класса').className).toBe(
      'ym-disable-keys',
    );
  });

  it('onChange получает введённый текст', () => {
    const seen: string[] = [];
    render(
      <LimitedTextarea
        max={200}
        value=""
        onChange={(e) => seen.push(e.target.value)}
        placeholder="Т"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Т'), {
      target: { value: 'привет' },
    });
    expect(seen).toEqual(['привет']);
  });

  it('пока текста мало — счётчика нет; у границы — остаток; на пределе — сообщение', () => {
    const { rerender, container } = render(
      <LimitedTextarea max={200} value={'а'.repeat(10)} onChange={() => {}} />,
    );
    expect(container.querySelector('div')).toBeNull();
    rerender(
      <LimitedTextarea max={200} value={'а'.repeat(180)} onChange={() => {}} />,
    );
    expect(container.querySelector('div')?.textContent).toContain(
      'Осталось знаков: 20',
    );
    rerender(
      <LimitedTextarea max={200} value={'а'.repeat(200)} onChange={() => {}} />,
    );
    expect(container.querySelector('div')?.textContent).toContain(
      'Достигнут предел',
    );
  });

  it('alwaysCount показывает «N/предел» сразу', () => {
    const { container } = render(
      <LimitedTextarea max={500} value="абв" alwaysCount onChange={() => {}} />,
    );
    expect(container.querySelector('div')?.textContent).toBe('3/500');
  });

  it('ref доходит до textarea', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<LimitedTextarea ref={ref} max={50} value="" onChange={() => {}} />);
    expect(ref.current?.tagName).toBe('TEXTAREA');
  });

  it('aria-describedby ведёт на счётчик, пока он виден, и сохраняет чужой describedby', () => {
    const { container, rerender } = render(
      <LimitedTextarea
        id="f"
        aria-describedby="hint"
        max={200}
        value="абв"
        onChange={() => {}}
      />,
    );
    const area = container.querySelector('textarea')!;
    expect(area.getAttribute('aria-describedby')).toBe('hint');
    rerender(
      <LimitedTextarea
        id="f"
        aria-describedby="hint"
        max={200}
        value={'а'.repeat(190)}
        onChange={() => {}}
      />,
    );
    expect(area.getAttribute('aria-describedby')).toBe('hint f-limit');
    expect(container.querySelector('#f-limit')?.textContent).toContain(
      'Осталось знаков: 10',
    );
  });
});
