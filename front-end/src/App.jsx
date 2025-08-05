import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
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
import ConsoleLogger from './components/ConsoleLogger';
import ConsoleLoggerErrorBoundary from './components/ConsoleLoggerErrorBoundary';

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogger, setShowLogger] = React.useState(false);
  
  // Initialize navigation service with React Router's navigate function
  React.useEffect(() => {
    setNavigate(navigate);
  }, [navigate]);

  // Handle /logging route to toggle console logger
  React.useEffect(() => {
    if (location.pathname === '/logging') {
      setShowLogger(prev => !prev);
      // Navigate back to previous route or chat if no previous route
      const previousPath = sessionStorage.getItem('previousPath') || '/chat';
      navigate(previousPath, { replace: true });
    } else {
      // Store current path as previous path (but not /logging)
      sessionStorage.setItem('previousPath', location.pathname);
    }
  }, [location.pathname, navigate]);

  return (
    <>
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
        {/* Hidden route for logging toggle */}
        <Route path="/logging" element={null} />
      </Routes>
      
      {/* Conditionally render Console Logger */}
      {showLogger && (
        <ConsoleLoggerErrorBoundary>
          <ConsoleLogger />
        </ConsoleLoggerErrorBoundary>
      )}
    </>
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
