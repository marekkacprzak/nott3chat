import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  Collapse,
  Chip,
  Button,
} from '@mui/material';
import {
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Clear as ClearIcon,
  BugReport as BugReportIcon,
} from '@mui/icons-material';
import './ConsoleLogger.css';

interface LogEntry {
  id: number;
  type: string;
  timestamp: string;
  args: string[];
}

const ConsoleLogger = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [logCount, setLogCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const originalConsole = useRef<{
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
    debug: typeof console.debug;
    table: typeof console.table;
    trace: typeof console.trace;
    assert: typeof console.assert;
  }>({} as {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
    debug: typeof console.debug;
    table: typeof console.table;
    trace: typeof console.trace;
    assert: typeof console.assert;
  });

  // Storage keys for persistence
  const STORAGE_KEYS = {
    LOGS: 'consoleLogs',
    IS_OPEN: 'consoleLoggerOpen',
    LOG_COUNT: 'consoleLogCount'
  };

  // Load persisted logs and state on component mount
  useEffect(() => {
    try {
      // Load saved logs
      const savedLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (savedLogs) {
        const parsedLogs = JSON.parse(savedLogs);
        if (Array.isArray(parsedLogs)) {
          setLogs(parsedLogs);
          setLogCount(parsedLogs.length);
        }
      }

      // Load saved console state
      const savedIsOpen = localStorage.getItem(STORAGE_KEYS.IS_OPEN);
      if (savedIsOpen === 'true') {
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Failed to restore console logs:', error);
    }
  }, []);

  // Save logs to localStorage whenever logs change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
      localStorage.setItem(STORAGE_KEYS.LOG_COUNT, logCount.toString());
    } catch (error) {
      console.error('Failed to save console logs:', error);
    }
  }, [logs, logCount]);

  // Save console panel state when it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.IS_OPEN, isOpen.toString());
    } catch (error) {
      console.error('Failed to save console state:', error);
    }
  }, [isOpen]);

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || '';
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth <= 768;
      
      return isMobileDevice || (isTouchDevice && isSmallScreen);
    };
    
    setIsMobile(checkMobile());
    
    // Show a welcome message for mobile users
    if (checkMobile()) {
      setTimeout(() => {
        console.log('📱 Console Logger active for mobile debugging');
        console.info('Tap the console button at the bottom to view logs');
      }, 1000);
    }
  }, []);

  // Store original console methods and create interceptors
  useEffect(() => {
    // Store original console methods
    originalConsole.current = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
      table: console.table,
      trace: console.trace,
      assert: console.assert,
    };

    const createLogInterceptor = (type: string, originalMethod: Function) => {
      return (...args: unknown[]) => {
        // Call original method
        originalMethod.apply(console, args);
        
        // Special handling for different console methods
        let processedArgs = args;
        if (type === 'table' && args.length > 0) {
          // Convert table data to readable format
          const tableData = args[0];
          if (Array.isArray(tableData)) {
            processedArgs = [`Table (${tableData.length} items):`, JSON.stringify(tableData, null, 2)];
          } else if (typeof tableData === 'object') {
            processedArgs = ['Table:', JSON.stringify(tableData, null, 2)];
          }
        } else if (type === 'trace') {
          // Add stack trace indicator
          processedArgs = ['Stack trace:', ...args, new Error().stack];
        } else if (type === 'assert') {
          // Only log if assertion failed
          if (!args[0]) {
            processedArgs = ['Assertion failed:', ...args.slice(1)];
          } else {
            return; // Don't log successful assertions
          }
        }
        
        // Create log entry for our display
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
          id: Date.now() + Math.random(),
          type,
          timestamp,
          args: processedArgs.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
              try {
                return JSON.stringify(arg, null, 2);
              } catch {
                return arg?.toString() || 'null';
              }
            }
            return String(arg);
          }),
        };

        setLogs(prevLogs => {
          const newLogs = [...prevLogs, logEntry];
          // Keep only the last 200 logs to prevent memory/storage issues
          const trimmedLogs = newLogs.length > 200 ? newLogs.slice(-200) : newLogs;
          return trimmedLogs;
        });

        setLogCount(prevCount => prevCount + 1);
      };
    };

    // Override console methods
    console.log = createLogInterceptor('log', originalConsole.current.log);
    console.error = createLogInterceptor('error', originalConsole.current.error);
    console.warn = createLogInterceptor('warn', originalConsole.current.warn);
    console.info = createLogInterceptor('info', originalConsole.current.info);
    console.debug = createLogInterceptor('debug', originalConsole.current.debug);
    console.table = createLogInterceptor('table', originalConsole.current.table);
    console.trace = createLogInterceptor('trace', originalConsole.current.trace);
    console.assert = createLogInterceptor('assert', originalConsole.current.assert);

    // Cleanup function to restore original console methods
    return () => {
      console.log = originalConsole.current.log;
      console.error = originalConsole.current.error;
      console.warn = originalConsole.current.warn;
      console.info = originalConsole.current.info;
      console.debug = originalConsole.current.debug;
      console.table = originalConsole.current.table;
      console.trace = originalConsole.current.trace;
      console.assert = originalConsole.current.assert;
    };
  }, []);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (isOpen) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  const clearLogs = () => {
    setLogs([]);
    setLogCount(0);
    // Also clear from localStorage
    try {
      localStorage.removeItem(STORAGE_KEYS.LOGS);
      localStorage.removeItem(STORAGE_KEYS.LOG_COUNT);
    } catch (error) {
      console.error('Failed to clear stored logs:', error);
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'error':
        return '#f44336';
      case 'warn':
        return '#ff9800';
      case 'info':
        return '#2196f3';
      case 'debug':
        return '#9c27b0';
      default:
        return '#4caf50';
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'error':
        return '❌';
      case 'warn':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'debug':
        return '🔍';
      case 'table':
        return '📊';
      case 'trace':
        return '📍';
      case 'assert':
        return '🚫';
      default:
        return '📝';
    }
  };

  return (
    <Box
      className="console-logger"
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(10px)',
        fontFamily: '"Roboto Mono", "Monaco", "Consolas", monospace',
      }}
    >
      {/* Toggle Button */}
      <Box
        className="console-controls console-toggle"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          minHeight: '48px', // Better touch target for mobile
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BugReportIcon sx={{ color: 'white', fontSize: 20 }} />
          <Typography
            variant="caption"
            sx={{ color: 'white', fontWeight: 'bold' }}
          >
            Console Logger {isMobile && '📱'}
          </Typography>
          {logCount > 0 && (
            <Chip
              label={logCount}
              size="small"
              sx={{
                backgroundColor: '#2196f3',
                color: 'white',
                height: 20,
                fontSize: 10,
              }}
            />
          )}
          {/* Show persistence indicator if logs exist */}
          {logs.length > 0 && (
            <Chip
              label="💾"
              size="small"
              title="Logs are persisted across page reloads"
              sx={{
                backgroundColor: '#4caf50',
                color: 'white',
                height: 20,
                fontSize: 10,
                minWidth: 24,
              }}
            />
          )}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {logs.length > 0 && (
            <Button
              size="small"
              onClick={clearLogs}
              startIcon={<ClearIcon />}
              sx={{
                color: 'white',
                fontSize: 10,
                padding: '2px 8px',
                minWidth: 'auto',
              }}
            >
              Clear
            </Button>
          )}
          <IconButton
            onClick={() => setIsOpen(!isOpen)}
            sx={{ color: 'white', padding: '4px' }}
          >
            {isOpen ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* Console Logs */}
      <Collapse in={isOpen}>
        <Paper
          className="console-logs"
          sx={{
            maxHeight: '40vh',
            overflow: 'auto',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            color: 'white',
            padding: '2px',
            borderRadius: 0,
            WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
            scrollbarWidth: 'thin', // Firefox
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'rgba(255, 255, 255, 0.1)',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '3px',
            },
          }}
        >
          {logs.length === 0 ? (
            <Typography
              variant="caption"
              sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
            >
              No console output yet...
            </Typography>
          ) : (
            <>
              {/* Show persistence info */}
              <Box
                sx={{
                  marginBottom: '8px',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(76, 175, 80, 0.1)',
                  borderLeft: '3px solid #4caf50',
                  fontSize: '8px',
                  color: 'rgba(255, 255, 255, 0.8)',
                }}
              >
              </Box>
              
              {logs.map((log) => (
                <Box
                  key={log.id}
                  className="console-log-entry"
                  sx={{
                    marginBottom: '4px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderLeft: `3px solid ${getLogColor(log.type)}`,
                    fontSize: '12px',
                    fontFamily: 'inherit',
                    wordBreak: 'break-word',
                    transition: 'background-color 0.2s ease',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      marginBottom: '2px',
                    }}
                  >
                    <span>{getLogIcon(log.type)}</span>
                    <Typography
                      variant="caption"
                      sx={{
                        color: getLogColor(log.type),
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                      }}
                    >
                      {log.type}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: 'rgba(255, 255, 255, 0.5)' }}
                    >
                      {log.timestamp}
                    </Typography>
                  </Box>
                  <Box>
                    {log.args.map((arg: string, index: number) => (
                      <Typography
                        key={index}
                        component="div"
                        sx={{
                          color: 'white',
                          whiteSpace: 'pre-wrap',
                          fontSize: '11px',
                          lineHeight: 1.3,
                        }}
                      >
                        {arg}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              ))}
            </>
          )}
          <div ref={logsEndRef} />
        </Paper>
      </Collapse>
    </Box>
  );
};

export default ConsoleLogger;
