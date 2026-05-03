import { z } from 'zod';

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

  getAllTools() {
    return Array.from(this.tools.values());
  }

  getToolSchemas() {
    return this.getAllTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters.shape, // Simplified for now
    }));
  }
}
