import React, { createContext, useContext, useState, useEffect } from 'react';
import { createTheme, Theme } from '@mui/material/styles';
import type { ThemeConfig } from '../Model/ThemeConfig';

interface ThemeContextType {
  theme: Theme;
  currentTheme: string;
  changeTheme: (themeVariant: string) => void;
  getAvailableThemes: () => string[];
  getCurrentThemeConfig: () => ThemeConfig;
  themeVariants: Record<string, ThemeConfig>;
}

interface ThemeModeProviderProps {
  children: React.ReactNode;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/* eslint-disable react-refresh/only-export-components */
export const useThemeMode = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return context;
};

// Define multiple theme variants
const themeVariants: Record<string, ThemeConfig> = {
  'Default Light': {
    mode: 'light' as const,
    primaryColor: '#2563eb',
    secondaryColor: '#7c3aed',
    backgroundColor: '#f8fafc',
    paperColor: '#ffffff',
  },
  'Default Dark': {
    mode: 'dark' as const,
    primaryColor: '#3b82f6',
    secondaryColor: '#8b5cf6',
    backgroundColor: '#0f172a',
    paperColor: '#1e293b',
  },
  'Ocean Light': {
    mode: 'light' as const,
    primaryColor: '#0ea5e9',
    secondaryColor: '#06b6d4',
    backgroundColor: '#f0f9ff',
    paperColor: '#ffffff',
  },
  'Ocean Dark': {
    mode: 'dark' as const,
    primaryColor: '#0ea5e9',
    secondaryColor: '#06b6d4',
    backgroundColor: '#0c4a6e',
    paperColor: '#0f172a',
  },
  'Forest Light': {
    mode: 'light' as const,
    primaryColor: '#059669',
    secondaryColor: '#10b981',
    backgroundColor: '#f0fdf4',
    paperColor: '#ffffff',
  },
  'Forest Dark': {
    mode: 'dark' as const,
    primaryColor: '#10b981',
    secondaryColor: '#34d399',
    backgroundColor: '#064e3b',
    paperColor: '#1f2937',
  },
  'Sunset Light': {
    mode: 'light' as const,
    primaryColor: '#ea580c',
    secondaryColor: '#f97316',
    backgroundColor: '#fff7ed',
    paperColor: '#ffffff',
  },
  'Sunset Dark': {
    mode: 'dark' as const,
    primaryColor: '#f97316',
    secondaryColor: '#fb923c',
    backgroundColor: '#7c2d12',
    paperColor: '#1f2937',
  },
  'Purple Light': {
    mode: 'light' as const,
    primaryColor: '#7c3aed',
    secondaryColor: '#8b5cf6',
    backgroundColor: '#faf5ff',
    paperColor: '#ffffff',
  },
  'Purple Dark': {
    mode: 'dark' as const,
    primaryColor: '#8b5cf6',
    secondaryColor: '#a78bfa',
    backgroundColor: '#581c87',
    paperColor: '#1f2937',
  },
  'Monochrome Light': {
    mode: 'light' as const,
    primaryColor: '#374151',
    secondaryColor: '#6b7280',
    backgroundColor: '#f9fafb',
    paperColor: '#ffffff',
  },
  'Monochrome Dark': {
    mode: 'dark' as const,
    primaryColor: '#9ca3af',
    secondaryColor: '#d1d5db',
    backgroundColor: '#111827',
    paperColor: '#1f2937',
  },
};

const createCustomTheme = (variant: string): Theme => {
  const config = themeVariants[variant];

  return createTheme({
    palette: {
      mode: config.mode,
      primary: {
        main: config.primaryColor,
        contrastText: config.mode === 'dark' ? '#ffffff' : '#ffffff',
      },
      secondary: {
        main: config.secondaryColor,
      },
      background: {
        default: config.backgroundColor,
        paper: config.paperColor,
      },
      grey:
        config.mode === 'dark'
          ? {
              50: '#fafafa',
              100: '#f5f5f5',
              200: '#eeeeee',
              300: '#e0e0e0',
              400: '#bdbdbd',
              500: '#9e9e9e',
              600: '#757575',
              700: '#616161',
              800: '#424242',
              900: '#212121',
            }
          : {
              50: '#f8fafc',
              100: '#f1f5f9',
              200: '#e2e8f0',
              300: '#cbd5e1',
              400: '#94a3b8',
              500: '#64748b',
              600: '#475569',
              700: '#334155',
              800: '#1e293b',
              900: '#0f172a',
            },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontWeight: 700,
      },
      h2: {
        fontWeight: 600,
      },
      h3: {
        fontWeight: 600,
      },
      h4: {
        fontWeight: 600,
      },
      h5: {
        fontWeight: 600,
      },
      h6: {
        fontWeight: 600,
      },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 8,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 12,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            borderRadius: 0,
          },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          body:
            config.mode === 'dark'
              ? {
                  scrollbarColor: '#6b7280 #374151',
                  '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
                    backgroundColor: config.paperColor,
                    width: 8,
                  },
                  '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
                    borderRadius: 8,
                    backgroundColor: '#6b7280',
                    minHeight: 24,
                    border: '1px solid transparent',
                  },
                  '&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus':
                    {
                      backgroundColor: '#9ca3af',
                    },
                  '&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active':
                    {
                      backgroundColor: '#9ca3af',
                    },
                  '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover':
                    {
                      backgroundColor: '#9ca3af',
                    },
                  '&::-webkit-scrollbar-corner, & *::-webkit-scrollbar-corner':
                    {
                      backgroundColor: config.paperColor,
                    },
                }
              : {
                  scrollbarColor: '#cbd5e1 #e2e8f0',
                  '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
                    backgroundColor: '#f1f5f9',
                    width: 8,
                  },
                  '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
                    borderRadius: 8,
                    backgroundColor: '#cbd5e1',
                    minHeight: 24,
                    border: '1px solid transparent',
                  },
                  '&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus':
                    {
                      backgroundColor: '#94a3b8',
                    },
                  '&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active':
                    {
                      backgroundColor: '#94a3b8',
                    },
                  '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover':
                    {
                      backgroundColor: '#94a3b8',
                    },
                  '&::-webkit-scrollbar-corner, & *::-webkit-scrollbar-corner':
                    {
                      backgroundColor: '#f1f5f9',
                    },
                },
        },
      },
    },
  });
};

export const ThemeModeProvider: React.FC<ThemeModeProviderProps> = ({
  children,
}) => {
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    // Get theme from localStorage or default to 'Default Light'
    const savedTheme = localStorage.getItem('themeVariant');
    return savedTheme && savedTheme in themeVariants
      ? savedTheme
      : 'Default Light';
  });

  const [theme, setTheme] = useState<Theme>(() =>
    createCustomTheme(currentTheme)
  );

  useEffect(() => {
    // Save theme preference to localStorage
    localStorage.setItem('themeVariant', currentTheme);
    setTheme(createCustomTheme(currentTheme));
  }, [currentTheme]);

  const changeTheme = (themeVariant: string): void => {
    if (themeVariant in themeVariants) {
      setCurrentTheme(themeVariant);
    }
  };

  const getAvailableThemes = (): string[] => {
    return Object.keys(themeVariants);
  };

  const getCurrentThemeConfig = (): ThemeConfig => {
    return themeVariants[currentTheme];
  };

  const value = {
    theme,
    currentTheme,
    changeTheme,
    getAvailableThemes,
    getCurrentThemeConfig,
    themeVariants,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
