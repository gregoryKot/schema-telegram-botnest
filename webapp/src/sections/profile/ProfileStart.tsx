// Пустой профиль (b21, ENTITY_LOOK.profile: «пустой — ScenePathStart»): вместо стены нулей и трёх
// пустых карточек — лист начала пути и одна залитая кнопка. Кнопка — «Пройти тест»: из всего, что
// профиль собирает, только портрет нельзя начать на другом экране (отметку дня ведёт «Сегодня»,
// а портрет без теста пуст), и его объяснение «откуда это» уже есть (portraitTexts.emptyCard).
// Это блок «Мой портрет» в пустом состоянии: «Настроить экран» прячет его вместе с портретом.
import { useTr } from '../../utils/addressForm';
import { portraitTexts } from '../../../../shared/src/portrait/portraitTexts';
import { glue } from '../../../../shared/src/utils/typo';
import { ScenePathStart } from '../../components/art/AppScenesMore';

export function ProfileStart({ onTakeTest }: { onTakeTest?: () => void }) {
  const txt = portraitTexts(useTr());
  return (
    <section className="pp-block cpf-start">
      <div className="cpf-start-body">
        <h2 className="pp-hero-title">{txt.title}</h2>
        <p className="pp-hero-text">{glue(txt.emptyCard)}</p>
        {onTakeTest && <button type="button" className="ds-btn ds-btn--lg cpf-start-cta" onClick={onTakeTest}>{txt.takeTest}</button>}
      </div>
      <div className="cpf-start-art" aria-hidden="true"><ScenePathStart hue={195} /></div>
    </section>
  );
}
