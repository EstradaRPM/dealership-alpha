import React, { createContext, useContext } from 'react';
import { defaultTheme, type Theme } from './theme';

/**
 * Single injectable theme. The token set is provided once at the root and read
 * via `useTheme()` — not imported piecemeal into each component. Swapping the
 * `theme` prop at the root re-skins every kit surface with zero component edits.
 *
 * The context default is `defaultTheme`, so a kit component rendered outside a
 * provider (e.g. an isolated smoke test) still resolves real tokens rather than
 * crashing — the provider is an override, not a hard requirement.
 */
const ThemeContext = createContext<Theme>(defaultTheme);

export function ThemeProvider({
  theme = defaultTheme,
  children,
}: {
  theme?: Theme;
  children: React.ReactNode;
}) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Read the active theme. The single seam every kit component pulls tokens from. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}
