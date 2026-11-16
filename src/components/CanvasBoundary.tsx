import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { error: Error | null; retryKey: number }

export class CanvasBoundary extends Component<Props, State> {
  state: State = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('CanvasBoundary caught:', error);
  }

  handleRetry = () => {
    this.setState((s) => ({ error: null, retryKey: s.retryKey + 1 }));
  };

  handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      const msg = this.state.error.message || '';
      const isWebGL = /webgl/i.test(msg);
      return (
        <div className="canvas-fallback">
          <div className="canvas-fallback-body">
            <div className="canvas-fallback-title">3D scene unavailable</div>
            <div className="canvas-fallback-msg">{msg}</div>
            {isWebGL && (
              <ul className="canvas-fallback-hints">
                <li>Close other browser tabs with 3D content</li>
                <li>Check that hardware acceleration is on (chrome://gpu)</li>
                <li>On Linux, verify GPU drivers are installed</li>
              </ul>
            )}
            <div className="canvas-fallback-actions">
              <button
                type="button"
                className="canvas-fallback-btn"
                onClick={this.handleRetry}
              >
                Retry
              </button>
              <button
                type="button"
                className="canvas-fallback-btn canvas-fallback-btn-ghost"
                onClick={this.handleReload}
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return <div key={this.state.retryKey} style={{ width: '100%', height: '100%' }}>{this.props.children}</div>;
  }
}
