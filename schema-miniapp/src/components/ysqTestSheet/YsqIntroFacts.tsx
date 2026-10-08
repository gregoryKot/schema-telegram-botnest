import { useTr } from '../../utils/addressForm';

// Три факта о тесте на первом экране: сколько утверждений, сколько времени,
// что на выходе. Вынесено из YsqIntro (правило №10: файл не пухнет дальше).
export function YsqIntroFacts() {
  const tr = useTr();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-8)',
        marginBottom: 20,
      }}
    >
      {[
        [
          '116 утверждений',
          tr('Оцени каждое от 1 до 6', 'Оцените каждое от 1 до 6'),
        ],
        ['~10 минут', 'Можно прервать — прогресс сохраняется'],
        ['20 схем', 'Результат с описанием и советом для каждой'],
      ].map(([title, desc]) => (
        <div
          key={title}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-14)',
            background: 'rgba(var(--fg-rgb),0.04)',
            borderRadius: 'var(--r-14)',
            padding: '12px 16px',
          }}
        >
          <div>
            <div className="u-h14">{title}</div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                marginTop: 1,
              }}
            >
              {desc}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
