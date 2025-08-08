export interface LocalMessage {
  id: string;
  index: number;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isComplete: boolean;
  chatModel?: string | null;
  finishError?: string | null;
}
