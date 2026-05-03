import { z } from 'zod';
import { ToolDefinition } from './registry.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

const searchCache = new Map<string, any>();
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

export const webSearchTool: ToolDefinition = {
  name: 'web_search',
  description: 'Search the web for information using DuckDuckGo.',
  parameters: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({ query }) => {
    if (searchCache.has(query)) {
      return searchCache.get(query);
    }

    try {
      // Small human-like delay
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

      const response = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      });

      const $ = cheerio.load(response.data);
      const results: any[] = [];

      $('.result').each((_, el) => {
        const titleEl = $(el).find('.result__a');
        const title = titleEl.text().trim();
        const link = titleEl.attr('href');
        const snippet = $(el).find('.result__snippet').text().trim();

        if (title && link) {
          // DDG HTML links sometimes have internal redirects, we want clean URLs
          let cleanLink = link;
          if (link.includes('//uddg=')) {
            const match = link.match(/\/\/uddg=([^&]+)/);
            if (match && match[1]) {
              cleanLink = decodeURIComponent(match[1]);
            }
          }

          results.push({
            title,
            link: cleanLink,
            description: snippet
          });
        }
      });

      const resultPayload = { results: results.slice(0, 5) };
      searchCache.set(query, resultPayload);
      return resultPayload;
    } catch (e: any) {
      console.error('Search failed:', e.message);
      return { error: 'Search failed. DuckDuckGo might be temporarily unavailable.' };
    }
  },
};

export const fetchUrlTool: ToolDefinition = {
  name: 'fetch_url',
  description: 'Fetch the content of a URL and return it as clean text.',
  parameters: z.object({
    url: z.string().describe('The URL to fetch'),
  }),
  execute: async ({ url }) => {
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Remove noise
      $('script, style, nav, footer, header, aside, iframe, .ads, .sidebar').remove();
      
      const text = $('body')
        .text()
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();

      return { 
        content: text.substring(0, 15000),
        url: url
      };
    } catch (e: any) {
      return { error: `Fetch failed: ${e.message}` };
    }
  },
};
