// Global type declarations for missing modules

declare module 'react-syntax-highlighter' {
  import React from 'react';
  export interface SyntaxHighlighterProps {
    language?: string;
    style?: any;
    customStyle?: React.CSSProperties;
    showLineNumbers?: boolean;
    children?: string;
  }
  export const Prism: React.ComponentType<SyntaxHighlighterProps>;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  export const vscDarkPlus: any;
  export const vs: any;
}
