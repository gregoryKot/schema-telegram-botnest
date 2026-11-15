// 404 продуктового хоста (docs/archive/APP_2026-11.md, b26): неизвестный адрес — лист исхода
// «подожди или устарело» (Cup на соломе), а не молчаливый уход на главную или в кабинет: человек
// видит, что ссылка не сработала, и одну дорогу дальше. Гостю — на главную, вошедшему — в
// приложение (/today); вход не проверяется заново — то, что уже знает AuthProvider. Вид — исход
// `wait` таблицы OUTCOME_LOOK: своего исхода у 404 нет. Текст безличный.
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { PaperOutcome } from '../components/paper/PaperOutcome';
import { notFoundExit } from './notFoundExit';

export function NotFoundPage() {
  const { isAuthenticated } = useAuth();
  const exit = notFoundExit(isAuthenticated);
  return (
    <PaperOutcome outcome="wait" eyebrow="404" title="Такой страницы нет"
                  lead="Адрес мог устареть, или в нём опечатка.">
      <Link className="ds-btn ds-btn--lg pa-outcome-action" to={exit.to} replace>{exit.label}</Link>
    </PaperOutcome>
  );
}
