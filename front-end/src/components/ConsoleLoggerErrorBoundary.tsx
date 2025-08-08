import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

class ConsoleLoggerErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {  
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ConsoleLogger Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null; // Don't render anything if there's an error
    }

    return this.props.children;
  }
}

export default ConsoleLoggerErrorBoundary;
