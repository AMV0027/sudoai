export interface LLMMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  images?: string[];
}

export interface LLMResponse {
  content: string;
  thinking?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface GenerationOptions {
  temperature?: number;
  format?: 'json' | object;
}

export interface LLMProvider {
  generate(messages: LLMMessage[], options?: GenerationOptions): Promise<LLMResponse>;
  generateStream(messages: LLMMessage[], onChunk: (chunk: string) => void, options?: GenerationOptions): Promise<LLMResponse>;
}
