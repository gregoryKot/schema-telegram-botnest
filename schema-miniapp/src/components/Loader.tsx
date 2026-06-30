const CATS = ['🐱', '🐈', '😸', '🙀', '😻'];
const PHRASES = [
  'Котик считает потребности',
  'Загружаю твой день',
  'Смотрю в зеркало твоей души',
  'Собираю паттерны',
  'Почти готово',
];

const cat = CATS[Math.floor(Math.random() * CATS.length)];
const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];

export function Loader({ minHeight = '60vh' }: { minHeight?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight, gap: 12,
    }}>
      <div style={{
        fontSize: 42,
        animation: 'catBounce 1s ease-in-out infinite',
      }}>
        {cat}
      </div>
      <div style={{
        fontSize: 13, color: 'var(--text-sub)',
        display: 'flex', gap: 3, alignItems: 'center',
      }}>
        {phrase}
        <span style={{ animation: 'dots 1.4s steps(4, end) infinite', letterSpacing: 1 }}>...</span>
      </div>
      <style>{`
        @keyframes catBounce {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50%       { transform: translateY(-10px) rotate(3deg); }
        }
        @keyframes dots {
          0%  { clip-path: inset(0 100% 0 0); }
          25% { clip-path: inset(0 66%  0 0); }
          50% { clip-path: inset(0 33%  0 0); }
          75% { clip-path: inset(0 0    0 0); }
        }
      `}</style>
    </div>
  );
}
