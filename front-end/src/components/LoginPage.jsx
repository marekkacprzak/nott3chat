import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Paper,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import ThemeSelector from './ThemeSelector';
import './LoginPage.css';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      const result = await login(username, password);

      if (result.success) {
        navigate('/chat');
      } else {
        setError(result.error);
      }

      setLoading(false);
    },
    [username, password, login, navigate]
  );

  return (
    <div className="login-page">
      {/* Theme Selector positioned in top-right corner */}
      <Box
        sx={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 1000,
        }}
      >
        <ThemeSelector variant="outlined" size="small" />
      </Box>
      
      <Container component="main" maxWidth="xs">
        <Box className="main-container">
          <Paper elevation={3} className="login-paper">
            <Typography component="h1" variant="h4" align="center" gutterBottom>
              Login
            </Typography>

            {error && (
              <Alert severity="error" className="error-alert">
                {error}
              </Alert>
            )}

            <Box
              component="form"
              onSubmit={handleSubmit}
              className="login-form"
            >
              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="Username"
                name="username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                className="submit-button"
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
              
              <Box className="account-link-container">
                <Typography variant="body2">
                  Don&apos;t have an account?{' '}
                  <Button
                    component={Link}
                    to="/register"
                    color="primary"
                    size="small"
                    className="account-link"
                  >
                    Register here
                  </Button>
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Container>
    </div>
  );
};

export default LoginPage;
