import { fmtDate } from '../../utils/format';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { useTr } from '../../utils/addressForm';
import { PatternsHero } from '../../components/PatternsHero';
import { WeekTopSummary } from '../../utils/patternsSummary';
import { ChipsSkeleton, CatalogHeader } from './CatalogParts';
import { cm, shortName } from './utils';
import { SchemasSectionProps } from './types';

interface SchemasTabProps {
  profileLoading: boolean;
  allSchemaIds: string[];
  ysqCompletedAt: string | null;
  ysqProgressAnswered: number | null;
  weekSummary: WeekTopSummary | null;
  expandedDomains: Set<string>;
  onToggleDomain: (id: string) => void;
  onOpenSchema: SchemasSectionProps['onOpenSchema'];
  onOpenDiaries?: () => void;
  onShowSchemaPicker: () => void;
  onOpenSchemaDetail: (id: string) => void;
}

export function SchemasTab({
  profileLoading,
  allSchemaIds,
  ysqCompletedAt,
  ysqProgressAnswered,
  weekSummary,
  expandedDomains,
  onToggleDomain,
  onOpenSchema,
  onOpenDiaries,
  onShowSchemaPicker,
  onOpenSchemaDetail,
}: SchemasTabProps) {
  const tr = useTr();
  return (
    <>
      {/* Hero: новичку — один очевидный вход; опытному — сводка недели */}
      {!profileLoading && (
        <PatternsHero
          hasSchemas={allSchemaIds.length > 0 || !!ysqCompletedAt}
          summary={weekSummary}
          progressAnswered={ysqProgressAnswered}
          onStartTest={() => onOpenSchema({ startTest: true })}
          onOpenLibrary={() => onOpenSchema()}
          onPickManually={onShowSchemaPicker}
          onOpenSchemaDetail={(id) => onOpenSchemaDetail(id)}
          onOpenDiaries={onOpenDiaries}
        />
      )}

      {/* МОИ СХЕМЫ */}
      {(allSchemaIds.length > 0 || ysqCompletedAt) && (
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
            Мои схемы
          </div>
          {profileLoading ? (
            <ChipsSkeleton widths={[80, 100, 90, 110]} />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {allSchemaIds.map((id) => {
                const domain = SCHEMA_DOMAINS.find((d) =>
                  d.schemas.some((s) => s.id === id),
                );
                const schema = domain?.schemas.find((s) => s.id === id);
                if (!schema || !domain) return null;
                const c = domain.color; // CSS variable — use directly
                return (
                  <button
                    key={id}
                    onClick={() => onOpenSchemaDetail(id)}
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
                    }}
                  >
                    {shortName(schema.name)}
                  </button>
                );
              })}
              <button
                onClick={onShowSchemaPicker}
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

      {/* YSQ card — прячем у новичка: hero и так зовёт к тесту */}
      {(allSchemaIds.length > 0 || ysqCompletedAt) && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 18,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--accent)',
                marginBottom: 2,
              }}
            >
              Тест на схемы
            </div>
            {/* Незаконченный прогресс приоритетнее результата: кнопка
                ведёт в тест на сохранённый вопрос (autoResume), поэтому
                и подпись «Продолжить», иначе «Результаты» открывали бы
                сам тест. */}
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              {ysqProgressAnswered != null
                ? `Начат · отвечено ${ysqProgressAnswered} из 116`
                : ysqCompletedAt
                  ? `Пройден ${fmtDate(ysqCompletedAt.slice(0, 10))} · результаты и «поделиться» внутри`
                  : tr(
                      'Определи схемы автоматически',
                      'Определите схемы автоматически',
                    )}
            </div>
          </div>
          <button
            onClick={() => onOpenSchema({ startTest: true })}
            style={{
              padding: '9px 20px',
              borderRadius: 12,
              border: 'none',
              background:
                ysqCompletedAt && ysqProgressAnswered == null
                  ? 'rgba(var(--fg-rgb),0.08)'
                  : 'linear-gradient(135deg, var(--accent), var(--accent-blue))',
              color:
                ysqCompletedAt && ysqProgressAnswered == null
                  ? 'var(--text-sub)'
                  : '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {ysqProgressAnswered != null
              ? 'Продолжить'
              : ysqCompletedAt
                ? 'Результаты'
                : 'Начать'}
          </button>
        </div>
      )}

      {/* ВСЕ СХЕМЫ */}
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
          Все схемы
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SCHEMA_DOMAINS.map((domain) => {
            const isOpen = expandedDomains.has(domain.id);
            const c = domain.color; // CSS variable
            return (
              <div
                key={domain.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                <CatalogHeader
                  color={c}
                  name={domain.domain}
                  count={domain.schemas.length}
                  open={isOpen}
                  onToggle={() => onToggleDomain(domain.id)}
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
                    {domain.schemas.map((s) => {
                      const active = allSchemaIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => onOpenSchemaDetail(s.id)}
                          style={{
                            padding: '6px 13px',
                            borderRadius: 20,
                            border: `1.5px solid ${cm(c, active ? 42 : 18)}`,
                            background: cm(c, active ? 11 : 5),
                            color: active ? c : 'var(--text-sub)',
                            fontSize: 13,
                            fontWeight: active ? 600 : 400,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            WebkitTapHighlightColor: 'transparent',
                          }}
                        >
                          {shortName(s.name)}
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
