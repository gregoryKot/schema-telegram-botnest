// @vitest-environment jsdom
// Плитки «Схема»/«Режим» пустых «Записей»: абзац не начинается со слова из заголовка плитки.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ExplainerPaperCard } from './ExplainerPaperCard';
import { buildDiaryExplainers } from '../../../../shared/src/diary/diaryExplainers';
import { plainText } from '../../test-support/plainText';

afterEach(cleanup);
const explainers = buildDiaryExplainers((ty) => ty);

describe('ExplainerPaperCard', () => {
  it('повтор заголовка в начале абзаца срезан, остальной текст тот же', () => {
    const texts = (['schema', 'mode'] as const).map((type) => {
      const { container } = render(<ExplainerPaperCard type={type} what={explainers[type].what} why={explainers[type].why} />);
      return plainText(container.querySelector('.cd-explainer-what'));
    });
    expect(texts[0]).toMatch(/^Так в схема-терапии называют привычную болезненную реакцию/);
    expect(texts[1]).toMatch(/^Состояние, которое включается, когда задета схема:/);
  });

  it('текст без повтора заголовка не меняется', () => {
    const { container } = render(<ExplainerPaperCard type="schema" what="Привычная реакция — схема" why="" />);
    expect(plainText(container.querySelector('.cd-explainer-what'))).toBe('Привычная реакция — схема');
  });
});
