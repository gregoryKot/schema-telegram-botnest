import { VIOLET } from './aurora';
import { AUTHOR_SITE, trackPracticeClick } from './practiceLink';
import type { RichText } from '../../../../src/articles/home-landing.content';
import type { PracticeLinkPlace } from '../../../../shared/src/share/analytics';

// Текст лендинга со ссылками внутри (src/articles/home-landing.content.ts).
// Внешняя ссылка — в новой вкладке; ссылка на сайт практики ещё и считается
// (practice_link_click, place — где стоит текст).
export function Rich({ parts, place }: { parts: RichText; place?: PracticeLinkPlace }) {
  return <>{parts.map((p, i) => {
    if (typeof p === 'string') return p;
    const external = p.href.startsWith('http');
    return (
      <a key={i} href={p.href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}
        onClick={place && p.href === AUTHOR_SITE ? () => trackPracticeClick(place) : undefined}
        style={{ color: VIOLET, textDecoration: 'none', fontWeight: 700 }}>{p.text}</a>
    );
  })}</>;
}
