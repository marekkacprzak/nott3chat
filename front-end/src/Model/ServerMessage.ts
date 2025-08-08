export interface ServerMessage {
  id: string;
  index: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  chatModel?: string;
  finishError?: string;
}
