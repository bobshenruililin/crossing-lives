import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/manrope';
import { DecisionExperience } from './components/DecisionExperience';

class DecisionBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="decision-error"><p>Crossing Lives · authored example</p><h1>This evening couldn’t open.</h1><p>You can reload to start a fresh example. Nothing here is saved.</p><button type="button" onClick={() => window.location.reload()}>Reload this example</button></main>;
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><DecisionBoundary><DecisionExperience /></DecisionBoundary></React.StrictMode>);
