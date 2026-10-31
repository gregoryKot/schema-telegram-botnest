import type { ConceptModeLink } from '../../apiTypes';
import { IdentityDot } from '../../components/IdentityDot';
import {
  getModeById,
  getSchemaById,
} from '../../schemaTherapy/schemaTherapyData';
import { colorMix } from '../../utils/colorMix';
import { findModeLink, normalizeModeLinks } from './modeLinks';

/**
 * Схемы за режимами в карточке «Карта режимов» вида «Поля» (issue #879):
 * терапевт видел чипы режимов, но не видел, какие схемы за каждым стоят, хотя
 * связи уже лежат в `modeLinks`. Здесь связи только ЧИТАЮТСЯ — редактируются
 * они в одном месте, в виде «Схема» (правило «одна механика — один
 * компонент»); без связей — честное «схемы не привязаны» и ссылка туда.
 * Режим с неизвестным id пропускается, имя — alias из связи, иначе из реестра.
 */
const EYEBROW = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--text-sub)',
  marginBottom: 'var(--space-6)',
  paddingLeft: 2,
} as const;

export function ModeSchemasList({
  activeModeIds,
  modeLinks,
  onGoToGraph,
}: {
  activeModeIds: string[];
  modeLinks: ConceptModeLink[] | undefined;
  onGoToGraph?: () => void;
}) {
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
      <div style={EYEBROW}>Схемы за режимами</div>
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
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
                color: 'var(--text)',
              }}
            >
              <IdentityDot color={mode.groupColor} size={7} />
              {label}
            </span>
            {schemas.length > 0 ? (
              schemas.map((s) => (
                <span
                  key={s.id}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--r-20)',
                    fontSize: 12,
                    color: 'var(--text)',
                    background: colorMix(s.domainColor, 14),
                  }}
                >
                  {s.name}
                </span>
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
                    style={{
                      minHeight: 44,
                      padding: '0 var(--space-6)',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--accent)',
                      fontSize: 13,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
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
