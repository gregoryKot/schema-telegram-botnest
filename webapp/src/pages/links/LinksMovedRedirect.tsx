// Синоним адреса страницы ссылок (/links, /hi, /me) → основной адрес. Строка запроса и хеш
// едут дальше: по utm_source считается источник клика (links_page_click). На проде раньше
// отвечает сервер (301); здесь — переход внутри SPA.
import { Navigate, useLocation } from 'react-router-dom';
import { LINKS_PAGE_PATH } from './linksAliases';

export function LinksMovedRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: LINKS_PAGE_PATH, search, hash }} replace />;
}
