// Navigation service to handle routing programmatically
let navigate: ((route: string) => void) | null = null;

// Set the navigate function from React Router
export const setNavigate = (
  navigateFunction: (route: string) => void
): void => {
  navigate = navigateFunction;
};

// Navigate to a specific route
export const navigateTo = (route: string): void => {
  if (navigate) {
    navigate(route);
  } else {
    console.warn(
      'Navigation function not set. Falling back to window.location'
    );
    window.location.href = route;
  }
};
