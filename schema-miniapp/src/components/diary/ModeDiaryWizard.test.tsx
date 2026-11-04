// @vitest-environment jsdom
// QA 2026-11, М5 (пара к webapp ModeEntryForm): пример Здорового Взрослого
// шёл в двойных кавычках ««Мне сейчас больно…»» — визард добавлял свои «» к
// тексту карточки, где кавычки уже есть. Кавычки живут в тексте подсказки.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModeDiaryWizard } from './ModeDiaryWizard';
import { healthyAdultHint } from '../../../../shared/src/mode/healthyAdultHints';
import { MODE_DIARY_FIELD_KEYS } from '../../../../shared/src/mode/modeDiarySteps';

describe('ModeDiaryWizard — пример Здорового Взрослого', () => {
  it('одна пара кавычек: подсказка как есть', () => {
    const hint = healthyAdultHint('vulnerable_child');
    const { container } = render(
      <ModeDiaryWizard
        values={Object.fromEntries(MODE_DIARY_FIELD_KEYS.map((k) => [k, '']))}
        onChange={vi.fn()}
        healthyResponse=""
        onHealthyChange={vi.fn()}
        healthyHint={hint}
        onSave={vi.fn()}
        canSave={false}
        saving={false}
        accentColor="var(--accent)"
      />,
    );
    const segments = container.querySelectorAll('[role="button"]');
    fireEvent.click(segments[segments.length - 1]);
    const example = screen.getByText(/^«Мне сейчас больно/);
    expect(example.textContent).toBe(hint);
    expect(example.textContent).not.toMatch(/««|»»/);
  });
});
