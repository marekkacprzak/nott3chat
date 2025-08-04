import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import { ModelsProvider } from './contexts/ModelsContext';
import { SignalRProvider } from './contexts/SignalRContext';
import { ThemeModeProvider, useThemeMode } from './contexts/ThemeContext';
import LoginPage from './components/LoginPage';
import ChatRoom from './components/ChatRoom';
import ProtectedRoute from './components/ProtectedRoute';
import RegisterPage from './components/RegisterPage';
import { setNavigate } from './services/navigationService';

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  // Initialize navigation service with React Router's navigate function
  React.useEffect(() => {
    setNavigate(navigate);
  }, [navigate]);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/chat" replace /> : <LoginPage />
        }
      />
      <Route
        path="/register"
        element={
          isAuthenticated ? <Navigate to="/chat" replace /> : <RegisterPage />
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ModelsProvider>
              <ChatProvider>
                <SignalRProvider>
                  <ChatRoom />
                </SignalRProvider>
              </ChatProvider>
            </ModelsProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat/:chatId"
        element={
          <ProtectedRoute>
            <ModelsProvider>
              <ChatProvider>
                <SignalRProvider>
                  <ChatRoom />
                </SignalRProvider>
              </ChatProvider>
            </ModelsProvider>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
};

const ThemedApp = () => {
  const { theme } = useThemeMode();
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

const App = () => {
  return (
    <ThemeModeProvider>
      <ThemedApp />
    </ThemeModeProvider>
  );
};

export default App;
