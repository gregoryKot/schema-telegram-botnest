// Знак сущности крупно по ключу ENTITY_LOOK — с тенью-вырезкой, как на плитках лендинга
// (SignScene, SceneParts.tsx: под знаком тот же знак тоном глубже бумаги, со сдвигом).
// Один вход для героев потоков (EntitySheet), исходов (PaperOutcome) и наклеек: экран
// передаёт ключ, а не импортирует мотив на месте. SignScene ждёт компонент — компонент
// на ключ создаётся один раз и живёт в кэше: новый на каждый рендер React перемонтировал бы.
// Знак крупно лежит на своей бумаге — плашка Check бумагой --surface (plate, вариант мотива).
import type { ReactElement } from 'react';
import type { SignKey } from '../../../../shared/src/theme/entityLook';
import type { ArtProps } from '../art/paper';
import { SignScene } from '../art/SceneParts';
import { SignArt } from '../art/SignArt';

type Art = (p: ArtProps) => ReactElement;
const ART_BY_KEY = new Map<string, Art>();

function artFor(sign: SignKey, count?: number): Art {
  const id = `${sign}:${count ?? ''}`;
  let art = ART_BY_KEY.get(id);
  if (!art) {
    art = function KeySign({ size }: ArtProps) {
      return <SignArt sign={sign} size={size} plate="surface" count={count} />;
    };
    ART_BY_KEY.set(id, art);
  }
  return art;
}

/** Знак по ключу крупно, с тенью-вырезкой; ширину задаёт место (CSS `.scn-sign` внутри).
 *  `count` — вариант мотива по счёту (значок достижения). */
export function SignHero({ sign, count, className }: { sign: SignKey; count?: number; className?: string }) {
  return <SignScene Art={artFor(sign, count)} className={className} />;
}
