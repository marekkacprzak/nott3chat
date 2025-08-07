import { useState, useEffect } from 'react';

interface KeyboardState {
  isKeyboardOpen: boolean;
  keyboardHeight: number;
  viewportHeight: number;
  isMobile: boolean;
}

export const useMobileKeyboard = (): KeyboardState => {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isKeyboardOpen: false,
    keyboardHeight: 0,
    viewportHeight: window.innerHeight,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initialHeight = window.innerHeight;
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Use visual viewport API if available (modern browsers)
    if (window.visualViewport) {
      const handleViewportChange = () => {
        const currentHeight = window.visualViewport!.height;
        const heightDifference = initialHeight - currentHeight;
        const isKeyboardOpen = heightDifference > 150; // Threshold for keyboard detection
        
        setKeyboardState({
          isKeyboardOpen,
          keyboardHeight: isKeyboardOpen ? heightDifference : 0,
          viewportHeight: currentHeight,
          isMobile: isMobileDevice
        });
      };

      window.visualViewport.addEventListener('resize', handleViewportChange);
      
      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportChange);
      };
    } else {
      // Fallback for older browsers
      const handleResize = () => {
        const currentHeight = window.innerHeight;
        const heightDifference = initialHeight - currentHeight;
        const isKeyboardOpen = heightDifference > 150;
        
        setKeyboardState({
          isKeyboardOpen,
          keyboardHeight: isKeyboardOpen ? heightDifference : 0,
          viewportHeight: currentHeight,
          isMobile: isMobileDevice
        });
      };

      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  return keyboardState;
};
