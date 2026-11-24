import { useState } from 'react';
import { isReducedMotion } from '../../utils/reducedMotion';

// Ролик «значок на экран» рядом с шагами на /install: идёт сам, по кругу и без звука (иначе браузер
// не даст автозапуск), мелодию включает кнопка под ним. «Меньше движения» — стоит, запуск своей кнопкой плеера.
export function InstallVideo({ src }: { src: string }) {
  const [muted, setMuted] = useState(true);
  const still = isReducedMotion();
  return (
    <div className="ib-video">
      {/* Речи в ролике нет (только мелодия), его текст — шаги рядом: субтитрам нечего передавать. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video src={src} muted={muted} autoPlay={!still} controls={still} loop playsInline preload="metadata" aria-label="Видео: те же шаги на экране телефона" />
      <button type="button" className="ds-btn ds-btn--secondary ib-sound" aria-pressed={!muted} onClick={() => setMuted((m) => !m)}>
        {muted ? 'Включить звук' : 'Выключить звук'}
      </button>
    </div>
  );
}
