import { createRoot } from 'react-dom/client';
import WorldApp from './world/WorldApp';
const root = document.getElementById('world-root');
if (!root) throw new Error('World mount is missing.');
createRoot(root).render(<WorldApp/>);
