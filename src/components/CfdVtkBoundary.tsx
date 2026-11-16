import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null; retryKey: number }

export class CfdVtkBoundary extends Component<Props, State> {
  state: State = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('CfdVtkBoundary caught:', error);
  }

  handleRetry = () => {
    this.setState((s) => ({ error: null, retryKey: s.retryKey + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <section className="cfd-vtk cfd-vtk-fallback">
          <div className="cfd-vtk-fallback-body">
            <div className="cfd-vtk-fallback-title">3D scientific viewer unavailable</div>
            <div className="cfd-vtk-fallback-msg">{this.state.error.message}</div>
            <p className="cfd-vtk-fallback-hint">
              Usually a WebGL context limit. Close other 3D tabs, then retry.
            </p>
            <button
              type="button"
              className="cfd-vtk-fallback-btn"
              onClick={this.handleRetry}
            >
              Retry viewer
            </button>
          </div>
        </section>
      );
    }
    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}
