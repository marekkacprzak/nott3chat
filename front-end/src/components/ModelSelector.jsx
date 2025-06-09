import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import lcn from 'light-classnames';
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
import './ModelSelector.css';

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

const providerClasses = {
  OpenAi: 'openai',
  Anthropic: 'anthropic',
  AzureOpenAi: 'azure',
  Cohere: 'cohere',
  Custom: 'custom',
  Google: 'google',
  Groq: 'groq',
  DeepSeek: 'deepseek',
  Mistral: 'mistral',
  XAi: 'xai',
  Perplexity: 'perplexity',
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
      <div className="model-selector">
        <Box className="loading-container">
          <CircularProgress size={20} />
        </Box>
      </div>
    );
  }

  if (error || models.length === 0) {
    return (
      <Chip label="No models" size="small" color="error" variant="outlined" />
    );
  }

  return (
    <div className="model-selector">
      <FormControl size="small" className="form-control">
        <Select
          value={selectedModel || ''}
          onChange={handleChange}
          disabled={disabled}
          displayEmpty
          className="select-root"
          renderValue={(selected) => {
            const model = models.find((m) => m.name === selected);
            if (!model)
              return <Typography variant="body2">Select model</Typography>;

            return (
              <Box className="render-value">
                <Box
                  className={lcn('provider-icon', {
                    [providerClasses[model.provider] || 'custom']: true,
                  })}
                >
                  {providerIcons[model.provider] || <Extension />}
                </Box>
                <Typography variant="body2" className="model-name">
                  {model.name}
                </Typography>
              </Box>
            );
          }}
        >
          {models.map((model) => (
            <MenuItem key={model.name} value={model.name}>
              <Box className="menu-item">
                <Box
                  className={lcn('menu-item-icon provider-icon', {
                    [providerClasses[model.provider] || 'custom']: true,
                  })}
                >
                  {providerIcons[model.provider] || <Extension />}
                </Box>
                <Box className="menu-item-content">
                  <Typography variant="body2" className="menu-item-title">
                    {model.name}
                  </Typography>
                  <Typography variant="caption" className="menu-item-provider">
                    {model.provider}
                  </Typography>
                </Box>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
};

ModelSelector.propTypes = {
  selectedModel: PropTypes.string,
  onModelChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default ModelSelector;
