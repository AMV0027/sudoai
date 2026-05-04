import fs from 'fs';
import path from 'path';

const MAX_CONTEXT_CHARS = 25000;
const MAX_FILE_CHARS = 8000;
const MAX_DEPTH = 3;

interface ContextResult {
  cleanInput: string;
  context: string;
  images?: string[];
}

export async function parseInputContext(input: string): Promise<ContextResult> {
  const patterns = input.match(/@(\S+)/g) || [];
  let cleanInput = input;
  let contextParts: string[] = [];
  let images: string[] = [];
  let totalChars = 0;

  for (const pattern of patterns) {
    const rawPath = pattern.slice(1);
    const fullPath = path.resolve(process.cwd(), rawPath);
    
    // Remove the @path from the clean input (optional, but makes it cleaner)
    cleanInput = cleanInput.replace(pattern, '').trim();

    if (!fs.existsSync(fullPath)) {
      contextParts.push(`[Context: ${pattern} (Not Found)]`);
      continue;
    }

    try {
      const stats = fs.statSync(fullPath);
      if (stats.isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
          const base64 = fs.readFileSync(fullPath, { encoding: 'base64' });
          images.push(base64);
        } else {
          const content = fs.readFileSync(fullPath, 'utf8');
          const truncated = content.length > MAX_FILE_CHARS 
            ? content.slice(0, MAX_FILE_CHARS) + '\n... [truncated]' 
            : content;
          
          const part = `[Context: ${pattern}]\n\`\`\`\n${truncated}\n\`\`\``;
          if (totalChars + part.length < MAX_CONTEXT_CHARS) {
            contextParts.push(part);
            totalChars += part.length;
          }
        }
      } else if (stats.isDirectory()) {
        const structure = getDirectoryStructure(fullPath, rawPath, 0);
        const part = `[Context: ${pattern} (Folder)]\nStructure:\n${structure}`;
        
        if (totalChars + part.length < MAX_CONTEXT_CHARS) {
          contextParts.push(part);
          totalChars += part.length;
        }
      }
    } catch (e: any) {
      contextParts.push(`[Context: ${pattern} (Error: ${e.message})]`);
    }
  }

  return {
    cleanInput: cleanInput || input, // fallback if we stripped everything
    context: contextParts.join('\n\n'),
    images: images.length > 0 ? images : undefined
  };
}

function getDirectoryStructure(dirPath: string, relativePath: string, depth: number): string {
  if (depth > MAX_DEPTH) return '... [max depth reached]';
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    let result = '';
    
    const visibleEntries = entries.filter(e => !e.name.startsWith('.')).slice(0, 50);
    
    for (const entry of visibleEntries) {
      const indent = '  '.repeat(depth);
      if (entry.isDirectory()) {
        result += `${indent}📁 ${entry.name}/\n`;
        result += getDirectoryStructure(path.join(dirPath, entry.name), path.join(relativePath, entry.name), depth + 1);
      } else {
        result += `${indent}📄 ${entry.name}\n`;
      }
    }
    
    if (entries.length > 50) result += `${'  '.repeat(depth)}... [truncated ${entries.length - 50} more items]\n`;
    
    return result;
  } catch {
    return '  [error reading directory]\n';
  }
}
