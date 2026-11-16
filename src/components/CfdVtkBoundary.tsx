import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class CfdVtkBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('CfdVtkBoundary caught:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="cfd-vtk cfd-vtk-fallback">
          <div className="cfd-vtk-fallback-body">
            <div className="cfd-vtk-fallback-title">3D scientific viewer unavailable</div>
            <div className="cfd-vtk-fallback-msg">{this.state.error.message}</div>
            <p className="cfd-vtk-fallback-hint">
              The rest of the site is fine. This is usually a WebGL context limit
              or GPU driver issue. Try closing other 3D tabs.
            </p>
            <button
              type="button"
              className="cfd-vtk-fallback-btn"
              onClick={() => this.setState({ error: null })}
            >
              Retry viewer
            </button>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}
