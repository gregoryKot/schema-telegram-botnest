// Знак фазы шаблона после автономии — завершение и поддерживающие встречи (вид — ENDING_LOOK,
// shared/src/theme/pathLook.ts). Язык — как у стадий пути (PathSigns.tsx): полоска — клиент, камешек — веха.
import { PAPER, type ArtProps } from './paper';
import { PaperSvg as Svg } from './PaperSvg';
import { Ground } from './techniqueSignParts';

/** Завершение: полоска ушла вперёд сама, позади вехи-камешки всё реже — встречи редеют. */
export function PathEnding({ size }: ArtProps) {
  return (
    <Svg size={size} viewBox="0 0 120 64">
      <Ground y={58} />
      <ellipse cx="12" cy="52" rx="8" ry="5.5" fill={PAPER.clay} />
      <ellipse cx="32" cy="52" rx="8" ry="5.5" fill={PAPER.amber} />
      <ellipse cx="62" cy="52" rx="8" ry="5.5" fill={PAPER.sage} />
      <rect x="92" y="20" width="16" height="38" rx="8" fill={PAPER.moss} />
      <path d="M100 20 C 100 12, 104 8, 110 6" fill="none" strokeLinecap="round" stroke={PAPER.moss} strokeWidth="4" />
    </Svg>
  );
}
