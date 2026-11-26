// @vitest-environment jsdom
// useNoIndex: на время жизни компонента meta robots = noindex; существующий
// тег index.html правится и восстанавливается, отсутствующий — создаётся и
// убирается (иначе следующий SPA-маршрут остался бы закрытым от поиска).
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useNoIndex } from './useNoIndex';

function Page() { useNoIndex(); return null; }
const robots = () => document.head.querySelector<HTMLMetaElement>("meta[name='robots']");

afterEach(() => { cleanup(); robots()?.remove(); });

describe('useNoIndex', () => {
  it('существующий тег: ставит noindex, при размонтировании возвращает прежнее значение', () => {
    const meta = document.createElement('meta');
    meta.name = 'robots'; meta.content = 'index, follow';
    document.head.appendChild(meta);

    const { unmount } = render(<Page />);
    expect(robots()?.content).toBe('noindex, nofollow');
    expect(document.head.querySelectorAll("meta[name='robots']").length).toBe(1); // второй тег не добавлен

    unmount();
    expect(robots()?.content).toBe('index, follow');
  });

  it('тега нет: создаёт noindex и убирает его при размонтировании', () => {
    expect(robots()).toBeNull();
    const { unmount } = render(<Page />);
    expect(robots()?.content).toBe('noindex, nofollow');
    unmount();
    expect(robots()).toBeNull();
  });
});
