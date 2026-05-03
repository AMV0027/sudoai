import { LLMProvider, LLMMessage } from '../llm/types.js';
import { ToolRegistry } from '../tools/registry.js';
import { HistoryManager, Message } from '../memory/history.js';

export interface AgentConfig {
  provider: LLMProvider;
  registry: ToolRegistry;
  history: HistoryManager;
  maxSteps?: number;
}

export class AgentEngine {
  private provider: LLMProvider;
  private registry: ToolRegistry;
  private history: HistoryManager;
  private maxSteps: number;

  constructor(config: AgentConfig) {
    this.provider = config.provider;
    this.registry = config.registry;
    this.history = config.history;
    this.maxSteps = config.maxSteps || 5;
  }

  getHistory() {
    return this.history;
  }

  private constructSystemPrompt(): string {
    const tools = this.registry.getAllTools().map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    return `You are sudoai, a terminal-native advanced personal intelligence.
You operate in a sophisticated Orchestration Loop: Plan -> Act -> Reflect.

CORE PRINCIPLES:
1.  **Planning**: Before acting, always refine your plan based on the goal.
2.  **Orchestration**: Break complex tasks into sub-tasks.
3.  **Clarification**: Use 'ask_user' if a request is ambiguous or requires more context.
4.  **Self-Correction**: If a tool fails, reflect on the error and try a different approach.

AVAILABLE TOOLS:
${JSON.stringify(tools, null, 2)}

RESPONSE FORMAT:
Your response MUST be a valid JSON object:
{
  "plan": "your multi-step strategy",
  "thought": "reasoning for the current step",
  "action": "tool_name" or "none",
  "input": { "arg_name": "value" },
  "reflection": "analyze previous results if any",
  "answer": "final answer to the user" (only if action is "none")
}

Always respond with JSON.`;
  }

  async run(userInput: string, onUpdate: (chunk: string) => void) {
    // Only add user message if it's not a continuation (empty userInput means continuation)
    if (userInput) {
      this.history.addMessage({ role: 'user', content: userInput });
    }

    let currentStep = 0;
    while (currentStep < this.maxSteps) {
      const messages = this.history.getMessages();
      const llmMessages: LLMMessage[] = [
        { role: 'system', content: this.constructSystemPrompt() },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ];

      const response = await this.provider.generate(llmMessages);
      let parsedResponse;

      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : response.content;
        parsedResponse = JSON.parse(jsonString);
      } catch (e) {
        this.history.addMessage({ role: 'assistant', content: response.content });
        onUpdate(response.content);
        return response.content;
      }

      const { plan, thought, action, input, answer, reflection } = parsedResponse;

      if (action === 'none') {
        this.history.addMessage({ role: 'assistant', content: answer, thought });
        onUpdate(answer);
        return answer;
      }

      if (action === 'ask_user') {
        this.history.addMessage({ role: 'assistant', content: input.question, thought });
        onUpdate(input.question);
        return input.question; // Stop and wait for user input
      }

      const tool = this.registry.getTool(action);
      if (!tool) {
        this.history.addMessage({ role: 'system', content: `Tool "${action}" not found.` });
        continue;
      }

      onUpdate(`[Plan: ${plan}]\n[Thinking: ${thought}] Calling ${action}...`);
      
      try {
        const result = await tool.execute(input);
        this.history.addMessage({
          role: 'tool',
          content: JSON.stringify(result),
          tool_calls: { name: action, input },
          tool_results: result
        });
      } catch (e: any) {
        this.history.addMessage({ role: 'system', content: `Error: ${e.message}` });
      }

      currentStep++;
    }

    return "Reached maximum steps.";
  }
}
