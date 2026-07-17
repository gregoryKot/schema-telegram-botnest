import { getTherapistContact } from '../../utils/therapistContact';

interface ResultCtaProps {
  activeCount: number;
  tr: (ty: string, vy: string) => string;
}

export function ResultCta({ activeCount, tr }: ResultCtaProps) {
  if (activeCount === 0) return null;

  return (
    <div
      style={{
        marginTop: 8,
        marginBottom: 16,
        background: 'color-mix(in srgb, var(--accent) 7%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
        borderRadius: 16,
        padding: '16px 18px',
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--accent)',
          marginBottom: 8,
        }}
      >
        {tr('Хочешь разобраться глубже?', 'Хотите разобраться глубже?')}
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-sub)',
          lineHeight: 1.65,
          marginBottom: 12,
        }}
      >
        Схемы — паттерны, сложившиеся давно. Их можно менять, но это требует
        времени и поддержки. Схема-терапия — один из самых эффективных методов
        для этой работы.
      </div>
      <a
        href={getTherapistContact().url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'block',
          textAlign: 'center',
          padding: '11px 0',
          borderRadius: 12,
          background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
          color: 'var(--accent)',
          fontSize: 14,
          fontWeight: 500,
          textDecoration: 'none',
        }}
      >
        {getTherapistContact().name === 'автору'
          ? 'Поговорить с психологом →'
          : `Написать ${getTherapistContact().name} →`}
      </a>
    </div>
  );
}
