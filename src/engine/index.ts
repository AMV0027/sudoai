import { LLMProvider, LLMMessage } from '../llm/types.js';
import { ToolRegistry } from '../tools/registry.js';
import { HistoryManager } from '../memory/history.js';
import { AgentMode } from '../utils/config.js';
import os from 'os';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FORMAT_RETRIES = 3;
const MAX_STEPS = 10;
const MAX_TOOL_OUTPUT = 6000;

// Pseudo-actions that are NOT real tools — treated as format errors
const INVALID_ACTIONS = new Set(['error', 'tool', 'none_of_the_above', 'unknown', '']);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentConfig {
  provider: LLMProvider;
  registry: ToolRegistry;
  history: HistoryManager;
  maxSteps?: number;
  mode?: AgentMode;
}

interface AgentStep {
  thought?: string;
  action: string;
  input?: Record<string, any>;
  answer?: string;
}

// ─── Conversation item stored internally (not in HistoryManager) ─────────────

interface TurnItem {
  role: 'user' | 'assistant_final' | 'tool_call' | 'tool_result' | 'system_notice';
  content: string;
  toolName?: string;
  input?: any;
  images?: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/```\s*$/im, '')
    .trim();
}

/**
 * Tries several strategies to extract a valid AgentStep JSON from model output.
 * Rejects objects that only have invalid pseudo-actions.
 */
function extractAgentStep(raw: string): AgentStep | null {
  const clean = stripFences(stripThinkTags(raw));

  const candidates: string[] = [clean];

  // Outermost { ... }
  const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
  if (s !== -1 && e > s) candidates.push(clean.slice(s, e + 1));

  // First JSON block containing "action"
  const m = clean.match(/\{[^{}]*"action"[^{}]*\}/);
  if (m) candidates.push(m[0]);

  // All { ... } blocks
  for (const match of clean.matchAll(/\{[\s\S]*?\}/g)) {
    candidates.push(match[0]);
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && typeof parsed.action === 'string') {
        // Reject hallucinated pseudo-actions that aren't real tools
        if (INVALID_ACTIONS.has(parsed.action.toLowerCase())) continue;
        return parsed as AgentStep;
      }
    } catch { continue; }
  }
  return null;
}

/**
 * Detects known wrong formats and returns a targeted correction message.
 */
function detectWrongFormat(raw: string): string | null {
  if (/"tool_calls"\s*:\s*\[/.test(raw))
    return 'ERROR: You used OpenAI tool_calls format. Use the format shown in the examples above.';
  if (/"tool_code"/.test(raw))
    return 'ERROR: You used Gemini tool_code format. Use the format shown in the examples above.';
  if (/"function_call"/.test(raw))
    return 'ERROR: You used function_call format. Use the format shown in the examples above.';
  if (/"type"\s*:\s*"tool_use"/.test(raw))
    return 'ERROR: You used Anthropic tool_use format. Use the format shown in the examples above.';
  if (/"action"\s*:\s*"error"/.test(raw))
    return 'ERROR: "error" is not a valid action. Use "none" to give a final answer, or use an exact tool name to call a tool.';
  return null;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class AgentEngine {
  private provider: LLMProvider;
  private registry: ToolRegistry;
  private history: HistoryManager;
  private maxSteps: number;
  private mode: AgentMode;

  constructor(config: AgentConfig) {
    this.provider = config.provider;
    this.registry = config.registry;
    this.history = config.history;
    this.mode = config.mode ?? 'simple';
    // Research gets more steps; simple/agent use the default
    this.maxSteps = config.maxSteps ?? (this.mode === 'research' ? 20 : MAX_STEPS);
  }

  getHistory() {
    return this.history;
  }

  // ── System Prompt ────────────────────────────────────────────────────────

  private buildSystemPrompt(_turns: TurnItem[]): string {
    const cwd = process.cwd();
    const platform = os.platform();
    const shell = platform === 'win32' ? 'PowerShell' : 'bash';
    const envBlock = `ENVIRONMENT: OS=${platform} | Shell=${shell} | CWD=${cwd} | Time=${new Date().toISOString()}`;

    // ── Simple mode: pure conversation, no tools ──────────────────────────────
    if (this.mode === 'simple') {
      return `\
You are sudoai, a friendly personal AI assistant in the terminal.
${envBlock}

RESPONSE FORMAT — output EXACTLY ONE JSON object:
{"thought":"brief reasoning","action":"none","answer":"your response to the user"}

Rules:
- Always use action "none" — you are a conversational assistant with no tools
- Be helpful, clear, and concise
- For code, include it in the answer field wrapped in triple backticks`;
    }

    // ── Agent / Research: tool-enabled ────────────────────────────────────────
    const toolNames = this.registry.getToolNames();
    const toolCatalog = this.registry.getToolCatalog();
    const researchExtra = this.mode === 'research'
      ? `\n[Research Mode active: Search deeply, synthesize, and cite sources]`
      : '';

    // Small Model Optimized Prompt Profile
    return `\
System: sudoai agent
${envBlock}${researchExtra}

Task: You are an agent. Solve the user's request. Output ONLY valid JSON. No markdown fences. No explanations.

FORMAT:
Tool call:
{"thought":"reason","action":"EXACT_TOOL_NAME","input":{"key":"val"}}

Final answer:
{"thought":"reason","action":"none","answer":"your final text"}

AVAILABLE TOOLS:
${toolCatalog}

RULES:
- Output ONE JSON object per response.
- action must be "none" or a tool name from the list.
- Never output raw text outside the JSON.`;
  }


  // ── Build LLM messages from internal turn log ────────────────────────────

  private buildMessages(turns: TurnItem[]): LLMMessage[] {
    const messages: LLMMessage[] = [
      { role: 'system', content: this.buildSystemPrompt(turns) }
    ];

    for (const t of turns) {
      if (t.role === 'user') {
        messages.push({ role: 'user', content: t.content, images: t.images });
      } else if (t.role === 'assistant_final') {
        // Clean final answers go into context as assistant messages
        messages.push({ role: 'assistant', content: t.content });
      } else if (t.role === 'tool_result') {
        // Tool results come in as user observations
        let content = t.content;
        if (content.length > MAX_TOOL_OUTPUT) {
          content = content.slice(0, MAX_TOOL_OUTPUT) + '\n... [truncated]';
        }
        messages.push({
          role: 'user',
          content: `[Tool result from ${t.toolName}]:\n${content}\n\nRespond with your next JSON action.`
        });
      } else if (t.role === 'system_notice') {
        messages.push({ role: 'user', content: `[Notice]: ${t.content}` });
      }
      // tool_call turns are intentionally NOT fed back — prevents JSON blob poisoning
    }

    return messages;
  }

  // ── LLM call with format enforcement ─────────────────────────────────────

  private async callWithRetry(
    turns: TurnItem[],
    onUpdate: (msg: string) => void
  ): Promise<{ step: AgentStep | null; raw: string }> {
    const baseMessages = this.buildMessages(turns);
    const conversation = [...baseMessages];

    for (let attempt = 0; attempt < MAX_FORMAT_RETRIES; attempt++) {
      let raw: string;
      try {
        const resp = await this.provider.generate(conversation);
        raw = resp.content.trim();
      } catch (e: any) {
        throw new Error(`LLM error: ${e.message}`);
      }

      const step = extractAgentStep(raw);
      if (step) return { step, raw };

      // Format failed — identify why
      const hint = detectWrongFormat(raw)
        ?? 'Your response is not valid JSON. Output ONLY a JSON object like: {"thought":"...","action":"none","answer":"..."} or {"thought":"...","action":"TOOL_NAME","input":{...}}';

      if (attempt < MAX_FORMAT_RETRIES - 1) {
        onUpdate(`⚠ Format error, retrying (${attempt + 1}/${MAX_FORMAT_RETRIES - 1})...`);
        conversation.push({ role: 'assistant', content: raw });
        conversation.push({
          role: 'user',
          content: `${hint}\n\nTry again. Output ONLY the JSON object.`
        });
      } else {
        return { step: null, raw };
      }
    }

    return { step: null, raw: '' };
  }

  // ── Main run loop ─────────────────────────────────────────────────────────

  async run(userInput: string, images: string[] | undefined, onUpdate: (chunk: string) => void): Promise<string> {
    if (userInput || (images && images.length > 0)) {
      this.history.addMessage({ role: 'user', content: userInput, images });
    }

    const allHistory = this.history.getMessages();
    const recentHistory = allHistory.slice(-6);

    // For simple mode, just do a direct LLM call
    if (this.mode === 'simple') {
       return await this.runSimple(recentHistory, onUpdate);
    }

    // For Agent/Research modes, try task decomposition first
    onUpdate('🧠 Analyzing task complexity...');
    const { Planner } = await import('./planner.js');
    const { Executor } = await import('./executor.js');
    
    const planner = new Planner(this.provider);
    const executor = new Executor(this.provider, this.registry);
    const toolCatalog = this.registry.getToolCatalog();
    
    const contextStr = recentHistory.map(m => `${m.role}: ${m.content}`).join('\n');
    
    // Create Plan
    const plan = await planner.createPlan(userInput, toolCatalog);
    
    if (!plan || !plan.steps || plan.steps.length === 0) {
      // Fallback if planning fails
      onUpdate('⚠ Planning skipped, executing directly...');
      return await this.runLegacy(recentHistory, onUpdate);
    }

    // Execute Plan
    let currentContext = contextStr;
    let finalOutput = '';

    for (const step of plan.steps) {
      const result = await executor.executeStep(step.description, currentContext, onUpdate);
      if (result.success) {
        currentContext += `\n[Completed Step: ${step.description}]: ${result.output}`;
        finalOutput = result.output;
      } else {
        onUpdate(`❌ Failed step: ${step.description}`);
        currentContext += `\n[Failed Step: ${step.description}]: ${result.output}`;
      }
    }

    // Synthesis Step
    onUpdate('⚙ Synthesizing final answer...');
    const synthesisPrompt = `You are sudoai. Summarize the final result of the following context for the user.\n\nContext:\n${currentContext}\n\nUser asked: ${userInput}\n\nOutput only a JSON object: {"thought":"...","action":"none","answer":"..."}`;
    
    try {
      const resp = await this.provider.generate(
        [{ role: 'user', content: synthesisPrompt }],
        { temperature: 0.3, format: 'json' }
      );
      const synthStep = extractAgentStep(resp.content.trim());
      const ans = synthStep?.answer ?? finalOutput ?? 'Task completed.';
      this.history.addMessage({ role: 'assistant', content: ans });
      onUpdate(ans);
      return ans;
    } catch {
      const fallback = finalOutput || 'Task completed.';
      this.history.addMessage({ role: 'assistant', content: fallback });
      onUpdate(fallback);
      return fallback;
    }
  }

  // ── Simple conversation mode ──────────────────────────────────────────────
  private async runSimple(recentHistory: any[], onUpdate: (chunk: string) => void): Promise<string> {
    const turns: TurnItem[] = [];
    for (const m of recentHistory) {
      if (m.role === 'user') turns.push({ role: 'user', content: m.content, images: m.images });
      else if (m.role === 'assistant') turns.push({ role: 'assistant_final', content: m.content });
    }
    
    const { step, raw } = await this.callWithRetry(turns, onUpdate);
    const ans = step?.answer ?? (stripThinkTags(raw) || 'I could not process that.');
    this.history.addMessage({ role: 'assistant', content: ans });
    onUpdate(ans);
    return ans;
  }

  // ── Legacy monolithic loop (fallback) ───────────────────────────────────
  private async runLegacy(recentHistory: any[], onUpdate: (chunk: string) => void): Promise<string> {
    const turns: TurnItem[] = [];

    for (const m of recentHistory) {
      if (m.role === 'user') turns.push({ role: 'user', content: m.content, images: m.images });
      else if (m.role === 'assistant') turns.push({ role: 'assistant_final', content: m.content });
    }

    let currentStep = 0;
    const calledKeys = new Set<string>();

    while (currentStep < this.maxSteps) {
      let step: AgentStep | null;
      let raw: string;

      try {
        ({ step, raw } = await this.callWithRetry(turns, onUpdate));
      } catch (e: any) {
        const err = `❌ ${e.message}`;
        this.history.addMessage({ role: 'assistant', content: err });
        onUpdate(err);
        return err;
      }

      if (!step) {
        const clean = stripThinkTags(raw);
        const answer = clean.length > 0
          ? clean
          : 'I could not formulate a response. Please try again.';
        this.history.addMessage({ role: 'assistant', content: answer });
        onUpdate(answer);
        return answer;
      }

      const { thought, action, input, answer } = step;

      if (!action || action === 'none') {
        const finalAnswer = answer ?? thought ?? 'Done.';
        this.history.addMessage({ role: 'assistant', content: finalAnswer, thought });
        onUpdate(finalAnswer);
        return finalAnswer;
      }

      if (action === 'ask_user') {
        const q = input?.question ?? thought ?? 'Could you clarify?';
        this.history.addMessage({ role: 'assistant', content: q });
        onUpdate(q);
        return q;
      }

      const tool = this.registry.findTool(action);
      if (!tool) {
        onUpdate(`⚙ Unknown tool "${action}", retrying...`);
        turns.push({
          role: 'system_notice',
          content: `"${action}" is not a valid tool. Valid tool names:\n${this.registry.getToolNames().join('\n')}\n\nUse action "none" if you don't need a tool.`
        });
        currentStep++;
        continue;
      }

      const callKey = `${tool.name}::${JSON.stringify(input ?? {})}`;
      if (calledKeys.has(callKey)) {
        turns.push({
          role: 'system_notice',
          content: `You already called "${tool.name}" with these args. Use the result in context to give your final answer with action "none".`
        });
        currentStep++;
        continue;
      }
      calledKeys.add(callKey);

      onUpdate(`⚙ ${thought ? thought + ' — ' : ''}Calling ${tool.name}...`);

      turns.push({ role: 'tool_call', content: JSON.stringify({ action: tool.name, input }), toolName: tool.name });

      const coercedInput = input
        ? Object.fromEntries(Object.entries(input).map(([k, v]) => [
            k, v === 'true' ? true : v === 'false' ? false : v
          ]))
        : {};

      try {
        const result = await tool.execute(coercedInput);
        const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

        this.history.addMessage({
          role: 'tool',
          content: resultStr,
          tool_calls: { name: tool.name, input: coercedInput },
          tool_results: result
        });

        turns.push({ role: 'tool_result', content: resultStr, toolName: tool.name });

        const rObj = typeof result === 'object' && result !== null ? result as any : null;
        if ((rObj?.results && rObj.results.length === 0) || rObj?.error) {
          const reason = rObj?.error ? `Error: ${rObj.error}` : 'No results returned.';
          turns.push({
            role: 'system_notice',
            content: `${reason} Do NOT retry. Use action "none" and answer from your own knowledge, noting this limitation.`
          });
        }

      } catch (e: any) {
        turns.push({
          role: 'system_notice',
          content: `Tool "${tool.name}" threw: ${e.message}. Try a different tool or use action "none".`
        });
      }

      currentStep++;
    }

    onUpdate('⚙ Synthesizing final answer...');
    turns.push({
      role: 'system_notice',
      content: 'You have reached the maximum number of steps. Give your final answer NOW using {"thought":"...","action":"none","answer":"..."}'
    });

    try {
      const { step: finalStep, raw: finalRaw } = await this.callWithRetry(turns, onUpdate);
      const ans = finalStep?.answer
        ?? (stripThinkTags(finalRaw) || '⚠ Step limit reached. Please ask me to summarize.');
      this.history.addMessage({ role: 'assistant', content: ans });
      onUpdate(ans);
      return ans;
    } catch {
      const fallback = '⚠ Step limit reached. Please ask me to summarize.';
      this.history.addMessage({ role: 'assistant', content: fallback });
      onUpdate(fallback);
      return fallback;
    }
  }
}
