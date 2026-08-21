// @vitest-environment jsdom
// В8 дизайн-аудита 2026-08: «Здесь и сейчас» — заголовок экрана «Помощь» (h1).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { HelpHeader } from './HelpHeader';

afterEach(cleanup);

describe('HelpHeader', () => {
  it('«Здесь и сейчас» — h1', () => {
    render(
      <HelpHeader
        relation={null}
        onOpenSelfHelp={() => {}}
        onOpenCustomize={() => {}}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Здесь и сейчас' }),
    ).toBeTruthy();
  });
});
