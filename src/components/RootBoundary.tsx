import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class RootBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // Visible in the tab title so the error is diagnosable even on a phone.
    document.title = `ERROR: ${error.message.slice(0, 60)}`;
    // eslint-disable-next-line no-console
    console.error('RootBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const e = this.state.error;
      return (
        <div
          style={{
            minHeight: '100vh',
            padding: '2rem',
            background: '#030A10',
            color: '#C9DDE8',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          }}
        >
          <h1 style={{ color: '#F87171', fontSize: '1.4rem', marginBottom: '1rem' }}>
            App failed to load
          </h1>
          <p style={{ color: '#94AEBF', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            The error below is also in the browser tab title. Open DevTools
            (F12) for the full stack trace.
          </p>
          <pre
            style={{
              background: '#0B1A24',
              border: '1px solid #7F1D1D',
              borderRadius: 8,
              padding: '1rem',
              overflow: 'auto',
              color: '#FCA5A5',
              fontSize: '0.75rem',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {e.message}
            {'\n\n'}
            {(e.stack || '').split('\n').slice(0, 20).join('\n')}
          </pre>
          <p style={{ color: '#5E8FA8', fontSize: '0.8rem', marginTop: '1.5rem' }}>
            Try a hard reload: Ctrl+Shift+R (or Cmd+Shift+R on macOS).
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
