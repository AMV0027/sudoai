import { $ } from 'zx';
import { z } from 'zod';
import { ToolDefinition } from './registry.js';

export const shellExecTool: ToolDefinition = {
  name: 'shell_exec',
  description: 'Execute a shell command.',
  parameters: z.object({
    command: z.string().describe('The command to execute'),
  }),
  execute: async ({ command }) => {
    try {
      const result = await ($ as any).raw`${command}`;
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    } catch (e: any) {
      return {
        error: e.message,
        stderr: e.stderr || '',
        exitCode: e.exitCode || 1,
      };
    }
  },
};
