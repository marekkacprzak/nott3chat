// Global type declarations for missing modules

declare module 'react-syntax-highlighter' {
  import * as React from 'react';
  export interface SyntaxHighlighterProps {
    language?: string;
    style?: Record<string, React.CSSProperties>;
    customStyle?: React.CSSProperties;
    showLineNumbers?: boolean;
    children?: string;
  }
  export const Prism: React.ComponentType<SyntaxHighlighterProps>;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  import * as React from 'react';
  export const vscDarkPlus: Record<string, React.CSSProperties>;
  export const vs: Record<string, React.CSSProperties>;
}
