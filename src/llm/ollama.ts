import ollama from 'ollama';
import { LLMProvider, LLMMessage, LLMResponse } from './types.js';

export interface OllamaProviderOptions {
  model?: string;
  thinking?: boolean;
}

export class OllamaProvider implements LLMProvider {
  private model: string;
  private thinking: boolean;

  constructor(modelOrOptions: string | OllamaProviderOptions = 'llama3') {
    if (typeof modelOrOptions === 'string') {
      this.model = modelOrOptions;
      this.thinking = false;
    } else {
      this.model = modelOrOptions.model ?? 'llama3';
      this.thinking = modelOrOptions.thinking ?? false;
    }
  }

  async generate(messages: LLMMessage[], options?: import('./types.js').GenerationOptions): Promise<LLMResponse> {
    const mappedMessages = messages.map(m => {
      const mapped: any = { role: m.role, content: m.content };
      if (m.images && m.images.length > 0) {
        mapped.images = m.images;
      }
      return mapped;
    });

    const response = await (ollama.chat as any)({
      model: this.model,
      messages: mappedMessages,
      stream: false,
      think: this.thinking,
      options: options?.temperature !== undefined ? { temperature: options.temperature } : undefined,
      format: options?.format,
    });

    const msg = response.message as any;
    return {
      content: msg.content ?? '',
      thinking: msg.thinking ?? undefined,
    };
  }

  async generateStream(messages: LLMMessage[], onChunk: (chunk: string) => void, options?: import('./types.js').GenerationOptions): Promise<LLMResponse> {
    const mappedMessages = messages.map(m => {
      const mapped: any = { role: m.role, content: m.content };
      if (m.images && m.images.length > 0) {
        mapped.images = m.images;
      }
      return mapped;
    });

    const response = await ollama.chat({
      model: this.model,
      messages: mappedMessages,
      stream: true,
      think: this.thinking,
      options: options?.temperature !== undefined ? { temperature: options.temperature } : undefined,
      format: options?.format,
    } as any);

    let fullContent = '';
    let thinkingContent = '';
    for await (const part of (response as any)) {
      const p = part as any;
      const thinkChunk = p.message?.thinking;
      if (thinkChunk) {
        thinkingContent += thinkChunk;
      } else {
        const text: string = p.message?.content ?? '';
        fullContent += text;
        if (text) onChunk(text);
      }
    }

    return {
      content: fullContent,
      thinking: thinkingContent || undefined,
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
