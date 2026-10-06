import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/manrope';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/fraunces/wght-italic.css';
import App from './App';
import './styles.css';
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() { return this.state.failed ? <main className="error-page"><p className="eyebrow">BETWEEN · A SMALL DETOUR</p><h1>Let’s find our way back.</h1><p>Something interrupted this view. You can reload to try again. Changes this browser could not save may be lost.</p><button onClick={() => window.location.reload()}>Reload the evening</button><p>Reloading does not reset this demo’s saved story or separate plan.</p></main> : this.props.children; }
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
