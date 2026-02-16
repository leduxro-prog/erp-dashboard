/**
 * Multi-Theme System (Nexus-inspired)
 * Premium glassmorphism themes for CYPHER ERP
 */

export enum ThemeVariant {
  VENTURA_DARK = 'VENTURA_DARK',
  SONOMA_LIGHT = 'SONOMA_LIGHT',
  MONTEREY_PRO = 'MONTEREY_PRO',
}

export interface ThemeConfig {
  name: string;
  variant: ThemeVariant;
  bg: string;
  surface: string;
  sidebar: string;
  sidebarHover: string;
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  accent: string;
  accentLight: string;
  border: string;
  shadow: string;
  glassmorphic: {
    bg: string;
    border: string;
  };
  pill: {
    active: string;
    hover: string;
  };
}

const THEMES: Record<ThemeVariant, ThemeConfig> = {
  [ThemeVariant.VENTURA_DARK]: {
    name: 'Ventura Dark',
    variant: ThemeVariant.VENTURA_DARK,
    bg: '#0f1014',
    surface: '#1a1d23',
    sidebar: 'bg-gray-900/60 border border-gray-800',
    sidebarHover: 'hover:bg-white/5 hover:text-white',
    text: {
      primary: 'text-white',
      secondary: 'text-gray-400',
      tertiary: 'text-gray-600',
    },
    accent: '#3b82f6',
    accentLight: '#60a5fa',
    border: 'border-gray-800',
    shadow: 'shadow-blue-900/20',
    glassmorphic: {
      bg: 'bg-gray-900/40 backdrop-blur-md',
      border: 'border-gray-800/50',
    },
    pill: {
      active: 'bg-blue-600 text-white shadow-lg shadow-blue-900/20',
      hover: 'hover:bg-white/5 hover:text-white',
    },
  },
  [ThemeVariant.SONOMA_LIGHT]: {
    name: 'Sonoma Light',
    variant: ThemeVariant.SONOMA_LIGHT,
    bg: '#f5f5f7',
    surface: '#ffffff',
    sidebar: 'bg-white/80 border border-gray-200',
    sidebarHover: 'hover:bg-gray-100 hover:text-gray-900',
    text: {
      primary: 'text-gray-900',
      secondary: 'text-gray-600',
      tertiary: 'text-gray-400',
    },
    accent: '#0066ff',
    accentLight: '#4d94ff',
    border: 'border-gray-200/50',
    shadow: 'shadow-lg/10',
    glassmorphic: {
      bg: 'bg-white/60 backdrop-blur-xl',
      border: 'border-white/50',
    },
    pill: {
      active: 'bg-blue-600 text-white shadow-md',
      hover: 'hover:bg-gray-100',
    },
  },
  [ThemeVariant.MONTEREY_PRO]: {
    name: 'Monterey Pro',
    variant: ThemeVariant.MONTEREY_PRO,
    bg: '#1e1e1e',
    surface: '#252526',
    sidebar: 'bg-[#252526] border border-[#333333]',
    sidebarHover: 'hover:bg-[#2d2d2e] hover:text-white',
    text: {
      primary: 'text-gray-200',
      secondary: 'text-gray-500',
      tertiary: 'text-gray-700',
    },
    accent: '#4d94ff',
    accentLight: '#007acc',
    border: 'border-[#333333]',
    shadow: 'shadow-indigo-900/30',
    glassmorphic: {
      bg: 'bg-[#252526]/80 backdrop-blur-xl',
      border: 'border-[#333333]',
    },
    pill: {
      active: 'bg-blue-600 text-white shadow-lg',
      hover: 'hover:bg-[#2d2d2e]',
    },
  },
};

/**
 * Get complete theme configuration object
 */
export function getThemeConfig(variant: ThemeVariant): ThemeConfig {
  return THEMES[variant] || THEMES[ThemeVariant.VENTURA_DARK];
}

/**
 * Get theme classes as string for Tailwind
 */
export function getThemeClasses(variant: ThemeVariant): string {
  const theme = getThemeConfig(variant);
  const isDark = isDarkTheme(variant);
  
  return `
    bg-[${theme.bg}]
    ${theme.text.primary}
    ${isDark ? 'selection:bg-blue-500/30' : 'selection:bg-blue-200'}
  `.trim();
}

/**
 * Check if theme is dark
 */
export function isDarkTheme(variant: ThemeVariant): boolean {
  return (
    variant === ThemeVariant.VENTURA_DARK ||
    variant === ThemeVariant.MONTEREY_PRO
  );
}

/**
 * Get sidebar classes
 */
export function getSidebarClasses(variant: ThemeVariant): string {
  const theme = getThemeConfig(variant);
  return theme.sidebar;
}

/**
 * Get text color classes
 */
export function getTextClasses(variant: ThemeVariant, level: 'primary' | 'secondary' | 'tertiary' = 'primary'): string {
  const theme = getThemeConfig(variant);
  return theme.text[level];
}

/**
 * Get glassmorphic classes
 */
export function getGlassmorphicClasses(variant: ThemeVariant): { bg: string; border: string } {
  const theme = getThemeConfig(variant);
  return theme.glassmorphic;
}

/**
 * Get pill (active state) classes
 */
export function getPillClasses(variant: ThemeVariant, isActive: boolean): string {
  const theme = getThemeConfig(variant);
  if (isActive) {
    return theme.pill.active;
  }
  return theme.pill.hover;
}

/**
 * Get border classes
 */
export function getBorderClasses(variant: ThemeVariant): string {
  const theme = getThemeConfig(variant);
  return theme.border;
}

/**
 * Get accent color
 */
export function getAccentColor(variant: ThemeVariant): string {
  const theme = getThemeConfig(variant);
  return theme.accent;
}

/**
 * Theme utilities object for easy access
 */
export const themeUtils = {
  getThemeConfig,
  getThemeClasses,
  isDarkTheme,
  getSidebarClasses,
  getTextClasses,
  getGlassmorphicClasses,
  getPillClasses,
  getBorderClasses,
  getAccentColor,
};

export default THEMES;
