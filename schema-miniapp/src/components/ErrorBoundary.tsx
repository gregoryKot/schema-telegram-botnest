// Секционный ErrorBoundary (аудит 2026-07, этап 3): падение компонента
// внутри одной секции не должно убивать весь мини-апп. Глобальный boundary
// в main.tsx остаётся последним рубежом (краш вне секций / в самом App).
// Аналог webapp/src/components/ErrorBoundary.tsx, стили — миниаппные.
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  section: string;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[${this.props.section}] crashed:`,
      error,
      info?.componentStack,
    );
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          padding: '48px 24px 90px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 36 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
          Раздел «{this.props.section}» не открылся
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-sub)',
            maxWidth: 300,
            wordBreak: 'break-word',
            lineHeight: 1.6,
          }}
        >
          {this.state.error.message}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '11px 20px',
              border: 'none',
              borderRadius: 12,
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Попробовать снова
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '11px 20px',
              border: '1px solid rgba(var(--fg-rgb),0.15)',
              borderRadius: 12,
              background: 'none',
              color: 'var(--text)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Перезапустить
          </button>
        </div>
      </div>
    );
  }
}
