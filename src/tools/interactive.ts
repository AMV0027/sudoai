import { z } from 'zod';
import { ToolDefinition } from './registry.js';

export const askUserTool: ToolDefinition = {
  name: 'ask_user',
  description: 'Ask the user for clarification, feedback, or more information.',
  parameters: z.object({
    question: z.string().describe('The question or clarification to ask the user'),
  }),
  execute: async ({ question }) => {
    // This tool is a signal to the engine to stop and wait for user input.
    // The result is the user's response, which will be provided in the next turn.
    return { status: 'waiting_for_user', question };
  },
};
