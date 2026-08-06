// @vitest-environment jsdom
// DisclaimerTimeChip — общий чип «сколько это занимает», переиспользуется
// несколькими шагами онбординга (0% покрытия). Проверяем только то, что это
// прозрачный контейнер: children рендерятся как есть. Без иконки — строка
// и так начинается со времени (см. комментарий в компоненте).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DisclaimerTimeChip } from './DisclaimerTimeChip';

afterEach(() => {
  cleanup();
});

describe('DisclaimerTimeChip', () => {
  it('рендерит переданный текст', () => {
    render(
      <DisclaimerTimeChip>
        Пять оценок — меньше минуты в день.
      </DisclaimerTimeChip>,
    );
    expect(
      screen.getByText('Пять оценок — меньше минуты в день.'),
    ).toBeTruthy();
  });
});
