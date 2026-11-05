import { Layers } from '../../components/art/PaperArt';
import { Cluster } from '../../components/art/PaperArtSigns';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';

/** Знак паттерна по виду: схема — слои, режим — круги. */
export function PatternSign({ kind }: { kind: MyCardsKind }) {
  return <span className="pp-row-art">{kind === 'mode' ? <Cluster size="row" /> : <Layers size="row" />}</span>;
}
