import { hasLoopGuardMarker, withLoopGuardMarker } from './oauth-loop-guard';

describe('withLoopGuardMarker / hasLoopGuardMarker', () => {
  it('добавляет маркер через ? когда query пуст', () => {
    const url = withLoopGuardMarker('https://schemehappens.ru/api/auth/google');
    expect(url).toBe('https://schemehappens.ru/api/auth/google?_oh=1');
    expect(hasLoopGuardMarker(url)).toBe(true);
  });

  it('добавляет маркер через & когда query уже есть', () => {
    const url = withLoopGuardMarker(
      'https://schemehappens.ru/api/auth/google?ticket=ABC',
    );
    expect(url).toBe(
      'https://schemehappens.ru/api/auth/google?ticket=ABC&_oh=1',
    );
    expect(hasLoopGuardMarker(url)).toBe(true);
  });

  it('без маркера — false', () => {
    expect(hasLoopGuardMarker('/api/auth/google?ticket=ABC')).toBe(false);
  });

  it('похожий, но чужой параметр не матчится (контроль)', () => {
    expect(hasLoopGuardMarker('/api/auth/google?x_oh=1')).toBe(false);
    expect(hasLoopGuardMarker('/api/auth/google?_oh=11')).toBe(false);
  });
});
