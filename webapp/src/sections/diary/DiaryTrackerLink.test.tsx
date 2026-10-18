// @vitest-environment jsdom
// Переход из хаба дневников в трекер (паритет с мини-аппом, этап 3).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DiaryTrackerLink } from './DiaryTrackerLink';
import { DIARY_TRACKER_LINK } from '../../../../shared/src/diary/diaryTrackerLink';

afterEach(cleanup);

describe('DiaryTrackerLink', () => {
  it('показывает «что это и зачем» и открывает трекер по тапу', () => {
    const onOpen = vi.fn();
    render(<DiaryTrackerLink onOpen={onOpen} />);
    expect(screen.getByText(DIARY_TRACKER_LINK.desc)).toBeTruthy();
    fireEvent.click(screen.getByText(DIARY_TRACKER_LINK.title));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
