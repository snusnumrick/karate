export type ResolvedTheme = 'light' | 'dark';

/**
 * Determines the current theme by inspecting the root `data-theme` attribute,
 * then falls back to legacy class-based toggles and finally to the system
 * preference.
 */
export function resolveDocumentTheme(): ResolvedTheme {
  if (typeof document === 'undefined') {
    return 'light';
  }

  const root = document.documentElement;
  const attributeTheme = root.getAttribute('data-theme');
  if (attributeTheme === 'dark' || attributeTheme === 'light') {
    return attributeTheme;
  }

  if (root.classList.contains('dark')) {
    return 'dark';
  }

  if (root.classList.contains('light')) {
    return 'light';
  }

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return 'light';
}

export function isDarkThemeEnabled(): boolean {
  return resolveDocumentTheme() === 'dark';
}
