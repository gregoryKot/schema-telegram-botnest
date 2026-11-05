// @vitest-environment jsdom
// «Паттерны» новичку: до первого действия рядом со списком терминов стоит,
// что это за слова (правило онбординга). Режимы на десктопе — в пустом «Мои
// режимы»; потребности — под заголовком, пока не пройдено колесо детства.
// Схему объясняет вводная сверху (PatternsIntro, тест в PatternsParts.test).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { NeedsBlock } from './NeedsBlock';
import { ModesBlocks } from './ModesBlocks';
import { MODE_WHAT, NEEDS_WHAT } from '../../../../shared/src/pattern/patternTerms';

afterEach(cleanup);

describe('что такое режим и потребность — на пути новичка', () => {
  it('формулировки взяты из общих текстов: режим — как в дневнике режимов', () => {
    expect(MODE_WHAT).toMatch(/^Режим — состояние/);
    expect(NEEDS_WHAT).toMatch(/пять базовых эмоциональных потребностей/);
  });

  it('потребности: до колеса детства — объяснение, после — его нет', () => {
    render(<NeedsBlock childhoodRatings={{}} onOpenNeed={vi.fn()} />);
    expect(screen.getByText(NEEDS_WHAT)).toBeTruthy();
    cleanup();
    render(<NeedsBlock childhoodRatings={{ attachment: 6 }} onOpenNeed={vi.fn()} />);
    expect(screen.queryByText(NEEDS_WHAT)).toBeNull();
  });

  it('режимы на десктопе: пусто — что такое режим и что сделать', () => {
    const props = { loading: false, onAdd: vi.fn(), onOpenMode: vi.fn(), onOpenPattern: vi.fn() };
    render(<ModesBlocks {...props} myModeIds={[]} />);
    expect(screen.getByText((t) => t.startsWith(MODE_WHAT) && t.includes('Добавь режимы'))).toBeTruthy();
    cleanup();
    render(<ModesBlocks {...props} myModeIds={['vulnerable_child']} />);
    expect(screen.queryByText((t) => t.startsWith(MODE_WHAT))).toBeNull();
  });
});
