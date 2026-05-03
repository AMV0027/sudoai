import ollama from 'ollama';
import { LLMProvider, LLMMessage, LLMResponse } from './types.js';

export class OllamaProvider implements LLMProvider {
  private model: string;

  constructor(model: string = 'llama3') {
    this.model = model;
  }

  async generate(messages: LLMMessage[]): Promise<LLMResponse> {
    const response = await ollama.chat({
      model: this.model,
      messages: messages,
      stream: false,
    });

    return {
      content: response.message.content,
    };
  }

  async generateStream(messages: LLMMessage[], onChunk: (chunk: string) => void): Promise<LLMResponse> {
    const response = await ollama.chat({
      model: this.model,
      messages: messages,
      stream: true,
    });

    let fullContent = '';
    for await (const part of response) {
      const chunk = part.message.content;
      fullContent += chunk;
      onChunk(chunk);
    }

    return {
      content: fullContent,
    };
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await ollama.list();
      return response.models.map(m => m.name);
    } catch (e) {
      console.error('Error listing models:', e);
      return [];
    }
  }
}
