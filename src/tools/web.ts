import { z } from 'zod';
import { ToolDefinition } from './registry.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

const searchCache = new Map<string, any>();

/**
 * Real web search via DuckDuckGo HTML scrape (no API key required).
 * Falls back to Bing HTML scrape if DDG returns no results.
 */
async function scrapeSearch(query: string, maxResults: number): Promise<{ title: string; link: string; description: string }[]> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  // --- DuckDuckGo HTML search ---
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`;
    const { data } = await axios.get(ddgUrl, { headers, timeout: 10000 });
    const $ = cheerio.load(data);
    const results: { title: string; link: string; description: string }[] = [];

    $('.result__body').each((_, el) => {
      if (results.length >= maxResults) return false;
      const title = $(el).find('.result__title').text().trim();
      const rawLink = $(el).find('.result__url').attr('href') || $(el).find('.result__a').attr('href') || '';
      // DDG wraps links; extract the real URL
      const linkMatch = rawLink.match(/uddg=([^&]+)/);
      const link = linkMatch ? decodeURIComponent(linkMatch[1]) : rawLink;
      const description = $(el).find('.result__snippet').text().trim();
      if (title && link) {
        results.push({ title, link, description });
      }
    });

    if (results.length > 0) return results;
  } catch (_) {
    // Fall through to Bing
  }

  // --- Bing HTML fallback ---
  try {
    const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
    const { data } = await axios.get(bingUrl, { headers, timeout: 10000 });
    const $ = cheerio.load(data);
    const results: { title: string; link: string; description: string }[] = [];

    $('#b_results .b_algo').each((_, el) => {
      if (results.length >= maxResults) return false;
      const title = $(el).find('h2').text().trim();
      const link = $(el).find('h2 a').attr('href') || '';
      const description = $(el).find('.b_caption p').text().trim();
      if (title && link) {
        results.push({ title, link, description });
      }
    });

    return results;
  } catch (_) {
    return [];
  }
}

export const webSearchTool: ToolDefinition = {
  name: 'web_search',
  description: 'Search the web for up-to-date information. Returns a list of results with titles, URLs, and descriptions. Use this when the user asks about current events, recent developments, or factual information you may not have in your training data.',
  parameters: z.object({
    query: z.string().describe('The search query. Be specific for better results.'),
    max_results: z.number().optional().default(5).describe('Maximum number of results to return (1-10)'),
  }),
  execute: async ({ query, max_results = 5 }) => {
    const cacheKey = `${query}_${max_results}`;
    if (searchCache.has(cacheKey)) {
      return searchCache.get(cacheKey);
    }

    try {
      const results = await scrapeSearch(query, Math.min(max_results, 10));

      if (results.length === 0) {
        return {
          results: [],
          note: 'No results found for this query. Try rephrasing or use a different search term.',
        };
      }

      // Format as readable text for the LLM so it can synthesize an answer
      const formatted = results.map((r, i) =>
        `[${i + 1}] ${r.title}\nURL: ${r.link}\n${r.description}`
      ).join('\n\n');

      const payload = {
        results,
        summary: `Found ${results.length} results for "${query}":\n\n${formatted}`,
      };

      searchCache.set(cacheKey, payload);
      return payload;
    } catch (e: any) {
      return { error: `Web search failed: ${e.message}`, results: [] };
    }
  },
};

export const fetchUrlTool: ToolDefinition = {
  name: 'fetch_url',
  description: 'Fetch the main text content of a URL. Use this after web_search to get full details from a specific page.',
  parameters: z.object({
    url: z.string().describe('The URL to fetch'),
  }),
  execute: async ({ url }) => {
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      };
      const { data } = await axios.get(url, { headers, timeout: 12000 });
      const $ = cheerio.load(data);

      // Remove noise elements
      $('script, style, nav, footer, header, aside, [role="navigation"], .ad, .ads, #cookie-banner').remove();

      const title = $('title').text().trim() || $('h1').first().text().trim();
      // Extract meaningful paragraphs
      const paragraphs: string[] = [];
      $('p, h1, h2, h3, h4, li').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 40) paragraphs.push(text);
      });

      const content = paragraphs.slice(0, 60).join('\n').substring(0, 8000);

      return { title, url, content: content || 'No readable content found.' };
    } catch (e: any) {
      return { error: `Failed to fetch URL: ${e.message}`, url };
    }
  },
};
