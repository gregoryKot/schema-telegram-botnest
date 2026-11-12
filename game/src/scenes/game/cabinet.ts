// Сцен-скрипт кабинета гл.4 и финального подхода к двери терапевта.
import { W, H } from '../../constants';
import { audio } from '../../audio';
import { setTouchControls } from '../../controls';
import { t, type MsgKey } from '../../i18n';
import { track } from '../../analytics';
import type { GameScene } from '../GameScene';
import { showTherapyCta } from './cta';

// У двери терапевта копинги буквально гаснут — против выбора они бессмысленны
export function beginFinalApproach(s: GameScene) {
  s.finalApproach = true;
  track('final_approach');
  s.time.delayedCall(500, () => s.say('m_whisper_worse', 2800)); // тревога: «а вдруг хуже»
  const ids = ['tbtn-hit', 'tbtn-avoid', 'tbtn-fawn'];
  ids.forEach((id, i) => s.time.delayedCall(1800 + i * 900, () => {
    const el = document.getElementById(id);
    if (el) { el.style.transition = 'opacity 1s'; el.style.opacity = '0.12'; el.style.pointerEvents = 'none'; }
  }));
  s.time.delayedCall(1800, () => { s.copingsOff = true; });
  s.time.delayedCall(4200, () => s.say('m_no_coping_here_note', 3000));
}

export function restoreCopingButtons() {
  for (const id of ['tbtn-hit', 'tbtn-avoid', 'tbtn-fawn']) {
    const el = document.getElementById(id);
    if (el) { el.style.opacity = '1'; el.style.pointerEvents = 'auto'; }
  }
}

// ── Гл.4 «Первый сеанс»: payoff всей игры — впервые тихо, и кто-то рядом.
//    И первый ВСТРЕТИТЬ: Критик вблизи меньше, чем казался.
export function sessionScene(s: GameScene) {
  s.dead = true;
  audio.stopMusic();
  const pb = s.player.body as Phaser.Physics.Arcade.Body;
  pb.setVelocity(0, 0); pb.moves = false;
  s.player.setVisible(false);          // Мистера рисуем сами, в кресле
  setTouchControls(false); // на сеансе кнопки не нужны — совсем
  const deep = 150;
  // тёплая комната
  const room = s.add.rectangle(W / 2, H / 2, W, H, 0x171008).setScrollFactor(0).setDepth(deep).setAlpha(0);
  s.tweens.add({ targets: room, alpha: 1, duration: 900 });
  const gfx = s.add.graphics().setScrollFactor(0).setDepth(deep + 1).setAlpha(0);
  gfx.fillStyle(0xffd9a0, 0.10); gfx.fillEllipse(W * 0.72, H * 0.36, 300, 220);   // свет лампы
  gfx.fillStyle(0x2a2014, 1); gfx.fillRect(0, H - 64, W, 64);                     // пол
  const objs: Phaser.GameObjects.GameObject[] = [gfx];
  const put = (key: string, x: number, w: number) => {
    if (!s.textures.exists(key)) return null;
    const img = s.add.image(x, H - 64, key).setOrigin(0.5, 1).setScrollFactor(0).setDepth(deep + 2).setAlpha(0);
    img.setScale(w / img.width);
    objs.push(img); return img;
  };
  put('prop_couch', W * 0.30, 240);
  put('prop_lamp', W * 0.74, 64);
  put('prop_plant', W * 0.92, 70);
  // Мистер и терапевт — просто сидят. никого не надо бить.
  const mister = s.add.sprite(W * 0.26, H - 64, 'cat_idle').setOrigin(0.5, 1)
    .setScale(1.6).setScrollFactor(0).setDepth(deep + 3).setAlpha(0).play('p-idle');
  const doc = s.add.sprite(W * 0.56, H - 64, 'cat_idle').setOrigin(0.5, 1)
    .setScale(1.7).setFlipX(true).setTint(0x9ac8a8).setScrollFactor(0).setDepth(deep + 3).setAlpha(0).play('p-idle');
  objs.push(mister, doc);
  s.tweens.add({ targets: objs, alpha: 1, duration: 1100, delay: 700 });

  // строки — тихие, по одной
  const font = '"Press Start 2P", "Courier New", monospace';
  const ky = H / 540;
  const line = (key: MsgKey, y: number, color: string, size: number, delay: number) => {
    const ln = s.add.text(W / 2, y * ky, t(key), { fontFamily: font, fontSize: `${size}px`, color, align: 'center', lineSpacing: 8 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(deep + 5).setAlpha(0);
    s.tweens.add({ targets: ln, alpha: 1, duration: 900, delay });
    s.sessionLines.push(ln);
    return ln;
  };
  line('m_cab_1', 82, '#d8c8ec', 13, 1600);
  line('m_cab_2', 118, '#d8c8ec', 12, 3200);
  line('m_cab_3', 154, '#e8d8c0', 12, 5200);
  line('m_ther_q', 208, '#a8e8d0', 12, 7400);          // — кто приходит к тебе чаще всего?
  // Критик встаёт в дверях — огромный, как всегда
  s.time.delayedCall(9000, () => {
    const shadow = s.add.sprite(W * 0.92, H - 64, 'cat_idle').setOrigin(0.5, 1)
      .setScale(2.2).setTint(0x1a0030).setScrollFactor(0).setDepth(deep + 4).setAlpha(0).play('p-idle');
    shadow.setFlipX(true);
    s.tweens.add({ targets: shadow, alpha: 0.85, duration: 900 });
    audio.anx();
    const prompt = s.add.text(W / 2, (H - 100), t('m_meet_prompt'), {
      fontFamily: font, fontSize: '11px', color: '#88ffcc',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(deep + 6).setAlpha(0);
    s.tweens.add({ targets: prompt, alpha: { from: 0.4, to: 1 }, duration: 700, yoyo: true, repeat: -1, delay: 1100 });
    // ВСТРЕТИТЬ — вместе: одно нажатие, и вблизи он меньше, чем казался
    s.time.delayedCall(1400, () => {
      let met = false;
      const meet = () => {
        if (met) return; // E, потом тап — раньше рисовало две CTA и слало demo_end дважды
        met = true;
        s.input.keyboard!.off('keydown-E', meet); s.input.off('pointerdown', meet);
        prompt.destroy();
        audio.gate();
        s.tweens.add({ targets: shadow, x: W * 0.72, scale: 0.9, duration: 1700, ease: 'Sine.InOut' });
        s.tweens.add({ targets: shadow, tint: 0x4a3060, alpha: 0.8, duration: 1700 });
        line('m_meet_1', 250, '#e8b8c8', 12, 1900);
        line('m_meet_2', 306, '#d8c8ec', 12, 4300);
        line('m_meet_3', 368, '#88ffcc', 12, 6900);
        s.time.delayedCall(10200, () => showTherapyCta(s));
      };
      s.input.keyboard!.once('keydown-E', meet);
      s.input.once('pointerdown', meet);
    });
  });
}
