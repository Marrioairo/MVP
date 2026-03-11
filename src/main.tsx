import {StrictMode, Component, ErrorInfo, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  state = { hasError: false, error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error("Unhandled error:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', background: '#ffebee', color: '#c62828', fontFamily: 'monospace', height: '100vh', overflow: 'auto' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Application Crashed (React Render Error)</h1>
          <b style={{ fontSize: '1.2rem' }}>{this.state.error?.toString()}</b>
          <pre style={{ marginTop: '1rem', whiteSpace: 'pre-wrap', background: 'white', padding: '1rem', border: '1px solid #ef9a9a' }}>
            {this.state.error?.stack}
          </pre>
          <p style={{ marginTop: '2rem', fontSize: '1.2rem', fontWeight: 'bold', color: 'black' }}>
            👉 Please take a screenshot of this entire red screen and send it to the AI assistant so it can fix the code.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed: ', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
