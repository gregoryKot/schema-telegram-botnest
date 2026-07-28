// Техника «Стоп» (S.T.O.P. из DBT — Stop, Take a step back, Observe,
// Proceed mindfully): экран «Здесь и сейчас», по образцу GroundingSheet.
// Пауза между импульсом и действием — четыре шага. Пошаговый рендер — общий
// примитив StepFlowSheet (правило «одна механика — один компонент»).
// Событие stop_start парное с ANALYTICS_EVENTS на бэке
// (src/analytics/analytics.constants.ts) — уже зарегистрировано там.
import { useEffect } from 'react';
import { StepFlowSheet, FlowStep } from './StepFlowSheet';
import { useTr } from '../utils/addressForm';
import { api } from '../api';

const buildSteps = (tr: (ty: string, vy: string) => string): FlowStep[] => [
  {
    emoji: '🛑',
    title: tr('С — Стоп. Замри на секунду', 'С — Стоп. Замрите на секунду'),
    hint: 'Не отвечать, не решать, не жать «отправить». Пауза — уже действие.',
  },
  {
    emoji: '🌬️',
    title: tr(
      'Т — Тайм-аут. Сделай шаг назад',
      'Т — Тайм-аут. Сделайте шаг назад',
    ),
    hint: 'Медленный вдох, длинный выдох. Можно физически отойти — от разговора, от экрана.',
  },
  {
    emoji: '👀',
    title: tr(
      'О — Осмотрись. Что происходит?',
      'О — Осмотритесь. Что происходит?',
    ),
    hint: 'Что я чувствую? Что делает тело? Какая мысль пришла первой? Просто заметить, без оценок.',
  },
  {
    emoji: '🧭',
    title: tr('П — Продолжай осознанно', 'П — Продолжайте осознанно'),
    hint: 'Как поступил бы Здоровый Взрослый? Теперь следующий шаг — осознанный выбор, а не импульс.',
  },
];

export function StopSheet({ onClose }: { onClose: () => void }) {
  const tr = useTr();

  useEffect(() => {
    api.trackEvent('stop_start');
  }, []);

  return (
    <StepFlowSheet
      title="Техника «Стоп»"
      subtitle="Пауза между импульсом и действием — четыре шага, чтобы выбрать ответ, а не среагировать на автомате"
      steps={buildSteps(tr)}
      done={{
        emoji: '🌤',
        title: tr(
          'Пауза сработала. Выбор снова за тобой',
          'Пауза сработала. Выбор снова за вами',
        ),
        hint: 'Чем чаще повторять «Стоп», тем быстрее он включается сам — прямо посреди сильной эмоции.',
      }}
      onClose={onClose}
    />
  );
}
