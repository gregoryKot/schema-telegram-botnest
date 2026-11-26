// Чем кончается глава: карточка хука с зовом, финальная карточка игры или «глава пройдена» с путём в следующую.
import type Phaser from 'phaser';
import type { Chapter } from './chapter';
import { CHAPTERS, nextChapter } from './chapters';
import { showWeekCard } from './card';
import { showWeekEnd } from './endCard';
import { showFinalCard } from './finalCard';

/** go(id) — перезапуск сцены с главой id. */
export function showChapterEnd(s: Phaser.Scene, ch: Chapter, go: (id: string) => () => void) {
  const next = nextChapter(ch);
  if (ch.end.card === 'hook') return showWeekCard(s, next && go(next.id));
  if (ch.end.card === 'final') return showFinalCard(s, go(CHAPTERS[0].id));
  showWeekEnd(s, { day: ch.title, crisis: ch.crisis, again: go(ch.id), next: next && { label: next.invite ?? 'm_wk_card_btn_next', go: go(next.id) } });
}
