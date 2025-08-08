import React, { useEffect, useCallback } from 'react';
import { SelectChangeEvent } from '@mui/material/Select';
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
import { Model } from '@/services/modelApi';

type ProviderName = 'OpenAi' | 'Anthropic' | 'AzureOpenAi' | 'Cohere' | 'Custom' | 'Google' | 'Groq' | 'DeepSeek' | 'Mistral' | 'XAi' | 'Perplexity';

const providerIcons: Record<ProviderName, React.ReactElement> = {
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

const providerClasses: Record<ProviderName, string> = {
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
    (event: SelectChangeEvent<string>) => {
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

            const providerName = (model.provider as ProviderName) || 'Custom';
            const className = providerClasses[providerName] || 'custom';
            const icon = providerIcons[providerName] || <Extension />;
            
            return (
              <Box className="render-value">
                <Box
                  className={lcn('provider-icon', {
                    [className]: true,
                  })}
                >
                  {icon}
                </Box>
                <Typography variant="body2" className="model-name">
                  {model.name}
                </Typography>
              </Box>
            );
          }}
        >
          {models.map((model: Model) => {
            const providerName = (model.provider as ProviderName) || 'Custom';
            const className = providerClasses[providerName] || 'custom';
            const icon = providerIcons[providerName] || <Extension />;
            
            return (
              <MenuItem key={model.name} value={model.name}>
                <Box className="menu-item">
                  <Box
                    className={lcn('menu-item-icon provider-icon', {
                      [className]: true,
                    })}
                  >
                    {icon}
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
            );
          })}
        </Select>
      </FormControl>
    </div>
  );
};



export default ModelSelector;
