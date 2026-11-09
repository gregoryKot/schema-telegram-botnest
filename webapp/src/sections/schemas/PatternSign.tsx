import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { SignArt } from '../../components/art/SignArt';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';

/** Знак паттерна по виду — из ENTITY_LOOK (схема — слои, режим — круги), рисунок — общий реестр SignArt. */
export function PatternSign({ kind }: { kind: MyCardsKind }) {
  return <span className="pp-row-art"><SignArt sign={ENTITY_LOOK[kind === 'mode' ? 'modes' : 'schemas'].sign} size="row" /></span>;
}
