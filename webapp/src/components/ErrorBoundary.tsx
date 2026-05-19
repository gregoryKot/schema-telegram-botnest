import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; section: string }
interface State { error: Error | null; info: ErrorInfo | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    // eslint-disable-next-line no-console
    console.error(`[${this.props.section}] crashed:`, error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page-inner-wide">
        <div className="section" style={{ paddingTop: 48 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 12 }}>Раздел упал</h1>
          <div className="text-md muted" style={{ marginBottom: 24, maxWidth: 600 }}>
            Что-то сломалось в разделе <b>{this.props.section}</b>. Это баг — пришли мне скриншот, я починю.
          </div>
          <details style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 8, fontFamily: 'monospace', fontSize: 12 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: 8 }}>Детали ошибки</summary>
            <div style={{ color: 'var(--c-rose)', marginBottom: 12, whiteSpace: 'pre-wrap' }}>
              {this.state.error.message}
            </div>
            <div style={{ color: 'var(--text-sub)', whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>
              {this.state.info?.componentStack ?? this.state.error.stack ?? '(нет stack)'}
            </div>
          </details>
          <button
            className="btn btn-secondary"
            style={{ marginTop: 16 }}
            onClick={() => { this.setState({ error: null, info: null }); }}
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }
}
