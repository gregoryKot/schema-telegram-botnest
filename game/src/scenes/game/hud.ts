// HUD: титул главы, сердца и воспоминания, подсказка клавиш, плашка реплики кота.
import Phaser from 'phaser';
import { W, H } from '../../constants';
import { IS_TOUCH } from '../../controls';
import { t } from '../../i18n';
import { HUD_STROKE } from '../../look';
import type { GameScene } from '../GameScene';

// Титульная карточка: где ты и какое у этого места настроение
export function showTitleCard(s: GameScene) {
  const mk = (y: number, text: string, size: number, color: string) =>
    s.add.text(W / 2, y, text, { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: `${size}px`, color, letterSpacing: 3, align: 'center', ...HUD_STROKE, wordWrap: { width: W - 48 } })
      .setOrigin(0.5).setScrollFactor(0).setDepth(120).setAlpha(0);
  const t1 = mk(170, t(s.chapter.title).toUpperCase(), 24, '#fff0d8');
  const t2 = mk(208, t(s.chapter.tagline), 11, '#d8c8ec');
  s.titleCard = [t1, t2];
  s.tweens.add({ targets: [t1, t2], alpha: 1, duration: 700, delay: 350 });
  s.tweens.add({ targets: [t1, t2], alpha: 0, duration: 800, delay: 3200, onComplete: () => s.dropTitleCard() });
}

export function buildHUD(s: GameScene) {
  s.heartsText = s.add.text(18, 14, '', { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '24px', color: '#ff5577', ...HUD_STROKE })
    .setScrollFactor(0).setDepth(100);
  s.updateHearts();
  // счётчик воспоминаний — только если они есть в главе
  s.memText = s.add.text(18, 48, s.memTotal ? `✦ 0/${s.memTotal}` : '', { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '14px', color: '#ffd86a', ...HUD_STROKE })
    .setScrollFactor(0).setDepth(100);
  if (!IS_TOUCH)
    s.add.text(W / 2, H - 20, t('m_x_fight_z_avoid_tap_dash'), { fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: '11px', color: '#a89fd0', ...HUD_STROKE })
      .setOrigin(0.5, 1).setScrollFactor(0).setDepth(100);
}

export function updateBubble(s: GameScene, dt: number) {
  if (s.bubbleT <= 0) return;
  const cam = s.cameras.main, hw = s.bubble.width / 2 + 6;
  s.bubble.x = Phaser.Math.Clamp(s.player.x, cam.scrollX + hw, cam.scrollX + W - hw); s.bubble.y = s.player.y - 52;
  s.bubbleT -= dt;
  if (s.bubbleT < 300) s.bubble.setAlpha(Math.max(0, s.bubbleT / 300));
}
