import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportClientError } from '../api';
import { isChunkLoadError, reloadForFreshChunks } from '../utils/chunkReload';
import '../styles/sheet-tasks.css';

interface Props { children: ReactNode; section: string }
interface State { error: Error | null; info: ErrorInfo | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
     
    console.error(`[${this.props.section}] crashed:`, error, info?.componentStack);
    // Устаревший чанк после деплоя — перезагрузка на свежую версию (chunkReload.ts).
    const isChunk = isChunkLoadError(error.message);
    if (isChunk) reloadForFreshChunks();
    // Видимость прода: реальные краши уезжают на бэкенд → DM админу. Chunk-load
    // после деплоя — не баг (лечится авто-релоадом выше), его не шлём.
    if (!isChunk) {
      reportClientError({
        message: error.message,
        section: this.props.section,
        stack: error.stack,
        componentStack: info?.componentStack ?? undefined,
      });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const isChunkError = isChunkLoadError(this.state.error.message);
    return (
      <div className="sk-crash">
        <div className="ds-card sk-crash-card">
          {isChunkError ? (
            <>
              <h1 className="ds-h2">Страница устарела</h1>
              <p className="sk-crash-text">
                Приложение обновилось — нужна свежая версия страницы.
              </p>
              <button className="ds-btn" onClick={() => window.location.reload()}>
                Обновить страницу
              </button>
            </>
          ) : (
            <>
              <h1 className="ds-h2">Раздел упал</h1>
              <p className="sk-crash-text">
                Что-то сломалось в разделе <b>{this.props.section}</b>.
              </p>
              <details className="sk-crash-details">
                <summary>Детали ошибки</summary>
                <div className="sk-crash-msg">{this.state.error.message}</div>
                <div className="sk-crash-stack">
                  {this.state.info?.componentStack ?? this.state.error.stack ?? '(нет stack)'}
                </div>
              </details>
              <button
                className="ds-btn ds-btn--secondary"
                onClick={() => { this.setState({ error: null, info: null }); }}
              >
                Попробовать снова
              </button>
            </>
          )}
        </div>
      </div>
    );
  }
}
