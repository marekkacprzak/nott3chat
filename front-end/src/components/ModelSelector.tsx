import React, { useEffect, useCallback } from 'react';

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
import { useModels } from '../contexts/ModelsContext';
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

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, onModelChange, disabled }) => {
  const { models, loading, error } = useModels();

  useEffect(() => {
    // Set default model if none selected and models available
    if (!selectedModel && models.length > 0) {
      onModelChange(models[0].name);
    }
  }, [selectedModel, onModelChange, models]);

  const handleChange = useCallback(
    (event: any) => {
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

  if (error) {
    return (
      <Chip label="Error loading models" size="small" color="error" variant="outlined" />
    );
  }

  if (!loading && models.length === 0) {
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
                    [(providerClasses as any)[model.provider || 'custom'] || 'custom']: true,
                  })}
                >
                  {(providerIcons as any)[model.provider || 'custom'] || <Extension />}
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
                    [(providerClasses as any)[model.provider || 'custom'] || 'custom']: true,
                  })}
                >
                  {(providerIcons as any)[model.provider || 'custom'] || <Extension />}
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



export default ModelSelector;
