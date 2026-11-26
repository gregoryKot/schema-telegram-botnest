import { useState } from 'react';
import { type ModeMapNode } from '../api';
import { useModeMapConcept } from './modeMap/clientConceptContext';
import { CustomModesPalette } from './modeMap/CustomModesPalette';
import { useCustomModes } from './modeMap/useCustomModes';
import { PaletteCatalog } from './modeMap/PaletteCatalog';
import { PaletteClient } from './modeMap/PaletteClient';
import { PaletteFigures } from './modeMap/PaletteFigures';
import { PaletteRow } from './modeMap/PaletteParts';
import { searchPalette } from './modeMap/paletteModel';
import { normalizeQuery } from './modeMap/paletteSearch';
import '../styles/sheet-modemap.css';

interface Props { onAdd: (node: Omit<ModeMapNode, 'position'>) => void; onAddMany?: (nodes: Omit<ModeMapNode, 'position'>[]) => void }

/**
 * Палитра холста. По умолчанию — только то, что кладут на карту почти всегда: «Этот клиент»
 * (режимы и схемы из концептуализации, свои режимы терапевта) и фигуры. Весь каталог —
 * одной строкой внизу (PaletteCatalog). Поиск идёт по всему, включая закрытый каталог,
 * и показывает найденное плоским списком. Язык знаков — docs/design/PAPER_2026-11.md.
 */
export function ModeMapPalette({ onAdd, onAddMany }: Props) {
  const [search, setSearch] = useState('');
  const [customModes, setCustomModes] = useCustomModes();
  const concept = useModeMapConcept();
  const q = normalizeQuery(search);
  const mine = Array.isArray(customModes) ? customModes : [];
  const clientEmpty = concept === 'failed' || (concept !== null && concept.modeIds.length + concept.schemaIds.length === 0);
  const custom = <CustomModesPalette state={customModes} setState={setCustomModes} onAdd={onAdd} />;
  const found = q ? searchPalette(q, mine) : [];

  return (
    <div className="ds-card mm2-pal">
      <div className="mm2-pal-search">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Режим или схема…" className="ds-input ds-input--search" />
      </div>

      <div className="mm2-pal-scroll">
        {q ? (
          found.length > 0
            ? <div className="mm2-found">{found.map(item => <PaletteRow key={item.id} item={item} onAdd={onAdd} />)}</div>
            : <p className="ds-empty mm2-pal-empty">Ничего не найдено</p>
        ) : (
          <>
            <h3 className="mm2-pal-block">Этот клиент</h3>
            <PaletteClient onAdd={onAdd} onAddMany={onAddMany} />
            {mine.length > 0 && custom}
            <h3 className="mm2-pal-block">Фигуры</h3>
            <PaletteFigures onAdd={onAdd} />
            <PaletteCatalog clientEmpty={clientEmpty} onAdd={onAdd}>{mine.length === 0 && custom}</PaletteCatalog>
          </>
        )}
      </div>
    </div>
  );
}
