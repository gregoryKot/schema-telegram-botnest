// Живые весы проверки убеждения — знак упражнения (Scales) на листе-герое со счётом: на левой чаше
// столько камешков, сколько доказательств «за», на правой — «против», перекладина клонится к
// тяжёлой стороне (вариант мотива left/right, GuideSignsTechniques.tsx; тест «счёт → камешки» —
// PaperArtVariants.test.tsx). Тень — тот же знак сдвинутым слоем (SignScene), без filter.
// SignScene ждёт компонент: он один на модуль, счёт приходит контекстом — новый компонент на
// каждый рендер перемонтировал бы рисунок (приём SignHero).
import { createContext, useContext } from 'react';
import type { ArtProps } from '../../art/paper';
import { SignScene } from '../../art/SceneParts';
import { Scales } from '../../art/GuideSignsTechniques';

const Count = createContext({ left: 0, right: 0 });

function CountedScales({ size }: ArtProps) {
  const { left, right } = useContext(Count);
  return <Scales size={size} left={left} right={right} />;
}

export function BeliefScales({ left, right }: { left: number; right: number }) {
  return (
    <Count.Provider value={{ left, right }}>
      <SignScene Art={CountedScales} className="ex2-belief-scales" />
    </Count.Provider>
  );
}
