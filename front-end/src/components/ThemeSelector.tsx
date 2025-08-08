import React from 'react';
import { SelectChangeEvent } from '@mui/material/Select';
import { FormControl, Select, MenuItem, Chip, Box, Typography, Tooltip } from '@mui/material';
import { Palette as PaletteIcon, LightMode as LightModeIcon, 
  DarkMode as DarkModeIcon } from '@mui/icons-material';
import { useThemeMode } from '../contexts/ThemeContext';

interface ThemeSelectorProps {
  variant?: 'chip' | 'outlined' | 'filled' | 'standard';
  size?: 'small' | 'medium';
  showLabel?: boolean;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ variant = 'standard', size = 'small' }) => {
  const { currentTheme, changeTheme, getAvailableThemes, getCurrentThemeConfig, themeVariants } = useThemeMode();
  const availableThemes = getAvailableThemes();
  const currentConfig = getCurrentThemeConfig();

  const handleThemeChange = (event: SelectChangeEvent<string>) => {
    changeTheme(event.target.value);
  };

  const getThemeIcon = (themeName: string) => {
    const config = themeVariants[themeName];
    return config.mode === 'dark' ? (
      <DarkModeIcon sx={{ fontSize: 16, mr: 1 }} />
    ) : (
      <LightModeIcon sx={{ fontSize: 16, mr: 1 }} />
    );
  };

  const getThemeColor = (themeName: string) => {
    const config = themeVariants[themeName];
    return config.primaryColor;
  };

  if (variant === 'chip') {
    return (
      <Tooltip title="Change theme">
        <FormControl size={size} sx={{ minWidth: 120 }}>
          <Select
            value={currentTheme}
            onChange={handleThemeChange}
            variant="outlined"
            renderValue={() => (
              <Chip
                icon={<PaletteIcon />}
                label={currentTheme.split(' ')[0]}
                size="small"
                sx={{
                  backgroundColor: currentConfig.primaryColor,
                  color: 'white',
                  '& .MuiChip-icon': {
                    color: 'white',
                  },
                }}
              />
            )}
            sx={{
              '& .MuiOutlinedInput-notchedOutline': {
                border: 'none',
              },
              '& .MuiSelect-select': {
                padding: '4px 8px',
              },
            }}
          >
            {availableThemes.map((themeName) => (
              <MenuItem key={themeName} value={themeName}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  {getThemeIcon(themeName)}
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    {themeName}
                  </Typography>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      backgroundColor: getThemeColor(themeName),
                      ml: 1,
                      border: '1px solid rgba(0,0,0,0.1)',
                    }}
                  />
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Tooltip>
    );
  }

  return (
    <FormControl size={size} sx={{ minWidth: 180 }}>
      <Select
        value={currentTheme}
        onChange={handleThemeChange}
        variant={variant}
        displayEmpty
        sx={{
          '& .MuiSelect-select': {
            display: 'flex',
            alignItems: 'center',
          },
        }}
        renderValue={(selected) => (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {getThemeIcon(selected)}
            <Typography variant="body2">{selected.split(' ')[0]}</Typography>
          </Box>
        )}
      >
        {availableThemes.map((themeName) => (
          <MenuItem key={themeName} value={themeName}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              {getThemeIcon(themeName)}
              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                {themeName}
              </Typography>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: getThemeColor(themeName),
                  ml: 1,
                  border: '1px solid rgba(0,0,0,0.1)',
                }}
              />
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default ThemeSelector;
