import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { error: Error | null; retryKey: number; hasRendered: boolean }

export class CanvasBoundary extends Component<Props, State> {
  state: State = { error: null, retryKey: 0, hasRendered: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error) {
    // If the canvas already rendered at least once, a WebGL error is transient
    // (usually a resize, tab-switch, or secondary context). Log and ignore so
    // the running scene survives instead of being unmounted.
    if (this.state.hasRendered) {
      console.warn('CanvasBoundary: post-render error (ignored)', error.message);
      return;
    }
    console.error('CanvasBoundary caught (pre-render):', error);
  }

  componentDidMount() {
    // Give the Canvas a moment to produce its first frame; if no error fires
    // within 1500ms we mark it as rendered.
    setTimeout(() => {
      if (!this.state.error) this.setState({ hasRendered: true });
    }, 1500);
  }

  handleRetry = () => {
    this.setState((s) => ({ error: null, retryKey: s.retryKey + 1, hasRendered: false }));
    setTimeout(() => {
      if (!this.state.error) this.setState({ hasRendered: true });
    }, 1500);
  };

  handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    // If an error fires after render succeeded, keep the children mounted.
    if (this.state.error && !this.state.hasRendered) {
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
                <li>Check hardware acceleration (chrome://gpu)</li>
                <li>On Linux, verify GPU drivers</li>
              </ul>
            )}
            <div className="canvas-fallback-actions">
              <button type="button" className="canvas-fallback-btn" onClick={this.handleRetry}>
                Retry
              </button>
              <button type="button" className="canvas-fallback-btn canvas-fallback-btn-ghost" onClick={this.handleReload}>
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div key={this.state.retryKey} style={{ width: '100%', height: '100%' }}>
        {this.props.children}
      </div>
    );
  }
}
