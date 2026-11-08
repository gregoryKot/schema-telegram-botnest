import { Cta } from '../landing/BrandKit';
import { botUrl } from '../../utils/botConfig';
import { useAppEntry } from './appEntry';

/** Главное действие под результатом мини-теста — в приложение; бот — второй строкой (U7). */
export function QuizAppCta() {
  const entry = useAppEntry();
  return (
    <div className="pl2-result-next">
      <Cta href={entry.href} size="lg">{entry.main}</Cta>
      <a href={botUrl} target="_blank" rel="noopener noreferrer" className="pl2-link pl2-link--solo">
        Или бот в Telegram ↗
      </a>
    </div>
  );
}
