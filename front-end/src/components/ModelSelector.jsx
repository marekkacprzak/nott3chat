import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  FormControl,
  Select,
  MenuItem,
  Box,
  Typography,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  SmartToy,
  Psychology,
  Cloud,
  Code,
  Extension,
  Search,
  Speed,
  Waves,
  AutoAwesome,
  FlashOn,
  TravelExplore,
} from '@mui/icons-material';
import { modelApi } from '../services/modelApi';

const providerIcons = {
  OpenAi: <SmartToy />,
  Anthropic: <Psychology />,
  AzureOpenAi: <Cloud />,
  Cohere: <Code />,
  Custom: <Extension />,
  Google: <Search />,
  Groq: <Speed />,
  DeepSeek: <Waves />,
  Mistral: <AutoAwesome />,
  XAi: <FlashOn />,
  Perplexity: <TravelExplore />,
};

const providerColors = {
  OpenAi: '#10a37f',
  Anthropic: '#d4a574',
  AzureOpenAi: '#0078d4',
  Cohere: '#39594c',
  Custom: '#666666',
  Google: '#4285f4',
  Groq: '#f55036',
  DeepSeek: '#1e3a8a',
  Mistral: '#ff7000',
  XAi: '#000000',
  Perplexity: '#20b2aa',
};

const ModelSelector = ({ selectedModel, onModelChange, disabled }) => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadModels = async () => {
      setLoading(true);
      setError('');
      try {
        const modelData = await modelApi.getModels();
        setModels(modelData);
        // Set default model if none selected and models available
        if (!selectedModel && modelData.length > 0) {
          onModelChange(modelData[0].name);
        }
      } catch (err) {
        setError('Failed to load models');
        console.error('Error loading models:', err);
      } finally {
        setLoading(false);
      }
    };

    loadModels();
  }, [selectedModel, onModelChange]);

  const handleChange = useCallback(
    (event) => {
      onModelChange(event.target.value);
    },
    [onModelChange]
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 120 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (error || models.length === 0) {
    return (
      <Chip label="No models" size="small" color="error" variant="outlined" />
    );
  }

  return (
    <FormControl size="small" sx={{ width: 220 }}>
      <Select
        value={selectedModel || ''}
        onChange={handleChange}
        disabled={disabled}
        displayEmpty
        renderValue={(selected) => {
          const model = models.find((m) => m.name === selected);
          if (!model)
            return <Typography variant="body2">Select model</Typography>;

          return (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                width: '100%',
              }}
            >
              <Box
                sx={{
                  color: providerColors[model.provider] || '#666',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '16px',
                  flexShrink: 0,
                }}
              >
                {providerIcons[model.provider] || <Extension />}
              </Box>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {model.name}
              </Typography>
            </Box>
          );
        }}
        sx={{
          width: '100%',
          '& .MuiSelect-select': {
            py: 1,
            px: 1.5,
            height: '20px',
            display: 'flex',
            alignItems: 'center',
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'divider',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'primary.main',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'primary.main',
            borderWidth: 1,
          },
        }}
      >
        {models.map((model) => (
          <MenuItem key={model.name} value={model.name}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                width: '100%',
              }}
            >
              <Box
                sx={{
                  color: providerColors[model.provider] || '#666',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '18px',
                }}
              >
                {providerIcons[model.provider] || <Extension />}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {model.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {model.provider}
                </Typography>
              </Box>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

ModelSelector.propTypes = {
  selectedModel: PropTypes.string,
  onModelChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default ModelSelector;
