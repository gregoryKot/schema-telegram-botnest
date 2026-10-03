// «Дыши со мной» — дыхание 4-4-6 (экран «Здесь и сейчас», дизайн-макет;
// волна 2 нейродизайна). Idle-состояние — спокойная карточка с пульсирующим
// кругом (CSS-анимация breathe глушится глобальным reduced-motion блоком
// index.css); активная сессия — фазы из practices/breathing с крупным отсчётом.
// При сниженной анимации круг не масштабируется — только текст фаз.
// Прохождение засчитывается через useQuickPractice, только если пройден хотя
// бы один полный цикл (BREATH_CYCLE_S) — досрочная остановка не считается.
// Здесь — вёрстка мини-аппа поверх общей рамки createBreathingCard; у сайта своя
// (BreathingSiteCard). Площадка импортирует только своё, чужое в бандл не едет.
// Под карточкой — счётчик + «Поделиться» через общий PracticeDoneFooter
// (правило «одна механика — один компонент», как у QuickPracticeFlow).
// Жил в schema-miniapp/src/components/BreathingCard.tsx; при переносе раздела
// на сайт переехал сюда целиком — после выноса логики вёрстка совпала бы
// построчно, значит и она общая (правило №3). Площадочное — инъекцией:
// api, ShareCardSheet и botShortUrl у webapp и мини-аппа свои. Три точечных
// значения при переезде сели на шкалу токенов (24→--r-20 у карточки,
// 18→--space-20 под кругом, 99→999 у кнопки-пилюли): гейт check-scale-drift
// требует этого от нового файла, а сама шкала (tokens.css) называет 18/24
// «точечными подгонками вне кластера». Сдвиг на 2-4px намеренный.
import { createBreathingCard } from './createBreathingCard';
import { BreathingAppView } from './BreathingAppView';
import { PracticeDoneFooter } from './PracticeDoneFooter';

export type { BreathingCardProps } from './createBreathingCard';

export const BreathingCard = createBreathingCard(
  BreathingAppView,
  PracticeDoneFooter,
);
