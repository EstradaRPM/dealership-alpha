import React, { useEffect } from 'react';
import { useFonts } from 'expo-font';
import { iconFont } from './src/ui/kit';
import { DealershipApp } from './src/app/AppRoot';

// DealershipApp + its props are re-exported so the App.* integration tests keep
// importing them from '../App' (#242 decomposition moved the implementation
// into src/app/, but the public entry stays here).
export { DealershipApp } from './src/app/AppRoot';
export type { DealershipAppProps } from './src/app/AppRoot';

export default function App() {
  // Preload the kit's icon font up front instead of leaning on each Icon's
  // lazy per-mount load: one load, no glyph pop-in, and a *visible* warning
  // when the font fails. The kit owns which ttf this is and registers it
  // under a project-unique family name (see src/ui/kit/icons.ts).
  const [, iconFontError] = useFonts(iconFont);
  useEffect(() => {
    if (iconFontError) {
      console.warn('Kit icon font failed to load:', iconFontError);
    }
  }, [iconFontError]);
  return <DealershipApp />;
}
