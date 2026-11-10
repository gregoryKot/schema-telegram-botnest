// @vitest-environment jsdom
// Сбой задания (ревью g4 r5): вместо голой красной строки (.cp-alert / .sk-error, color: var(--err)) — наклейка
// PaperAlert. Без знака (ревью g4 r6): знак заданий — галочка, «сохранено» рядом с «Не удалось сохранить…», и
// наклейка читалась ещё одной строкой задания. Слова прежние, обе формы обращения. Через шов — в «Практиках»
// (PracticeSection.test) и в общем списке заданий (TasksHub.test).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { TaskSaveError } from './TaskSaveError';
import { AddressFormContext } from '../../utils/addressForm';
import { plainText } from '../../test-support/plainText';

afterEach(cleanup);

const renderIn = (form: 'ty' | 'vy') =>
  render(<AddressFormContext.Provider value={{ form, setForm: vi.fn() }}><TaskSaveError /></AddressFormContext.Provider>);

describe('TaskSaveError — наклейка сбоя', () => {
  it('PaperAlert: role="alert", без знака-галочки, заголовок и тихая вторая фраза; без красной строки', () => {
    const { getByRole } = renderIn('ty');
    const alert = getByRole('alert');
    expect(alert.classList.contains('pa-alert')).toBe(true);
    expect(alert.classList.contains('sk-error') || alert.classList.contains('cp-alert')).toBe(false);
    expect(alert.querySelector('.pa-alert-sign')).toBeNull();
    expect(plainText(alert.querySelector('.pa-alert-title'))).toBe('Не удалось сохранить изменение задания.');
    expect(plainText(alert.querySelector('.pa-alert-text'))).toBe('Проверь соединение и попробуй ещё раз');
  });

  it('«вы»: вторая фраза во множественном числе, первая та же', () => {
    const { getByRole } = renderIn('vy');
    expect(plainText(getByRole('alert'))).toBe('Не удалось сохранить изменение задания.Проверьте соединение и попробуйте ещё раз');
  });
});
