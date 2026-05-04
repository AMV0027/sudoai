import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { ToolDefinition } from './registry.js';

const MAX_FILE_CHARS = 12000;

export const readFileTool: ToolDefinition = {
  name: 'read_file',
  description: `Read the contents of a file from disk.
Returns the file content as a string.
Large files are truncated to ${MAX_FILE_CHARS} characters.
Provide an absolute or relative path from the current working directory.`,
  parameters: z.object({
    path: z.string().describe('Path to the file (absolute or relative to cwd)'),
    start_line: z.number().optional().describe('Line number to start reading from (1-indexed, inclusive)'),
    end_line: z.number().optional().describe('Line number to stop reading at (1-indexed, inclusive)'),
  }),
  execute: async ({ path: filePath, start_line, end_line }) => {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      return { error: `File not found: ${filePath}` };
    }

    const stat = fs.statSync(fullPath);
    const content = fs.readFileSync(fullPath, 'utf8');

    if (start_line !== undefined || end_line !== undefined) {
      const lines = content.split('\n');
      const from = (start_line ?? 1) - 1;
      const to = end_line ?? lines.length;
      const slice = lines.slice(from, to).join('\n');
      return {
        content: slice.substring(0, MAX_FILE_CHARS),
        lines_shown: `${from + 1}-${to}`,
        total_lines: lines.length,
        truncated: slice.length > MAX_FILE_CHARS,
      };
    }

    const truncated = content.length > MAX_FILE_CHARS;
    return {
      content: content.substring(0, MAX_FILE_CHARS),
      size_bytes: stat.size,
      total_lines: content.split('\n').length,
      truncated,
      note: truncated ? `File truncated. Use start_line/end_line to read specific sections.` : undefined,
    };
  },
};

export const writeFileTool: ToolDefinition = {
  name: 'write_file',
  description: `Write content to a file, creating parent directories if needed.
Overwrites existing content unless append mode is used.
Use this to create new files, save output, write config, code, etc.`,
  parameters: z.object({
    path: z.string().describe('Path to the file to write (absolute or relative to cwd)'),
    content: z.string().describe('The full content to write to the file'),
    append: z.boolean().optional().default(false).describe('If true, appends to the file instead of overwriting'),
  }),
  execute: async ({ path: filePath, content, append = false }) => {
    try {
      const fullPath = path.resolve(process.cwd(), filePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (append) {
        fs.appendFileSync(fullPath, content, 'utf8');
      } else {
        fs.writeFileSync(fullPath, content, 'utf8');
      }
      return {
        success: true,
        path: fullPath,
        mode: append ? 'appended' : 'written',
        bytes_written: Buffer.byteLength(content, 'utf8'),
      };
    } catch (e: any) {
      return { error: `Write failed: ${e.message}` };
    }
  },
};

export const listFilesTool: ToolDefinition = {
  name: 'list_files',
  description: `List files and directories inside a given directory path.
Returns names, types (file/dir), and sizes.
Use this to explore project structure before reading/editing files.`,
  parameters: z.object({
    path: z.string().optional().default('.').describe('Directory path to list (defaults to current working directory)'),
    show_hidden: z.boolean().optional().default(false).describe('Include hidden files/folders (starting with .)'),
  }),
  execute: async ({ path: dirPath, show_hidden = false }) => {
    try {
      const fullPath = path.resolve(process.cwd(), dirPath);
      if (!fs.existsSync(fullPath)) {
        return { error: `Directory not found: ${dirPath}` };
      }
      const entries = fs.readdirSync(fullPath, { withFileTypes: true });
      const files = entries
        .filter(f => show_hidden || !f.name.startsWith('.'))
        .map(f => {
          const entryPath = path.join(fullPath, f.name);
          let size: number | undefined;
          try { size = f.isFile() ? fs.statSync(entryPath).size : undefined; } catch {}
          return {
            name: f.name,
            type: f.isDirectory() ? 'directory' : 'file',
            size_bytes: size,
          };
        });
      return { path: fullPath, total: files.length, files };
    } catch (e: any) {
      return { error: `List failed: ${e.message}` };
    }
  },
};

export const searchFilesTool: ToolDefinition = {
  name: 'search_files',
  description: `Search for text patterns within files using ripgrep (or grep as fallback).
Returns matching file paths, line numbers, and snippets.
Use this to find function definitions, variable usages, config values, etc.`,
  parameters: z.object({
    query: z.string().describe('The text pattern to search for (supports regex)'),
    path: z.string().optional().default('.').describe('Directory or file to search in'),
    file_pattern: z.string().optional().describe('Glob pattern to filter files, e.g. "*.ts" or "*.json"'),
    case_sensitive: z.boolean().optional().default(false).describe('Whether the search is case-sensitive'),
  }),
  execute: async ({ query, path: searchPath, file_pattern, case_sensitive }) => {
    const { $ } = await import('zx');
    const fullPath = path.resolve(process.cwd(), searchPath);

    try {
      // Try ripgrep first (faster, better output)
      const globFlag = file_pattern ? `--glob=${file_pattern}` : '';
      const caseFlag = case_sensitive ? '' : '-i';
      const proc = await ($ as any)`rg --line-number ${caseFlag} ${globFlag} ${query} ${fullPath} --max-count=3 --max-filesize=1M 2>&1 | head -n 50`;
      return { results: proc.stdout || 'No matches found.' };
    } catch {
      try {
        // Fallback to grep
        const caseFlag = case_sensitive ? '' : '-i';
        const result = await ($ as any).raw`grep -rn ${caseFlag} ${query} ${fullPath} --include="${file_pattern || '*'}" | head -n 30`;
        return { results: result.stdout || 'No matches found.' };
      } catch {
        return { results: 'No matches found.' };
      }
    }
  },
};

export const fileStatsTool: ToolDefinition = {
  name: 'file_stats',
  description: `Get metadata about a file or directory: size, line count, last modified time, type.
Use this before reading a large file to decide whether to read it in chunks.`,
  parameters: z.object({
    path: z.string().describe('Path to the file or directory'),
  }),
  execute: async ({ path: filePath }) => {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      return { error: `Path not found: ${filePath}` };
    }
    const stat = fs.statSync(fullPath);
    const result: any = {
      path: fullPath,
      type: stat.isDirectory() ? 'directory' : 'file',
      size_bytes: stat.size,
      modified: stat.mtime.toISOString(),
    };
    if (stat.isFile()) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        result.total_lines = content.split('\n').length;
      } catch {}
    }
    return result;
  },
};
