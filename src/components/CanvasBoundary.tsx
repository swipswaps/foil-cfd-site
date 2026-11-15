import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { error: Error | null }

export class CanvasBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('CanvasBoundary caught:', error);
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0B2545',
              color: '#94C9E8',
              padding: '2rem',
              textAlign: 'center',
              fontFamily: 'system-ui, sans-serif',
              fontSize: '0.85rem',
            }}
          >
            <div>
              <div style={{ color: '#F87171', fontWeight: 600, marginBottom: '0.5rem' }}>
                3D scene failed to load
              </div>
              <div style={{ color: '#5E8FA8', fontSize: '0.75rem' }}>
                {this.state.error.message}
              </div>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
