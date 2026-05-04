import { LLMProvider } from '../llm/types.js';
import { ToolRegistry } from '../tools/registry.js';
import { logger } from '../utils/telemetry.js';

export interface ExecutorResult {
  success: boolean;
  output: string;
}

export class Executor {
  constructor(private provider: LLMProvider, private registry: ToolRegistry) {}

  async executeStep(stepDescription: string, context: string, onUpdate: (msg: string) => void): Promise<ExecutorResult> {
    logger.info({ step: stepDescription }, 'Executing bounded step');
    onUpdate(`⚙ Executing step: ${stepDescription}`);

    const toolCatalog = this.registry.getToolCatalog();
    
    const prompt = `\
System: You are the Executor node.
Task: Execute the given step using available tools.

Step to execute: ${stepDescription}

Context:
${context}

FORMAT:
Output ONLY valid JSON.
If you need a tool:
{"thought":"reason","action":"EXACT_TOOL_NAME","input":{"key":"val"}}

If you have completed the step:
{"thought":"reason","action":"none","answer":"final result of this step"}

AVAILABLE TOOLS:
${toolCatalog}
`;

    const MAX_RETRIES = 3;
    let turnContext = `\n`;
    
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        const response = await this.provider.generate(
          [{ role: 'user', content: prompt + turnContext }],
          { temperature: 0.1, format: 'json' }
        );
        
        const raw = response.content.trim();
        const clean = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/im, '').trim();
        
        let actionObj;
        try {
          const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
          const jsonStr = (s !== -1 && e > s) ? clean.slice(s, e + 1) : clean;
          actionObj = JSON.parse(jsonStr);
        } catch (parseErr) {
          throw new Error('Failed to parse JSON: ' + clean);
        }
        
        if (actionObj.action === 'none') {
          logger.info({ answer: actionObj.answer }, 'Step completed');
          return { success: true, output: actionObj.answer || 'Done' };
        }
        
        const tool = this.registry.findTool(actionObj.action);
        if (!tool) {
           turnContext += `\n[Notice]: Tool ${actionObj.action} not found.`;
           continue;
        }

        let validatedInput = actionObj.input || {};
        try {
          const { Validator } = await import('./validator.js');
          const validator = new Validator(this.provider);
          validatedInput = await validator.validateAndRepair(
            validatedInput,
            tool.parameters,
            tool.name
          );
        } catch (validationErr: any) {
          logger.warn({ err: validationErr }, 'Input validation and repair failed');
          turnContext += `\n[Error]: Tool input validation failed for ${tool.name}. Details: ${validationErr.message}`;
          continue;
        }

        onUpdate(`⚙ Calling ${tool.name}...`);
        const result = await tool.execute(validatedInput);
        const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
        
        turnContext += `\n[Tool ${tool.name} Result]: ${resultStr}`;
        logger.info({ tool: tool.name }, 'Tool executed');

      } catch (e: any) {
        logger.error({ err: e }, 'Executor error');
        turnContext += `\n[Error]: ${e.message}`;
      }
    }

    return { success: false, output: 'Failed to complete step within limits' };
  }
}
