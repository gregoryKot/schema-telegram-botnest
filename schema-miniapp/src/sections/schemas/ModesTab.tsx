import { MODE_GROUPS, ALL_MODES } from '../../schemaTherapyData';
import { ModesHero, INTRO_MODE_ID } from '../../components/ModesHero';
import { WeekTopSummary } from '../../utils/patternsSummary';
import { ChipsSkeleton, CatalogHeader } from './CatalogParts';
import { cm } from './utils';
import { SchemasSectionProps } from './types';

interface ModesTabProps {
  profileLoading: boolean;
  myModeIds: string[];
  modeSummary: WeekTopSummary | null;
  expandedModeGroups: Set<string>;
  onToggleModeGroup: (id: string) => void;
  onOpenSchema: SchemasSectionProps['onOpenSchema'];
  onOpenDiaries?: () => void;
  onShowModePicker: () => void;
  onOpenModeIntro: (id: string) => void;
}

export function ModesTab({
  profileLoading,
  myModeIds,
  modeSummary,
  expandedModeGroups,
  onToggleModeGroup,
  onOpenSchema,
  onOpenDiaries,
  onShowModePicker,
  onOpenModeIntro,
}: ModesTabProps) {
  const myModes = myModeIds
    .map((id) => ALL_MODES.find((m) => m.id === id))
    .filter(Boolean) as typeof ALL_MODES;

  return (
    <>
      {/* Hero: новичку — знакомство с Критиком; опытному — сводка недели */}
      {!profileLoading && (
        <ModesHero
          hasModes={myModeIds.length > 0}
          summary={modeSummary}
          onMeetCritic={() => onOpenModeIntro(INTRO_MODE_ID)}
          onOpenLibrary={() => onOpenSchema({ tab: 'modes' })}
          onPickManually={onShowModePicker}
          onOpenModeDetail={(id) => onOpenModeIntro(id)}
          onOpenDiaries={onOpenDiaries}
        />
      )}

      {/* МОИ РЕЖИМЫ */}
      {myModeIds.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
              marginBottom: 10,
            }}
          >
            Мои режимы
          </div>
          {profileLoading ? (
            <ChipsSkeleton widths={[90, 110, 80]} />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {myModes.map((m) => {
                const c = m.groupColor; // CSS variable
                return (
                  <button
                    key={m.id}
                    onClick={() => onOpenModeIntro(m.id)}
                    style={{
                      padding: '6px 13px',
                      borderRadius: 20,
                      border: `1.5px solid ${cm(c, 35)}`,
                      background: cm(c, 9),
                      color: c,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      WebkitTapHighlightColor: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{m.emoji}</span>
                    {m.name}
                  </button>
                );
              })}
              <button
                onClick={onShowModePicker}
                style={{
                  padding: '6px 13px',
                  borderRadius: 20,
                  border: '1.5px dashed var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-sub)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                + Добавить
              </button>
            </div>
          )}
        </div>
      )}

      {/* ВСЕ РЕЖИМЫ */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            marginBottom: 10,
          }}
        >
          Все режимы
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MODE_GROUPS.map((group) => {
            const isOpen = expandedModeGroups.has(group.id);
            const c = group.color; // CSS variable
            return (
              <div
                key={group.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                <CatalogHeader
                  color={c}
                  name={group.group}
                  count={group.items.length}
                  open={isOpen}
                  onToggle={() => onToggleModeGroup(group.id)}
                />
                {isOpen && (
                  <div
                    style={{
                      padding: '0 16px 14px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    {group.items.map((m) => {
                      const active = myModeIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => onOpenModeIntro(m.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 20,
                            border: `1.5px solid ${cm(c, active ? 42 : 18)}`,
                            background: cm(c, active ? 11 : 5),
                            color: active ? c : 'var(--text-sub)',
                            fontSize: 13,
                            fontWeight: active ? 600 : 400,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            WebkitTapHighlightColor: 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <span style={{ fontSize: 14 }}>{m.emoji}</span>
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
