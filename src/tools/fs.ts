import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { ToolDefinition } from './registry.js';

export const readFileTool: ToolDefinition = {
  name: 'read_file',
  description: 'Read the contents of a file.',
  parameters: z.object({
    path: z.string().describe('The path to the file to read'),
  }),
  execute: async ({ path: filePath }) => {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    return { content };
  },
};

export const writeFileTool: ToolDefinition = {
  name: 'write_file',
  description: 'Write content to a file.',
  parameters: z.object({
    path: z.string().describe('The path to the file to write'),
    content: z.string().describe('The content to write to the file'),
  }),
  execute: async ({ path: filePath, content }) => {
    const fullPath = path.resolve(process.cwd(), filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf8');
    return { success: true, path: filePath };
  },
};

export const listFilesTool: ToolDefinition = {
  name: 'list_files',
  description: 'List files in a directory.',
  parameters: z.object({
    path: z.string().optional().default('.').describe('The directory path to list'),
  }),
  execute: async ({ path: dirPath }) => {
    const fullPath = path.resolve(process.cwd(), dirPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }
    const files = fs.readdirSync(fullPath, { withFileTypes: true });
    return {
      files: files.map((f) => ({
        name: f.name,
        isDirectory: f.isDirectory(),
      })),
    };
  },
};

export const searchFilesTool: ToolDefinition = {
  name: 'search_files',
  description: 'Search for a string within files (grep).',
  parameters: z.object({
    query: z.string().describe('The string to search for'),
    path: z.string().optional().default('.').describe('The directory to search in'),
  }),
  execute: async ({ query, path: dirPath }) => {
    const { $ } = await import('zx');
    try {
      const result = await ( $ as any ).raw`grep -rnE ${query} ${dirPath} | head -n 20`;
      return { results: result.stdout };
    } catch (e) {
      return { results: 'No matches found.' };
    }
  },
};
