export interface LLMMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LLMProvider {
  generate(messages: LLMMessage[]): Promise<LLMResponse>;
  generateStream(messages: LLMMessage[], onChunk: (chunk: string) => void): Promise<LLMResponse>;
}
