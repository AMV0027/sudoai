import { LLMProvider } from '../llm/types.js';
import { logger } from '../utils/telemetry.js';

export interface PlanStep {
  id: string;
  description: string;
  dependencies: string[];
}

export interface Plan {
  steps: PlanStep[];
}

export class Planner {
  constructor(private provider: LLMProvider) {}

  async createPlan(goal: string, availableTools: string): Promise<Plan | null> {
    logger.info({ goal }, 'Creating plan for goal');

    const prompt = `\
System: You are the Planner node.
Task: Break down the user's goal into a logical sequence of steps.
Available Tools:
${availableTools}

FORMAT:
Output ONLY valid JSON representing the plan. No markdown fences.
{
  "steps": [
    {
      "id": "step_1",
      "description": "Search for documentation on X",
      "dependencies": []
    },
    {
      "id": "step_2",
      "description": "Extract config values",
      "dependencies": ["step_1"]
    }
  ]
}

User Goal: ${goal}
`;

    try {
      const response = await this.provider.generate(
        [{ role: 'user', content: prompt }],
        { temperature: 0.2, format: 'json' }
      );
      
      const raw = response.content.trim();
      const plan = JSON.parse(raw) as Plan;
      
      logger.info({ stepCount: plan.steps?.length }, 'Plan created successfully');
      return plan;
    } catch (e: any) {
      logger.error({ err: e }, 'Failed to create plan');
      return null;
    }
  }
}
