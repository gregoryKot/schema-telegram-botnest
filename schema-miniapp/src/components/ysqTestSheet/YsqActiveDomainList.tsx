import { YsqActiveSchemaCard } from './YsqActiveSchemaCard';
import type { ResultView, Scores } from './types';

// Активные схемы, сгруппированные по доменам — вынесено из
// YsqResultView.tsx (правило №10, файл был у потолка).
export function YsqActiveDomainList({
  activeByDomain,
  scores,
  getSchemaDelta,
  ratings,
  onViewSchemas,
  onClose,
}: {
  activeByDomain: ResultView['activeByDomain'];
  scores: Scores;
  getSchemaDelta: ResultView['getSchemaDelta'];
  ratings?: Record<string, number>;
  onViewSchemas?: (schemaName: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      {activeByDomain.map((domain) => (
        <div key={domain.needId} style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-sub)',
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            {domain.label}
          </div>
          {domain.schemas.map((schema) => (
            <YsqActiveSchemaCard
              key={schema.name}
              schema={schema}
              score={scores[schema.name]}
              delta={getSchemaDelta(schema.name)}
              diaryRating={ratings?.[schema.needId]}
              onViewSchemas={onViewSchemas}
              onClose={onClose}
            />
          ))}
        </div>
      ))}
    </>
  );
}
