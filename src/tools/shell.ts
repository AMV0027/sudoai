import { z } from 'zod';
import { ToolDefinition } from './registry.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);
const MAX_OUTPUT = 8000;

export const shellExecTool: ToolDefinition = {
  name: 'shell_exec',
  description: `Execute a shell command and return stdout, stderr, and exit code.
Use this to run CLI tools, scripts, build commands, check system info, install packages, etc.
The working directory defaults to the current directory unless cwd is specified.
Output is truncated to ${MAX_OUTPUT} characters. Use specific commands for targeted output.`,
  parameters: z.object({
    command: z.string().describe('The shell command to execute'),
    cwd: z.string().optional().describe('Working directory for the command (defaults to current directory)'),
    timeout: z.number().optional().default(30000).describe('Timeout in milliseconds (default 30s)'),
  }),
  execute: async ({ command, cwd, timeout = 30000 }) => {
    const workDir = cwd || process.cwd();
    const shell = os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash';

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workDir,
        shell,
        timeout,
        maxBuffer: 1024 * 1024 * 4, // 4MB buffer
        env: { ...process.env },
      });

      return {
        stdout: (stdout || '(no output)').substring(0, MAX_OUTPUT),
        stderr: (stderr || '').substring(0, MAX_OUTPUT),
        exitCode: 0,
        cwd: workDir,
        truncated: stdout?.length > MAX_OUTPUT || stderr?.length > MAX_OUTPUT,
      };
    } catch (e: any) {
      return {
        error: (e.message || 'Command failed').substring(0, 1000),
        stdout: (e.stdout || '').substring(0, MAX_OUTPUT),
        stderr: (e.stderr || '').substring(0, MAX_OUTPUT),
        exitCode: e.code || 1,
        cwd: workDir,
      };
    }
  },
};
