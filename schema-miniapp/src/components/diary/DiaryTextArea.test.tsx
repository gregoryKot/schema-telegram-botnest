// @vitest-environment jsdom
// В7 дизайн-аудита 2026-08: DiaryTextArea (общий для ModeDiaryWizard,
// SchemaDiaryWizard, IntroSheetFlashcard) связывает поле с вопросом
// программно — не только placeholder'ом, который исчезает при вводе.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DiaryTextArea } from './DiaryTextArea';

afterEach(() => {
  cleanup();
});

describe('DiaryTextArea — связь с вопросом (В7)', () => {
  it('labelId связывает поле с видимым вопросом через aria-labelledby', () => {
    render(
      <div>
        <div id="q1">Что бы сказал твой Здоровый Взрослый?</div>
        <DiaryTextArea
          value=""
          onChange={() => {}}
          placeholder="Например…"
          labelId="q1"
        />
      </div>,
    );
    const field = screen.getByLabelText(
      'Что бы сказал твой Здоровый Взрослый?',
    );
    expect(field.tagName).toBe('TEXTAREA');
  });

  it('ariaLabel даёт доступное имя, когда рядом нет отдельного видимого вопроса', () => {
    render(
      <DiaryTextArea
        value=""
        onChange={() => {}}
        placeholder="Например…"
        ariaLabel="Откуда это знакомо?"
      />,
    );
    expect(screen.getByLabelText('Откуда это знакомо?')).toBeTruthy();
  });

  it('без labelId/ariaLabel поле не имеет доступного имени (регресс к плейсхолдеру)', () => {
    render(
      <DiaryTextArea value="" onChange={() => {}} placeholder="Например…" />,
    );
    expect(screen.queryByLabelText('Например…')).toBeNull();
    expect(screen.getByPlaceholderText('Например…')).toBeTruthy();
  });
});
