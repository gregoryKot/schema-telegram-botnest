import type { ConceptModeLink } from '../../apiTypes';
import {
  getModeById,
  getSchemaById,
} from '../../schemaTherapy/schemaTherapyData';
import { domainLook, modeLook } from '../../theme/entityLook';
import { ConceptSign, ConceptTag } from './conceptPaper';
import { useConceptSkin } from './conceptSkin';
import { findModeLink, normalizeModeLinks } from './modeLinks';

const MODE_NAME = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontWeight: 600,
  color: 'var(--text)',
} as const;

/**
 * Схемы за режимами в карточке «Карта режимов» вида «Поля»: связи из `modeLinks`
 * здесь только ЧИТАЮТСЯ — редактируются они в одном месте, в виде «Схема»
 * (правило «одна механика — один компонент»); без связей — честное «схемы не
 * привязаны» и ссылка туда. Режим с неизвестным id пропускается, имя — alias
 * из связи, иначе из реестра.
 */
export function ModeSchemasList({
  activeModeIds,
  modeLinks,
  onGoToGraph,
}: {
  activeModeIds: string[];
  modeLinks: ConceptModeLink[] | undefined;
  onGoToGraph?: () => void;
}) {
  const skin = useConceptSkin();
  if (activeModeIds.length === 0) return null;
  const links = normalizeModeLinks(modeLinks);
  const rows = activeModeIds.flatMap((id) => {
    const mode = getModeById(id);
    if (!mode) return [];
    const link = findModeLink(links, id);
    const schemas = link.schemaIds
      .map((sid) => getSchemaById(sid))
      .filter((s): s is NonNullable<typeof s> => s !== undefined);
    return [{ mode, label: link.alias.trim() || mode.name, schemas }];
  });
  if (rows.length === 0) return null;

  return (
    <div className="u-mt8">
      <div className={skin ? `${skin.label} u-mb6` : 'u-mb6'}>
        Схемы за режимами
      </div>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-6)',
        }}
      >
        {rows.map(({ mode, label, schemas }) => (
          <li
            key={mode.id}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 'var(--space-6)',
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            <span style={MODE_NAME}>
              <ConceptSign sign={modeLook(mode.id, mode.groupId).sign} />
              {label}
            </span>
            {schemas.length > 0 ? (
              schemas.map((s) => (
                <ConceptTag key={s.id} sign={domainLook(s.domainId)?.sign}>
                  {s.name}
                </ConceptTag>
              ))
            ) : (
              <>
                <span className="u-sub">схемы не привязаны</span>
                {onGoToGraph && (
                  <button
                    type="button"
                    onClick={onGoToGraph}
                    className={skin?.link}
                  >
                    привязать в виде «Схема»
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
