import { Outlet } from 'react-router-dom';

/**
 * Layout-маршрут визитки практики (kotlarewski): один бренд на все её страницы.
 * Класс `.landing-personal-brand` (index.css) переопределяет акцент (индиго),
 * `--on-accent` и шрифт — раньше он стоял только на главной, а запись, отзывы,
 * статьи и юридические страницы того же домена рисовались продуктовой терракотой.
 *
 * `display: contents` — обёртка не создаёт бокс и не ломает flex-раскладку
 * `#root`; кастомные свойства и font-family наследуются по DOM независимо от
 * `display`.
 */
export function PracticeBrand() {
  return (
    <div className="landing-personal-brand" style={{ display: 'contents' }}>
      <Outlet />
    </div>
  );
}
