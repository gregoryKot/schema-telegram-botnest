import { describe, it, expect } from 'vitest';
import { buildSelfHelpParagraphs } from './selfHelpText';

const ty = (a: string) => a;
const vy = (_a: string, b: string) => b;

describe('buildSelfHelpParagraphs', () => {
  it('четыре абзаца в обеих формах обращения', () => {
    expect(buildSelfHelpParagraphs(ty)).toHaveLength(4);
    expect(buildSelfHelpParagraphs(vy)).toHaveLength(4);
  });

  it('форма «ты» и форма «вы» различаются только в абзаце про ориентир', () => {
    const a = buildSelfHelpParagraphs(ty);
    const b = buildSelfHelpParagraphs(vy);
    const diff = a
      .map((p, i) => (p === b[i] ? null : i))
      .filter((i) => i !== null);
    expect(diff).toEqual([2]);
    expect(a[2]).toContain('замечаешь');
    expect(b[2]).toContain('замечаете');
    expect(b[2]).not.toMatch(/замечаешь|тянешься/);
  });
});
