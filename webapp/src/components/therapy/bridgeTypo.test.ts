import { describe, it, expect } from 'vitest';
import { glueBridge } from './bridgeTypo';

const plain = (s: string) => s.replace(/[\u00a0\u2011]/g, (c) => (c === '\u00a0' ? ' ' : '-'));

describe('glueBridge', () => {
  it.each([
    'Самопомощь помогает держаться. Нести это в одиночку не обязательно.',
    'Нести это в одиночку не обязательно',
  ])('«это» держится со следующим словом, слова те же: %s', (text) => {
    const got = glueBridge(text);
    expect(got).toContain('Нести это\u00a0в\u00a0одиночку');
    expect(plain(got)).toBe(text);
  });

  it('без «это» — обычный glue; «поэтому» не трогает', () => {
    expect(glueBridge('поэтому так')).toBe('поэтому так');
  });
});
