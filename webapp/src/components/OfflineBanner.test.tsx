// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { OfflineBanner } from './OfflineBanner';

afterEach(cleanup);

describe('OfflineBanner', () => {
  it('офлайн — показывает текст как status', () => {
    render(<OfflineBanner offline />);
    expect(screen.getByRole('status').textContent).toMatch(/Нет сети/);
  });
  it('онлайн — ничего', () => {
    const { container } = render(<OfflineBanner offline={false} />);
    expect(container.textContent).toBe('');
  });
});
