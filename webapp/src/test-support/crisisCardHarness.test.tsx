// @vitest-environment jsdom
// Харнесс кризисного пути проверяет сам себя: поле с детекцией проходит, а
// поле без неё, постоянный блок помощи вместо детекции и карточка на любой
// текст — краснеют. Без контрольных образцов сломанный харнесс зеленел бы на
// всех полях сразу.
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CrisisCardView } from '../../../shared/src/components/CrisisCard';
import { detectCrisis } from '../utils/crisisMarkers';
import {
  expectCrisisCardShown,
  expectNoCrisisCard,
  type CrisisFieldScenario,
} from './crisisCardHarness';

const tr = (ty: string) => ty;

function Field({ card }: { card: 'detect' | 'never' | 'always' | 'any-text' }) {
  const [v, setV] = useState('');
  const show =
    card === 'always' || (card === 'detect' && detectCrisis(v)) || (card === 'any-text' && v !== '');
  return (
    <>
      <textarea aria-label="Текст" value={v} onChange={(e) => setV(e.target.value)} />
      {show && <CrisisCardView tr={tr} track={vi.fn()} />}
    </>
  );
}

const scenario = (card: 'detect' | 'never' | 'always' | 'any-text'): CrisisFieldScenario => ({
  open: () => render(<Field card={card} />),
  enter: (text) => fireEvent.change(screen.getByLabelText('Текст'), { target: { value: text } }),
});

describe('crisisCardHarness', () => {
  it('поле с детекцией: карточка на кризисной фразе, нет на обычной', async () => {
    await expectCrisisCardShown(scenario('detect'));
    cleanup();
    await expectNoCrisisCard(scenario('detect'));
  });

  it('поле без детекции краснеет', async () => {
    await expect(expectCrisisCardShown(scenario('never'), 100)).rejects.toThrow(/8-800-100-49-94/);
  });

  it('постоянный блок с телефоном не засчитывается за детекцию', async () => {
    await expect(expectCrisisCardShown(scenario('always'), 100)).rejects.toThrow();
    cleanup();
    await expectNoCrisisCard(scenario('always'));
  });

  it('карточка на любой текст краснеет на контрольной фразе', async () => {
    await expect(expectNoCrisisCard(scenario('any-text'))).rejects.toThrow(/обычной фразе/);
  });
});
