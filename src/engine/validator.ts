import { z } from 'zod';
import { LLMProvider } from '../llm/types.js';
import { logger } from '../utils/telemetry.js';

export class Validator {
  constructor(private provider: LLMProvider) {}

  /**
   * Validates input against a zod schema.
   * If it fails, attempts to use the LLM to repair the JSON based on the schema requirements.
   */
  async validateAndRepair<T>(input: any, schema: z.ZodType<T>, toolName: string, maxRetries = 2): Promise<T> {
    let currentInput = input;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = schema.safeParse(currentInput);
      if (result.success) {
        return result.data;
      }

      logger.warn({ tool: toolName, errors: result.error.issues }, 'Validation failed, attempting repair');
      
      const errorStr = JSON.stringify(result.error.issues, null, 2);
      const inputStr = JSON.stringify(currentInput, null, 2);
      
      const prompt = `\
System: You are a JSON repair node.
Task: Fix the provided JSON so it matches the required schema.

Tool: ${toolName}
Invalid JSON:
${inputStr}

Validation Errors:
${errorStr}

FORMAT:
Output ONLY valid JSON representing the fixed input. Do not wrap in markdown or add explanations.`;

      try {
        const resp = await this.provider.generate(
          [{ role: 'user', content: prompt }],
          { temperature: 0.1, format: 'json' }
        );
        currentInput = JSON.parse(resp.content.trim());
      } catch (e: any) {
        logger.error({ err: e }, 'Repair generation failed');
        throw new Error(`Failed to repair input for ${toolName}: ${e.message}`);
      }
    }

    throw new Error(`Failed to validate input for ${toolName} after ${maxRetries} attempts.`);
  }
}
