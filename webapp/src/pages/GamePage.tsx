import { GameCanvas } from '../game/GameCanvas';

const CONTROLS_HINT = '← → передвижение · ↑ / пробел — прыжок · подойди к барьеру чтобы узнать схему';

export function GamePage() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#1c1916',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <a href="/" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none' }}>
          ← СхемаЛаб
        </a>
        <h1 style={{
          color: '#f5f2eb', fontSize: 28, fontWeight: 700,
          margin: '12px 0 4px', fontFamily: 'system-ui',
        }}>
          Путь к терапевту
        </h1>
        <p style={{ color: 'rgba(245,242,235,0.5)', fontSize: 13, margin: 0 }}>
          Три мира · 15 схем · один путь к себе
        </p>
      </div>

      {/* World badges */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['До звонка', 'Первые сессии', 'Между сессиями'] as const).map((name, i) => (
          <div key={i} style={{
            padding: '4px 12px', borderRadius: 20,
            background: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.5)', fontSize: 11,
          }}>
            {i + 1}. {name}
          </div>
        ))}
      </div>

      {/* Game */}
      <GameCanvas />

      {/* Controls hint */}
      <p style={{
        marginTop: 16, color: 'rgba(255,255,255,0.25)',
        fontSize: 11, textAlign: 'center', maxWidth: 480,
      }}>
        {CONTROLS_HINT}
      </p>
    </div>
  );
}
