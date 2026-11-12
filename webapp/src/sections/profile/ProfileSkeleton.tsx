import { Skeleton } from '../../components/Skeleton';

/** Силуэт «Профиля» по форме контента (правило «Скелетоны»): витрина из трёх плиток, блок ритма
 *  дней (счётчики, серия рядом с теплокартой) и значки достижений. Раскладка — те же классы, что у
 *  настоящих блоков (cpf-shelf, cpf-rhythm): на телефоне плитки ложатся строками, как живые. */
export function ProfileSkeleton() {
  return (
    <div className="cpf-skeleton" aria-hidden="true">
      <div className="pp-squares cpf-shelf cpf-shelf--n3">
        {[0, 1, 2].map((i) => <Skeleton key={i} height="var(--cpf-tile-h)" radius={20} />)}
      </div>
      <div className="pp-block cpf-rhythm cpf-rhythm--two">
        <div className="cpf-rhythm-row">
          <Skeleton height={150} radius={16} />
          <Skeleton height={190} radius={16} />
        </div>
      </div>
      <div className="cpf-skel-badges">
        {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} width={54} height={54} radius={14} />)}
      </div>
    </div>
  );
}
