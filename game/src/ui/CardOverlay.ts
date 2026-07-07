import { ENEMIES, SAGE_CONTENT, contentMap } from '../data/content';
import { t } from '../i18n';

export class CardOverlay {
  private overlay = document.getElementById('card-overlay')!;
  private emojiEl  = document.getElementById('card-emoji')!;
  private titleEl  = document.getElementById('card-title')!;
  private quoteEl  = document.getElementById('card-quote')!;
  private textEl   = document.getElementById('card-text')!;
  private tipEl    = document.getElementById('card-tip')!;
  private counterEl= document.getElementById('card-counter')!;
  private btnEl    = document.getElementById('card-btn') as HTMLButtonElement;

  constructor() {
    this.btnEl.onclick = () => this.hide();
  }

  show(id: string, returnCount: number, understood: number, cb: () => void) {
    const d = contentMap[id];
    if (!d) { cb(); return; } // контент не найден — не зависаем
    this.emojiEl.textContent  = d.emoji;
    this.titleEl.textContent  = t(d.name);
    this.quoteEl.textContent  = t(d.quote);
    this.textEl.textContent   = t(d.text);
    this.tipEl.textContent    = t(d.tip);
    this.counterEl.textContent = returnCount > 0
      ? t('m_hud_returned', { n: returnCount, u: understood, tot: ENEMIES.length })
      : t('m_hud_understood', { u: understood, tot: ENEMIES.length });
    this.btnEl.textContent = t('m_continue_2');
    this.btnEl.onclick = () => { this.hide(); cb(); };
    this.overlay.classList.add('visible');
  }

  showSage(cb: () => void) {
    const d = SAGE_CONTENT;
    this.emojiEl.textContent  = d.emoji;
    this.titleEl.textContent  = t(d.name);
    this.quoteEl.textContent  = '';
    this.textEl.textContent   = t(d.text);
    this.tipEl.textContent    = t(d.tip);
    this.counterEl.textContent = '';
    this.btnEl.textContent = t(d.ctaLabel);
    this.btnEl.onclick = () => window.open(d.ctaUrl, '_blank');
    // secondary button
    const sec = document.createElement('button');
    sec.id = 'card-btn-sec';
    sec.textContent = t('m_keep_playing');
    sec.onclick = () => { sec.remove(); this.hide(); cb(); };
    this.btnEl.after(sec);
    this.overlay.classList.add('visible');
  }

  hide() {
    this.overlay.classList.remove('visible');
    document.getElementById('card-btn-sec')?.remove();
  }

  isVisible() { return this.overlay.classList.contains('visible'); }
}
