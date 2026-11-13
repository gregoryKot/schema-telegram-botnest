import { Cta } from './BrandKit';
import { glue } from '../../../../shared/src/utils/typo';
import { useTr } from '../../utils/addressForm';

// Вход в игру с лендинга: метка ?src=site — блок «Игра» в /stats считает переход «с сайта».
export const GAME_SITE_URL = '/game/?src=site';

export function GameTeaser() {
  const tr = useTr();
  return (
    <section id="game" className="pl2-sec pl2-sec--tight">
      <div className="pl2-wrap">
        <span className="pl2-eyebrow">Игра</span>
        <h2 className="pl2-h2">{glue('«Сквозь голову» — путь Мистера сквозь собственные мысли')}</h2>
        <p className="pl2-sub">
          {glue(tr(
            'Пиксельная игра минут на двадцать: мешают Мистеру режимы из схема-терапии. Пройди путь вместе с ним — прямо в браузере, без регистрации.',
            'Пиксельная игра минут на двадцать: мешают Мистеру режимы из схема-терапии. Пройдите путь вместе с ним — прямо в браузере, без регистрации.',
          ))}
        </p>
        <div className="pl2-actions">
          <Cta href={GAME_SITE_URL} variant="ghost" size="lg">Сыграть</Cta>
        </div>
      </div>
    </section>
  );
}
