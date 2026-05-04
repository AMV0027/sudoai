import { LLMProvider, LLMMessage } from '../llm/types.js';
import { ToolRegistry } from '../tools/registry.js';
import { HistoryManager } from '../memory/history.js';
import os from 'os';

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
    this.maxSteps = config.maxSteps || 10;
  }

  getHistory() {
    return this.history;
  }

  private constructSystemPrompt(): string {
    const tools = this.registry.getAllTools().map(t => {
      // Extract parameter descriptions from zod shape for the LLM
      const params: Record<string, string> = {};
      try {
        const shape = (t.parameters as any).shape || {};
        for (const key of Object.keys(shape)) {
          const field = shape[key];
          const desc = field?._def?.description || field?._def?.innerType?._def?.description || '';
          params[key] = desc;
        }
      } catch {}
      return { name: t.name, description: t.description, parameters: params };
    });

    const cwd = process.cwd();
    const platform = os.platform();
    const homeDir = os.homedir();
    const shell = platform === 'win32' ? 'PowerShell' : 'bash';

    return `You are sudoai — a powerful, terminal-native AI agent.
You have access to tools and can reason through complex tasks step by step.

## ENVIRONMENT
- OS: ${platform} (${os.release()})
- Shell: ${shell}
- Working Directory: ${cwd}
- Home: ${homeDir}
- Time: ${new Date().toISOString()}

## AVAILABLE TOOLS
${tools.map(t => `### ${t.name}\n${t.description}\nParameters: ${JSON.stringify(t.parameters, null, 2)}`).join('\n\n')}

## HOW TO RESPOND
You MUST always respond with a single valid JSON object. No prose, no markdown fences.

When you need to call a tool:
{"thought": "why you're calling this tool", "action": "tool_name", "input": {}}

When you have the final answer:
{"thought": "synthesis reasoning", "action": "none", "answer": "your complete, well-formatted answer to the user"}

## RULES
1. Call only ONE tool per turn.
2. Never repeat the exact same tool call with the same arguments.
3. After gathering information, synthesize a clear human-readable answer — do NOT dump raw tool output.
4. For file operations: use list_files first to understand the structure, then read/write specific files.
5. For shell commands: prefer precise commands over broad ones; check exit codes.
6. For web tasks: use web_search to find sources, then fetch_url to get page details if needed.
7. When uncertain about what the user wants, use ask_user.
8. Format your final answers clearly with relevant data highlighted.`;
  }

  /**
   * Serialize history into only 'user'/'assistant' roles that Ollama local models can understand.
   * 'tool' and 'system' roles are not natively supported by most local models and are silently
   * dropped, causing the model to never see tool results.
   */
  private serializeHistory(): LLMMessage[] {
    const messages = this.history.getMessages();
    const result: LLMMessage[] = [];

    for (const m of messages) {
      if (m.role === 'user') {
        result.push({ role: 'user', content: m.content });
      } else if (m.role === 'assistant') {
        result.push({ role: 'assistant', content: m.content });
      } else if (m.role === 'tool') {
        // Present tool results as an assistant observation so the model can read it
        const toolName = (m as any).tool_calls?.name || 'tool';
        let resultText = m.content;
        // Truncate very large tool outputs in context
        if (resultText.length > 6000) {
          resultText = resultText.substring(0, 6000) + '\n... [output truncated]';
        }
        result.push({
          role: 'assistant',
          content: `[Tool Result: ${toolName}]\n${resultText}`
        });
      } else if (m.role === 'system') {
        // Engine directives: inject as a user nudge so the model sees them
        result.push({ role: 'user', content: `[System]: ${m.content}` });
      }
    }

    return result;
  }

  async run(userInput: string, onUpdate: (chunk: string) => void) {
    if (userInput) {
      this.history.addMessage({ role: 'user', content: userInput });
    }

    let currentStep = 0;
    const calledTools: Set<string> = new Set();

    while (currentStep < this.maxSteps) {
      const llmMessages: LLMMessage[] = [
        { role: 'system', content: this.constructSystemPrompt() },
        ...this.serializeHistory()
      ];

      let rawResponse: string;
      try {
        const response = await this.provider.generate(llmMessages);
        rawResponse = response.content;
      } catch (e: any) {
        const errMsg = `I encountered an error: ${e.message}`;
        this.history.addMessage({ role: 'assistant', content: errMsg });
        onUpdate(errMsg);
        return errMsg;
      }

      // Parse response — strip any accidental markdown fences
      let parsedResponse: any;
      try {
        const cleaned = rawResponse.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        parsedResponse = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
      } catch (e) {
        // Not parseable JSON — treat as a plain text final answer
        this.history.addMessage({ role: 'assistant', content: rawResponse });
        onUpdate(rawResponse);
        return rawResponse;
      }

      const { thought, action, input, answer } = parsedResponse;

      // --- Final answer ---
      if (!action || action === 'none') {
        const finalAnswer = answer || rawResponse;
        this.history.addMessage({ role: 'assistant', content: finalAnswer, thought });
        onUpdate(finalAnswer);
        return finalAnswer;
      }

      // --- ask_user special action ---
      if (action === 'ask_user') {
        const question = input?.question || 'Could you clarify?';
        this.history.addMessage({ role: 'assistant', content: question, thought });
        onUpdate(question);
        return question;
      }

      // --- Tool call ---
      const tool = this.registry.getTool(action);
      if (!tool) {
        this.history.addMessage({
          role: 'system',
          content: `Tool "${action}" not found. Available tools: ${this.registry.getAllTools().map(t => t.name).join(', ')}.`
        });
        currentStep++;
        continue;
      }

      // Deduplicate: don't call same tool+input twice
      const callKey = `${action}:${JSON.stringify(input)}`;
      if (calledTools.has(callKey)) {
        this.history.addMessage({
          role: 'system',
          content: `You already called "${action}" with these exact inputs. Use the result already in context to produce your final answer.`
        });
        currentStep++;
        continue;
      }
      calledTools.add(callKey);

      onUpdate(`[Thinking: ${thought || '...'}] → Using ${action}...`);

      // Coerce common LLM mistakes: string booleans → actual booleans
      const coercedInput = input ? Object.entries(input).reduce((acc: any, [k, v]) => {
        if (v === 'true') acc[k] = true;
        else if (v === 'false') acc[k] = false;
        else acc[k] = v;
        return acc;
      }, {}) : input;

      try {
        const result = await tool.execute(coercedInput);
        const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
        this.history.addMessage({
          role: 'tool',
          content: resultStr,
          tool_calls: { name: action, input },
          tool_results: result
        });
      } catch (e: any) {
        this.history.addMessage({
          role: 'system',
          content: `Tool "${action}" threw an error: ${e.message}. Try a different approach.`
        });
      }

      currentStep++;
    }

    // If we hit max steps, ask the model to synthesize with what it has
    const finalMessages: LLMMessage[] = [
      { role: 'system', content: this.constructSystemPrompt() },
      ...this.history.getMessages().map(m => ({ role: m.role as any, content: m.content })),
      { role: 'system', content: 'You have reached the maximum number of steps. Synthesize a final answer from the information gathered so far. Respond with JSON where action is "none".' }
    ];

    try {
      const finalResponse = await this.provider.generate(finalMessages);
      const cleaned = finalResponse.content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const ans = parsed.answer || finalResponse.content;
        this.history.addMessage({ role: 'assistant', content: ans });
        onUpdate(ans);
        return ans;
      }
    } catch (e) {
      // fallthrough
    }

    const fallback = 'I gathered the information but reached my step limit. Please ask me to summarize.';
    this.history.addMessage({ role: 'assistant', content: fallback });
    onUpdate(fallback);
    return fallback;
  }
}
