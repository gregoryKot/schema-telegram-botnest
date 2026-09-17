// Компактная карточка статуса теста YSQ (вход к результатам/продолжению) —
// вынесена из SchemasTab.tsx, чтобы освободить бюджет строк файла под
// правило №10 CLAUDE.md (файл-храповик), без изменения поведения.
import { fmtDate } from '../../utils/format';
import { useTr } from '../../utils/addressForm';
import { SchemasSectionProps } from './types';

interface Props {
  ysqCompletedAt: string | null;
  ysqProgressAnswered: number | null;
  onOpenSchema: SchemasSectionProps['onOpenSchema'];
}

export function YsqStatusCard({
  ysqCompletedAt,
  ysqProgressAnswered,
  onOpenSchema,
}: Props) {
  const tr = useTr();
  return (
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
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
          {ysqProgressAnswered != null
            ? `Начат · отвечено ${ysqProgressAnswered} из 116`
            : ysqCompletedAt
              ? `Пройден ${fmtDate(ysqCompletedAt.slice(0, 10))} · результаты внутри`
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
          borderRadius: 'var(--r-12)',
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
  );
}
