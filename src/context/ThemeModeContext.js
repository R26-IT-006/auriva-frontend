import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Light / dark mode for the principal app, chosen on the Theme Settings screen
 * and kept on the device so it survives a restart.
 *
 * Screens read colours from `palette` rather than literals. A screen's styles
 * are built once per mode by `useThemedStyles(makeStyles)`, where makeStyles is
 * a module-level `(palette) => ({ ...styles })` — so switching mode swaps a
 * cached stylesheet instead of rebuilding styles on every render.
 */

const STORAGE_KEY = 'auriva.principal.themeMode';

export const PALETTES = {
  light: {
    mode: 'light',
    background: '#F2F5F8',
    surface:    '#FFFFFF',
    surfaceAlt: '#F2F5F8',
    text:       '#1A2E3B',
    muted:      '#8A93A8',
    border:     '#E8EEF4',
    track:      '#E8EEF2',
    shadow:     '#1A2E3B',
  },
  dark: {
    mode: 'dark',
    background: '#0B1620',
    surface:    '#15242F',
    surfaceAlt: '#1C2F3D',
    text:       '#E8EEF3',
    muted:      '#8FA1B2',
    border:     '#243745',
    track:      '#243745',
    shadow:     '#000000',
  },
};

const ThemeModeContext = createContext({
  mode: 'light',
  palette: PALETTES.light,
  setMode: () => {},
});

export function ThemeModeProvider({ children }) {
  const [mode, setModeState] = useState('light');

  // Restore the saved choice. Storage can be unavailable; light is the default.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => { if (alive && (saved === 'light' || saved === 'dark')) setModeState(saved); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const value = useMemo(() => ({
    mode,
    palette: PALETTES[mode],
    setMode: (next) => {
      if (next !== 'light' && next !== 'dark') return;
      setModeState(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    },
  }), [mode]);

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}

// One stylesheet per (makeStyles, mode), built on first use.
const cache = new WeakMap();

export function useThemedStyles(makeStyles) {
  const { mode, palette } = useThemeMode();
  let byMode = cache.get(makeStyles);
  if (!byMode) { byMode = {}; cache.set(makeStyles, byMode); }
  if (!byMode[mode]) byMode[mode] = StyleSheet.create(makeStyles(palette));
  return byMode[mode];
}
