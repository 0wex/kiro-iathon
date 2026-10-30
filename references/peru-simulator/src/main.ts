import { TerrainApp } from './app';
import './ui/styles.css';

const container = document.querySelector<HTMLDivElement>('#app');
if (!container) throw new Error('Missing #app container');

try {
  new TerrainApp(container);
} catch (error) {
  console.error(error);
  const message = document.createElement('p');
  message.className = 'error';
  message.textContent = 'This app needs WebGL 2. Please try a recent desktop browser.';
  container.append(message);
}
