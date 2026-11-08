import { AUTHOR_SITE, trackPracticeClick } from './practiceLink';
import type { RichText } from '../../../../src/articles/home-landing.content';
import type { PracticeLinkPlace } from '../../../../shared/src/share/analytics';
import { glue } from './typo';

// Текст лендинга со ссылками внутри (src/articles/home-landing.content.ts).
// Внешняя ссылка — в новой вкладке; ссылка на сайт практики ещё и считается
// (practice_link_click, place — где стоит текст). Неразрывные пробелы — glue (typo.ts).
export function Rich({ parts, place }: { parts: RichText; place?: PracticeLinkPlace }) {
  return <>{parts.map((p, i) => {
    if (typeof p === 'string') return glue(p);
    const external = p.href.startsWith('http');
    return (
      <a key={i} href={p.href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}
        onClick={place && p.href === AUTHOR_SITE ? () => trackPracticeClick(place) : undefined}
        className="pl2-link">{p.text}</a>
    );
  })}</>;
}
