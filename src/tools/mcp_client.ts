import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ToolRegistry } from "./registry.js";
import { MCPServerConfig } from "../utils/mcp.js";
import { z } from 'zod';

export class MCPClientManager {
  private clients: Map<string, Client> = new Map();

  async connectAndRegister(
    name: string, 
    config: MCPServerConfig, 
    registry: ToolRegistry
  ) {
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
        registry.register({
          name: `${name}_${tool.name}`,
          description: tool.description || '',
          parameters: z.object({}).passthrough() as any, // Allow dynamic parameters
          execute: async (input) => {
            const result = await client.callTool({
              name: tool.name,
              arguments: input
            });
            return result.content;
          }
        });
      }

      return tools.length;
    } catch (e) {
      console.error(`Failed to connect to MCP server ${name}:`, e);
      return 0;
    }
  }

  async disconnectAll() {
    for (const client of this.clients.values()) {
      await client.close();
    }
    this.clients.clear();
  }
}
