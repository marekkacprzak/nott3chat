import { useState, useEffect, useCallback, useRef } from 'react';

interface KeyboardPositionState {
  isKeyboardOpen: boolean;
  keyboardHeight: number;
  viewportHeight: number;
  isMobile: boolean;
  inputPosition: 'bottom' | 'top';
}

/**
 * Enhanced mobile keyboard hook that handles both detection and positioning.
 * When keyboard opens, moves input area to top. When keyboard closes, returns to bottom.
 */
export const useKeyboardPosition = () => {
  const [state, setState] = useState<KeyboardPositionState>({
    isKeyboardOpen: false,
    keyboardHeight: 0,
    viewportHeight: window.innerHeight,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    inputPosition: 'bottom'
  });

  const timeoutRef = useRef<number | null>(null);
  const initialHeightRef = useRef(window.innerHeight);

  const moveInputToTop = useCallback(() => {
    setState(prev => ({ ...prev, inputPosition: 'top' }));
  }, []);

  const moveInputToBottom = useCallback(() => {
    setState(prev => ({ ...prev, inputPosition: 'bottom' }));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !state.isMobile) return;

    const handleViewportChange = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const heightDifference = initialHeightRef.current - currentHeight;
      const isKeyboardOpen = heightDifference > 150; // Threshold for keyboard detection
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setState(prev => ({
        ...prev,
        isKeyboardOpen,
        keyboardHeight: isKeyboardOpen ? heightDifference : 0,
        viewportHeight: currentHeight,
        inputPosition: isKeyboardOpen ? 'top' : prev.inputPosition
      }));

      // If keyboard is closing, wait a bit before moving input back to bottom
      if (!isKeyboardOpen && state.inputPosition === 'top') {
        timeoutRef.current = setTimeout(() => {
          setState(prev => ({ ...prev, inputPosition: 'bottom' }));
        }, 300); // Wait for keyboard animation to complete
      }
    };

    // Use visual viewport API if available (modern browsers)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportChange);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', handleViewportChange);
      return () => {
        window.removeEventListener('resize', handleViewportChange);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [state.isMobile, state.inputPosition]);

  // Manual control functions
  const handleInputFocus = useCallback(() => {
    if (state.isMobile) {
      // Immediately move to top when input is focused
      moveInputToTop();
    }
  }, [state.isMobile, moveInputToTop]);

  const handleInputBlur = useCallback(() => {
    if (state.isMobile && !state.isKeyboardOpen) {
      // Only move back to bottom if keyboard is not open
      setTimeout(moveInputToBottom, 100);
    }
  }, [state.isMobile, state.isKeyboardOpen, moveInputToBottom]);

  return {
    ...state,
    moveInputToTop,
    moveInputToBottom,
    handleInputFocus,
    handleInputBlur
  };
};
