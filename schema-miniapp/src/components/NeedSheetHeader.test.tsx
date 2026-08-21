// @vitest-environment jsdom
// В8 дизайн-аудита 2026-08: заголовок потребности в шапке шита — h2
// (общий заголовок для NeedHistorySheet/NeedTodaySheet), не div.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { NeedSheetHeader } from './NeedSheetHeader';
import type { Need } from '../types';
import type { NeedExtra } from '../../../shared/src/needs/types';

const NEED: Need = {
  id: 'attachment',
  emoji: '🤝',
  title: 'Привязанность',
  chartLabel: 'Привязанность',
};

const DATA: NeedExtra = {
  tags: ['близость', 'доверие'],
} as NeedExtra;

afterEach(cleanup);

describe('NeedSheetHeader', () => {
  it('название потребности — h2', () => {
    render(
      <NeedSheetHeader
        need={NEED}
        data={DATA}
        color="#60a5fa"
        onClose={() => {}}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Привязанность' }),
    ).toBeTruthy();
  });
});
