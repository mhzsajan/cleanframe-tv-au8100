import { render } from 'preact';
import { App } from './App';
import './styles.css';

/* A TV has no visible console, so any startup failure is painted on screen
   instead of leaving a black panel. */
function showFatal(message: string): void {
  const host = document.createElement('pre');
  host.style.cssText =
    'position:fixed;top:0;left:0;right:0;padding:24px;background:#1a0d0d;color:#ffb4b4;' +
    'font:18px/1.5 monospace;white-space:pre-wrap;z-index:9999;margin:0';
  host.textContent = `CleanFrame failed to start\n\n${message}`;
  document.body.appendChild(host);
}

window.addEventListener('error', (event) => {
  showFatal(`${event.message}\n${event.filename}:${event.lineno}:${event.colno}`);
});

window.addEventListener('unhandledrejection', (event) => {
  showFatal(String(event.reason));
});

const root = document.getElementById('root');
if (!root) {
  showFatal('Missing #root element.');
} else {
  try {
    render(<App />, root);
  } catch (error) {
    showFatal(error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error));
  }
}
