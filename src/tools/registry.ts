import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  execute: (args: any) => Promise<any>;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string) {
    return this.tools.get(name);
  }

  /** Case-insensitive fuzzy lookup — handles model using wrong casing */
  findTool(name: string): ToolDefinition | undefined {
    // Exact match first
    if (this.tools.has(name)) return this.tools.get(name);
    // Case-insensitive
    const lower = name.toLowerCase();
    for (const [k, v] of this.tools) {
      if (k.toLowerCase() === lower) return v;
    }
    // Partial suffix match (model omits prefix, e.g. "resolve-library-id" → "context7_resolve-library-id")
    for (const [k, v] of this.tools) {
      if (k.toLowerCase().endsWith('_' + lower)) return v;
    }
    return undefined;
  }

  getAllTools() {
    return Array.from(this.tools.values());
  }

  /**
   * Returns a compact human-readable tool catalog for injection into the system prompt.
   * Each tool is shown with its exact invocation name, description, and typed parameters.
   */
  getToolCatalog(): string {
    const tools = this.getAllTools();
    if (tools.length === 0) return 'No tools available.';

    return tools.map(tool => {
      // Extract param descriptions from the Zod shape
      const params: string[] = [];
      try {
        const shape = (tool.parameters as any).shape || {};
        for (const [key, field] of Object.entries<any>(shape)) {
          const def = field?._def;
          const innerDef = def?.innerType?._def ?? def;
          const type = innerDef?.typeName?.replace('Zod', '').toLowerCase() ?? 'any';
          const desc = innerDef?.description ?? def?.description ?? '';
          const isOptional = def?.typeName === 'ZodOptional';
          params.push(`  - ${key}${isOptional ? '?' : ''} (${type}): ${desc}`);
        }
      } catch {}

      const paramStr = params.length > 0 ? '\n' + params.join('\n') : ' (no parameters)';
      return `• ${tool.name}\n  ${tool.description}${paramStr}`;
    }).join('\n\n');
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}
