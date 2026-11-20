import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught:', error, errorInfo);
    // A chunk from the previous deploy is gone: reload once onto the new build (same guard as main.jsx).
    if (/dynamically imported module|Importing a module script failed/i.test(String(error?.message))) {
      let last = 0;
      try { last = Number(sessionStorage.getItem('epiphany_chunk_reload')) || 0; } catch { /* private mode */ }
      if (Date.now() - last > 30000) {
        try { sessionStorage.setItem('epiphany_chunk_reload', String(Date.now())); } catch { /* private mode */ }
        window.location.reload();
        return;
      }
    }
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 40,
          fontFamily: 'monospace',
          background: '#1a1a1a',
          color: '#fff',
          minHeight: '100vh'
        }}>
          <h1 style={{ color: '#ff6b6b', marginBottom: 20 }}>Something went wrong</h1>
          <details open style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>
            <summary style={{ cursor: 'pointer', marginBottom: 10, color: '#ffa500' }}>
              Error details
            </summary>
            <div style={{
              background: '#2a2a2a',
              padding: 20,
              borderRadius: 8,
              overflow: 'auto'
            }}>
              <p><strong>Error:</strong></p>
              <code>{this.state.error && this.state.error.toString()}</code>
              <p style={{ marginTop: 20 }}><strong>Stack:</strong></p>
              <code>{this.state.errorInfo && this.state.errorInfo.componentStack}</code>
            </div>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              padding: '10px 20px',
              background: '#4ade80',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
