import fs from 'fs';
import path from 'path';

// Concatenated source of the whole app-composition layer: the App.tsx entry
// plus everything under src/app (the state-cluster hooks and the screen
// containers). The #242 decomposition split the wiring these reachability
// tests guard across src/app/*; reading the layer as one string keeps the
// guards intact regardless of which extracted file a given wire now lives in,
// while still failing loudly if a wire is deleted entirely.
export function readAppCompositionSource(): string {
  const root = path.join(__dirname, '..', '..');
  const files: string[] = [path.join(root, 'App.tsx')];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) files.push(full);
    }
  };
  walk(path.join(root, 'src', 'app'));
  return files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
}
