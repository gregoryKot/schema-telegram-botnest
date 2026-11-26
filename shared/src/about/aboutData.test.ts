import { describe, it, expect } from 'vitest';
import { getAboutText, buildWhyItWorks } from './aboutData';

describe('aboutData', () => {
  it('форма «вы» не содержит «ты»-форм, «ты» — «вы»-форм', () => {
    const vy = getAboutText('vy').join(' ');
    const ty = getAboutText('ty').join(' ');
    expect(vy).toMatch(/вы оцениваете/);
    expect(vy).not.toMatch(/ты оцениваешь/);
    expect(ty).toMatch(/ты оцениваешь/);
    expect(ty).not.toMatch(/вы оцениваете/);
  });
  it('buildWhyItWorks совпадает с абзацем в общем тексте', () => {
    const tr = (ty: string) => ty;
    expect(getAboutText('ty')).toContain(buildWhyItWorks(tr));
  });
});
