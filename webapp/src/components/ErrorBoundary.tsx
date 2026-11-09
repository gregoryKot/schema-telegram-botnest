import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportClientError } from '../api';
import { isChunkLoadError, reloadForFreshChunks } from '../utils/chunkReload';
import { PaperOutcome } from './paper/PaperOutcome';
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
    // Устарел чанк — «обновилось» (Leaf на шалфее); упал раздел — «на нашей стороне» (Breath на персике).
    // Тот же PaperOutcome, что у исходов служебных страниц, по месту раздела (error-screen.css).
    const chunk = isChunkLoadError(this.state.error.message);
    return (
      <div className="sk-crash" data-crash-screen="boundary">
        {chunk ? (
          <PaperOutcome outcome="updated" className="sk-crash-outcome" title="Страница устарела"
                        lead="Приложение обновилось — нужна свежая версия страницы."
                        action={{ label: 'Обновить страницу', onClick: () => window.location.reload() }} />
        ) : (
          <PaperOutcome outcome="our_side" className="sk-crash-outcome" title="Раздел упал"
                        lead={<>Что-то сломалось в разделе <b>{this.props.section}</b>.</>}>
            <button type="button" className="ds-btn ds-btn--lg pa-outcome-action"
                    onClick={() => this.setState({ error: null, info: null })}>Попробовать снова</button>
            {/* Детали — под кнопкой, тихо, для поддержки: стек моноширинным серым, не красным во весь лист. */}
            <details className="sk-crash-details">
              <summary>Детали ошибки</summary>
              <div className="sk-crash-msg">{this.state.error.message}</div>
              <div className="sk-crash-stack">
                {this.state.info?.componentStack ?? this.state.error.stack ?? '(нет stack)'}
              </div>
            </details>
          </PaperOutcome>
        )}
      </div>
    );
  }
}
