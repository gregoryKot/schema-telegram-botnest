export function GamePage() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#1a0800',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <iframe
        title="Игра «Всё по схеме»"
        src="/phaser-game/index.html"
        style={{
          width: '100%',
          maxWidth: 960,
          height: '60vw',
          maxHeight: 540,
          minHeight: 300,
          border: 'none',
          borderRadius: 8,
          display: 'block',
        }}
        allowFullScreen
      />
    </div>
  );
}
