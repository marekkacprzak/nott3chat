import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Box, Button, Container, Paper, TextField, Typography, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import ThemeSelector from './ThemeSelector';
import './RegisterPage.css';

const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/chat');
    }
  }, [isAuthenticated, navigate]);

  // Check if passwords match whenever either password field changes
  const passwordsMatch = useMemo(() => !confirmPassword || password === confirmPassword, [password, confirmPassword]);
  
  // Email validation
  const isValidEmail = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return !email || emailRegex.test(email);
  }, [email]);

  // Password validation (must match backend requirements)
  const isValidPassword = useMemo(() => {
    return !password || password.length >= 5;
  }, [password]);
  
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      
      // Client-side validation
      if (!username || !email || !password || !confirmPassword) {
        setError('All fields are required');
        return;
      }
      
      if (!isValidEmail) {
        setError('Please enter a valid email address');
        return;
      }

      if (!isValidPassword) {
        setError('Password must be at least 5 characters long');
        return;
      }
      
      if (!passwordsMatch) {
        setError('Passwords do not match');
        return;
      }

      setError('');
      setLoading(true);

      const result = await register(username, email, password);

      if (result.success) {
        navigate('/chat');
      } else {
        setError(result.error || 'Registration failed');
      }

      setLoading(false);
    },
    [username, email, password, confirmPassword, passwordsMatch, isValidEmail, isValidPassword, register, navigate]
  );

  return (
    <div className="register-page">
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
          <Paper elevation={3} className="register-paper">
            <Typography component="h1" variant="h4" align="center" gutterBottom>
              Register
            </Typography>

            {error && (
              <Alert severity="error" className="error-alert">
                {error}
              </Alert>
            )}

            <Box
              component="form"
              onSubmit={handleSubmit}
              className="register-form"
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
                id="email"
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!isValidEmail}
                helperText={!isValidEmail ? "Please enter a valid email address" : ''}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={password.length > 0 && !isValidPassword}
                helperText={
                  password.length > 0 && !isValidPassword 
                    ? "Password must be at least 5 characters long" 
                    : password.length === 0 
                    ? "Minimum 5 characters required"
                    : ''
                }
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="confirmPassword"
                label="Confirm Password"
                type="password"
                id="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={!passwordsMatch}
                helperText={!passwordsMatch ? "Passwords don't match" : ''}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                className="submit-button"
                disabled={loading || !passwordsMatch || !isValidEmail || !isValidPassword || !username || !email || !password || !confirmPassword}
              >
                {loading ? 'Registering...' : 'Register'}
              </Button>
              
              <Box className="account-link-container">
                <Typography variant="body2">
                  Already have an account?{' '}
                  <Button
                    component={Link}
                    to="/login"
                    color="primary"
                    size="small"
                    className="account-link"
                  >
                    Login here
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

export default RegisterPage;
