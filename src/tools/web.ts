import { z } from 'zod';
import { ToolDefinition } from './registry.js';
import axios from 'axios';
import { ConfigManager } from '../utils/config.js';

const searchCache = new Map<string, any>();
const configManager = ConfigManager.getInstance();

const getApiKey = () => {
  const config = configManager.get();
  return config.ollamaApiKey || process.env.OLLAMA_API_KEY;
};

export const webSearchTool: ToolDefinition = {
  name: 'web_search',
  description: 'Search the web for information using Ollama Search.',
  parameters: z.object({
    query: z.string().describe('The search query'),
    max_results: z.number().optional().default(5).describe('Maximum number of results to return (max 10)'),
  }),
  execute: async ({ query, max_results }) => {
    const cacheKey = `${query}_${max_results}`;
    if (searchCache.has(cacheKey)) {
      return searchCache.get(cacheKey);
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return { error: 'Ollama API key not found. Please set it via sudoai setup or OLLAMA_API_KEY env var.' };
    }

    try {
      const response = await axios.post('https://ollama.com/api/web_search', {
        query,
        max_results: Math.min(max_results, 10)
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const results = response.data.results.map((r: any) => ({
        title: r.title,
        link: r.url,
        description: r.content
      }));

      const resultPayload = { results };
      searchCache.set(cacheKey, resultPayload);
      return resultPayload;
    } catch (e: any) {
      const errorMsg = e.response?.data?.error || e.message;
      console.error('Ollama Search failed:', errorMsg);
      return { error: `Ollama Search failed: ${errorMsg}` };
    }
  },
};

export const fetchUrlTool: ToolDefinition = {
  name: 'fetch_url',
  description: 'Fetch the content of a URL and return it as clean text using Ollama Fetch.',
  parameters: z.object({
    url: z.string().describe('The URL to fetch'),
  }),
  execute: async ({ url }) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      return { error: 'Ollama API key not found. Please set it via sudoai setup or OLLAMA_API_KEY env var.' };
    }

    try {
      const response = await axios.post('https://ollama.com/api/web_fetch', {
        url
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return { 
        title: response.data.title,
        content: response.data.content,
        url: url,
        links: response.data.links
      };
    } catch (e: any) {
      const errorMsg = e.response?.data?.error || e.message;
      console.error('Ollama Fetch failed:', errorMsg);
      return { error: `Ollama Fetch failed: ${errorMsg}` };
    }
  },
};
