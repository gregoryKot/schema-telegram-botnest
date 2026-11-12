import type { ConceptModeLink } from '../../apiTypes';
import {
  getModeById,
  getSchemaById,
} from '../../schemaTherapy/schemaTherapyData';
import { domainLook, modeLook } from '../../theme/entityLook';
import { EYEBROW, LINK_BTN, MODE_NAME } from './conceptInlineStyles';
import { ConceptSign, ConceptTag } from './conceptPaper';
import { useConceptSkin } from './conceptSkin';
import { findModeLink, normalizeModeLinks } from './modeLinks';

/**
 * Схемы за режимами в карточке «Карта режимов» вида «Поля» (issue #879):
 * терапевт видел чипы режимов, но не видел, какие схемы за каждым стоят, хотя
 * связи уже лежат в `modeLinks`. Здесь связи только ЧИТАЮТСЯ — редактируются
 * они в одном месте, в виде «Схема» (правило «одна механика — один
 * компонент»); без связей — честное «схемы не привязаны» и ссылка туда.
 * Режим с неизвестным id пропускается, имя — alias из связи, иначе из реестра.
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
    <div style={{ marginTop: 'var(--space-8)' }}>
      <div
        className={skin?.label}
        style={skin ? { marginBottom: 'var(--space-6)' } : EYEBROW}
      >
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
                <span style={{ color: 'var(--text-sub)' }}>
                  схемы не привязаны
                </span>
                {onGoToGraph && (
                  <button
                    type="button"
                    onClick={onGoToGraph}
                    className={skin?.link}
                    style={skin ? undefined : LINK_BTN}
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
