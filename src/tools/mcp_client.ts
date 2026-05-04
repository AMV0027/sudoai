import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ToolRegistry } from "./registry.js";
import { MCPServerConfig } from "../utils/mcp.js";
import { z } from 'zod';

export interface MCPConnectionResult {
  name: string;
  toolCount: number;
  error?: string;
  tools: string[];
}

/**
 * Extracts a plain string from an MCP tool call result.
 * The MCP SDK returns { content: Array<{ type: 'text', text: string } | { type: 'image', ... }> }
 */
function extractMCPResult(rawResult: any): string {
  if (!rawResult) return 'No result returned.';

  // Standard MCP content array
  if (Array.isArray(rawResult.content)) {
    const parts = rawResult.content
      .filter((c: any) => c.type === 'text' && c.text)
      .map((c: any) => c.text as string);
    if (parts.length > 0) return parts.join('\n');
  }

  // Already a string
  if (typeof rawResult === 'string') return rawResult;

  // Fallback: serialize
  return JSON.stringify(rawResult, null, 2);
}

/**
 * Builds a Zod schema from an MCP tool's JSON Schema inputSchema.
 * This ensures the LLM knows what parameters to pass.
 */
function buildZodSchema(inputSchema: any): z.ZodObject<any> {
  if (!inputSchema?.properties) return z.object({}).passthrough();

  const shape: Record<string, z.ZodTypeAny> = {};
  const required: string[] = inputSchema.required || [];

  for (const [key, def] of Object.entries<any>(inputSchema.properties)) {
    let field: z.ZodTypeAny;

    switch (def.type) {
      case 'number':
      case 'integer':
        field = z.number().describe(def.description || key);
        break;
      case 'boolean':
        field = z.boolean().describe(def.description || key);
        break;
      case 'array':
        field = z.array(z.any()).describe(def.description || key);
        break;
      case 'object':
        field = z.record(z.string(), z.any()).describe(def.description || key);
        break;
      default:
        field = z.string().describe(def.description || key);
    }

    if (!required.includes(key)) {
      field = field.optional();
    }

    shape[key] = field;
  }

  return z.object(shape);
}

export class MCPClientManager {
  private clients: Map<string, Client> = new Map();

  async connectAndRegister(
    name: string,
    config: MCPServerConfig,
    registry: ToolRegistry
  ): Promise<MCPConnectionResult> {
    const result: MCPConnectionResult = { name, toolCount: 0, tools: [] };

    try {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: { ...process.env, ...(config.env || {}) } as any
      });

      const client = new Client(
        { name: "sudoai-client", version: "1.0.0" },
        { capabilities: {} }
      );

      await client.connect(transport);
      this.clients.set(name, client);

      const { tools } = await client.listTools();

      for (const tool of tools) {
        const toolName = `${name}_${tool.name}`;
        const zodSchema = buildZodSchema(tool.inputSchema);

        registry.register({
          name: toolName,
          description: `[MCP:${name}] ${tool.description || tool.name}`,
          parameters: zodSchema,
          execute: async (input: any) => {
            try {
              const callResult = await client.callTool({
                name: tool.name,
                arguments: input ?? {}
              });
              return extractMCPResult(callResult);
            } catch (e: any) {
              return `MCP tool "${tool.name}" error: ${e.message}`;
            }
          }
        });

        result.tools.push(toolName);
      }

      result.toolCount = tools.length;
      return result;
    } catch (e: any) {
      result.error = e.message || String(e);
      return result;
    }
  }

  async disconnectAll() {
    for (const client of this.clients.values()) {
      try {
        await client.close();
      } catch (_) {}
    }
    this.clients.clear();
  }
}
