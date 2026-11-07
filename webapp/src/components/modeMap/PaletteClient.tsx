import { Layers } from '../art/PaperArt';
import { Cluster } from '../art/PaperArtSigns';
import { Skeleton } from '../Skeleton';
import { useModeMapConcept } from './clientConceptContext';
import type { Draft } from './modeDraft';
import { clientModeItem, clientSchemaItem, type PaletteItem } from './paletteModel';
import { PaletteHead, PaletteRow } from './PaletteParts';

interface Props {
  onAdd: (node: Draft) => void;
  onAddMany?: (nodes: Draft[]) => void;
}

const known = (i: PaletteItem | null): i is PaletteItem => i !== null;

/**
 * Блок палитры «Этот клиент»: режимы и схемы из концептуализации — то, что кладут на карту
 * почти всегда. Сбой загрузки показывается словами, а не пустотой: пустой блок терапевт
 * прочёл бы как «у клиента ничего не отмечено» (три молчания карты режимов).
 */
export function PaletteClient({ onAdd, onAddMany }: Props) {
  const concept = useModeMapConcept();
  if (concept === null) {
    return (
      <div className="mm2-pal-skel" aria-hidden>
        {[70, 55, 62].map(w => <Skeleton key={w} width={`${w}%`} height={12} />)}
      </div>
    );
  }
  if (concept === 'failed') return <p className="mm2-pal-sub is-err">Не удалось загрузить режимы и схемы клиента</p>;
  const modes = concept.modeIds.map(clientModeItem).filter(known);
  const schemas = concept.schemaIds.map(clientSchemaItem).filter(known);
  if (modes.length + schemas.length === 0) return <p className="mm2-pal-sub">Режимы и схемы из концептуализации появятся здесь</p>;
  return (
    <>
      {modes.length > 0 && (
        <div className="mm2-sec">
          <PaletteHead art={<Cluster size="row" />} title="Режимы" count={modes.length}>
            {onAddMany && (
              <button onClick={() => onAddMany(modes.map(m => m.draft()))} className="mm2-pal-link"
                title="Вынести все режимы клиента на карту" aria-label="Вынести все режимы клиента на карту">+ все</button>
            )}
          </PaletteHead>
          {modes.map(m => <PaletteRow key={m.id} item={m} onAdd={onAdd} />)}
        </div>
      )}
      {schemas.length > 0 && (
        <div className="mm2-sec">
          <PaletteHead art={<Layers size="row" />} title="Схемы" count={schemas.length} />
          {schemas.map(s => <PaletteRow key={s.id} item={s} onAdd={onAdd} />)}
        </div>
      )}
    </>
  );
}
