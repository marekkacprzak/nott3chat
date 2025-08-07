import { useCallback, useRef, useEffect } from 'react';

interface ViewportMeta {
  element: HTMLMetaElement | null;
  originalContent: string;
  isZoomDisabled: boolean;
}

/**
 * Hook to prevent zoom on mobile devices when input fields are focused.
 * Based on the approach from: https://gist.github.com/OysteinAmundsen/9e6b2ebdf8264ec0e25a0540661949bc
 * 
 * This hook dynamically modifies the viewport meta tag to disable zoom when inputs are focused,
 * and restores the original behavior when they're blurred.
 */
export const usePreventZoom = () => {
  const viewportRef = useRef<ViewportMeta>({
    element: null,
    originalContent: '',
    isZoomDisabled: false
  });
  
  // Initialize on mount
  useEffect(() => {
    const meta = Array.from(document.getElementsByTagName('meta') || [])
      .find(m => m?.getAttribute('name') === 'viewport');
    
    if (meta && !viewportRef.current.element) {
      viewportRef.current.element = meta;
      viewportRef.current.originalContent = meta.getAttribute('content') || '';
    }
  }, []);

  const disableZoom = useCallback(() => {
    const { element, isZoomDisabled } = viewportRef.current;
    if (!element || isZoomDisabled) return;
    
    const currentContent = element.getAttribute('content') || '';
    
    // Remove any existing maximum-scale and user-scalable settings and add strict ones
    let newContent = currentContent
      .replace(/,?\s*maximum-scale=[^,\s]*/g, '')
      .replace(/,?\s*user-scalable=[^,\s]*/g, '')
      .replace(/,?\s*minimum-scale=[^,\s]*/g, '');
    
    // Add strict zoom prevention settings
    newContent += ', minimum-scale=1, maximum-scale=1, user-scalable=no';
    
    element.setAttribute('content', newContent);
    viewportRef.current.isZoomDisabled = true;
    
    // Also prevent document zoom programmatically
    document.documentElement.style.setProperty('touch-action', 'manipulation');
  }, []);

  const enableZoom = useCallback(() => {
    const { element, originalContent, isZoomDisabled } = viewportRef.current;
    if (!element || !isZoomDisabled) return;
    
    // Restore original content
    element.setAttribute('content', originalContent);
    viewportRef.current.isZoomDisabled = false;
    
    // Restore touch action
    document.documentElement.style.removeProperty('touch-action');
  }, []);

  const getInputProps = useCallback(() => ({
    onFocus: (e: any) => {
      disableZoom();
      // Ensure we prevent default zoom behavior
      e.target.style.fontSize = '16px';
    },
    onBlur: () => {
      // Small delay to ensure user isn't just tapping between inputs
      setTimeout(enableZoom, 100);
    },
    onTouchStart: disableZoom,
    style: {
      fontSize: '16px' // Prevent zoom on iOS
    }
  }), [disableZoom, enableZoom]);

  return {
    disableZoom,
    enableZoom,
    getInputProps
  };
};
