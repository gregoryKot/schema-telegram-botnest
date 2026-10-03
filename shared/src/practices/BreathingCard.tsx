// «Дыши со мной» — дыхание 4-4-6 (экран «Здесь и сейчас», дизайн-макет;
// волна 2 нейродизайна). Idle-состояние — спокойная карточка с пульсирующим
// кругом (CSS-анимация breathe глушится глобальным reduced-motion блоком
// index.css); активная сессия — фазы из practices/breathing с крупным отсчётом.
// При сниженной анимации круг не масштабируется — только текст фаз.
// Прохождение засчитывается через useQuickPractice, только если пройден хотя
// бы один полный цикл (BREATH_CYCLE_S) — досрочная остановка не считается.
// Вёрстка — два представления над одной логикой (useBreathingSession):
// variant="app" (по умолчанию, мини-апп) и variant="site" (editorial сайта).
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
import type { ComponentType } from 'react';
import { PracticeDoneFooter } from './PracticeDoneFooter';
import { drawPracticeCard } from '../share/cards/practiceCard';
import { practiceShareText } from '../share/shareTexts';
import type { ShareCardSheetProps } from '../share/shareCardSheetProps';
import type { QuickPracticeApi } from './useQuickPractice';
import { useBreathingSession } from './useBreathingSession';
import { BreathingAppView } from './BreathingAppView';
import { BreathingSiteView } from './BreathingSiteView';

export interface BreathingCardProps {
  api: QuickPracticeApi & {
    trackEvent: (name: string, meta?: Record<string, unknown>) => void;
  };
  ShareCardSheet: ComponentType<ShareCardSheetProps>;
  botShortUrl: string;
  /** Вёрстка: 'app' — мини-апп (по умолчанию), 'site' — editorial сайта. */
  variant?: 'app' | 'site';
}

export function BreathingCard({
  api,
  ShareCardSheet,
  botShortUrl,
  variant = 'app',
}: BreathingCardProps) {
  const s = useBreathingSession(api);
  const { practice, countLabel } = s;

  return (
    <>
      {variant === 'site' ? (
        <BreathingSiteView s={s} />
      ) : (
        <BreathingAppView s={s} />
      )}

      <PracticeDoneFooter
        count={s.count}
        onShare={() => s.setShowShare(true)}
        variant={variant}
      />

      {s.showShare && (
        <ShareCardSheet
          title={practice.title}
          draw={(canvas) => drawPracticeCard(canvas, practice, countLabel)}
          shareText={practiceShareText(practice.title, countLabel, botShortUrl)}
          filename="practice-breathing.png"
          eventKind="practice"
          onClose={() => s.setShowShare(false)}
        />
      )}
    </>
  );
}
