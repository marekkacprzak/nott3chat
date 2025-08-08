import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { modelApi, Model } from '../services/modelApi';

interface ModelsContextType {
  models: Model[];
  loading: boolean;
  error: string;
  selectedModel: string | null;
  setSelectedModel: (modelId: string | null) => void;
  refreshModels: () => Promise<void>;
}

interface ModelsProviderProps {
  children: React.ReactNode;
}

const ModelsContext = createContext<ModelsContextType | undefined>(undefined);

/* eslint-disable react-refresh/only-export-components */
export const useModels = (): ModelsContextType => {
  const context = useContext(ModelsContext);
  if (!context) {
    throw new Error('useModels must be used within a ModelsProvider');
  }
  return context;
};

export const ModelsProvider: React.FC<ModelsProviderProps> = ({ children }) => {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  useEffect(() => {
    const loadModels = async () => {
      setLoading(true);
      setError('');
      try {
        const modelData = await modelApi.getModels();
        setModels(modelData);
      } catch (err) {
        setError('Failed to load models');
        console.error('Error loading models:', err);
      } finally {
        setLoading(false);
      }
    };

    loadModels();
  }, []);

  const refreshModels = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const modelData = await modelApi.getModels();
      setModels(modelData);
    } catch (err) {
      setError('Failed to load models');
      console.error('Error loading models:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const value: ModelsContextType = {
    models,
    loading,
    error,
    selectedModel,
    setSelectedModel,
    refreshModels
  };

  return (
    <ModelsContext.Provider value={value}>
      {children}
    </ModelsContext.Provider>
  );
};

