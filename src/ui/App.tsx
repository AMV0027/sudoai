import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { AgentEngine } from '../engine/index.js';
import { Header } from './components/Header.js';
import { Message } from '../memory/history.js';
import { AgentMode } from '../utils/config.js';
import { parseInputContext } from '../utils/input.js';

interface AppProps {
  engine: AgentEngine;
  onCommand?: (command: string) => void;
  mcpStatus?: string;
  mode?: AgentMode;
}

// ── Estimate rendered line count for a single message ──────────────────────
// This is intentionally approximate — accuracy ±1 line is fine.
function estimateLines(content: string, termWidth: number): number {
  const cols = Math.max(termWidth - 6, 40); // account for prefix + padding
  const lines = content.split('\n');
  let total = 0;
  for (const line of lines) {
    total += Math.max(1, Math.ceil(line.length / cols));
  }
  return total + 1; // +1 for the prefix row (❯ / ●)
}

// ── Filter messages for display ────────────────────────────────────────────
function isDisplayable(msg: Message): boolean {
  if (msg.role === 'system') return false;
  if (msg.role === 'tool') return true; // shown as ⚡ indicator
  if (msg.role === 'assistant') {
    const c = msg.content.trim();
    // Strip JSON action blobs that leaked (safety net)
    if (c.startsWith('{') && /"action"/.test(c) && !/"answer"/.test(c)) return false;
  }
  return true;
}

// ── Mode badge colors ──────────────────────────────────────────────────────
const MODE_COLOR: Record<AgentMode, string> = {
  simple: 'green',
  agent: 'cyan',
  research: 'magenta',
};

export const App: React.FC<AppProps> = ({ engine, onCommand, mcpStatus, mode = 'simple' }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [currentStatus, setCurrentStatus] = useState('');
  const [scrollLine, setScrollLine] = useState(0); // offset in rendered lines
  const { exit } = useApp();
  const { stdout } = useStdout();

  const termWidth = stdout?.columns || 80;
  const termHeight = stdout?.rows || 24;

  // Reserve lines for: header (~5) + status bar (~2 when loading) + input box (~3)
  const RESERVED = 10;
  const viewportLines = Math.max(4, termHeight - RESERVED);

  // Initial sync from persisted history
  useEffect(() => {
    setMessages(engine.getHistory().getMessages());
  }, []);

  // ── Build a flat list of {msg, lines} for the viewport window ─────────────
  const displayable = messages.filter(isDisplayable);

  // Calculate cumulative line heights
  const lineCounts = displayable.map(msg => {
    if (msg.role === 'tool') return 1;
    const thought = (msg as any).thought as string | undefined;
    return estimateLines(msg.content, termWidth) + (thought ? 1 : 0);
  });
  const totalLines = lineCounts.reduce((a, b) => a + b, 0);

  // Clamp scroll so we can't scroll past the bottom
  const maxScroll = Math.max(0, totalLines - viewportLines);
  const clampedScroll = Math.min(scrollLine, maxScroll);

  // Pick which messages are visible given the scroll offset
  const visibleMsgs: { msg: Message; lines: number }[] = [];
  let accumulated = 0;
  let skipped = 0;
  for (let i = 0; i < displayable.length; i++) {
    const h = lineCounts[i];
    if (accumulated + h <= clampedScroll) {
      accumulated += h;
      skipped += h;
      continue;
    }
    if (accumulated - skipped >= viewportLines) break;
    visibleMsgs.push({ msg: displayable[i], lines: h });
    accumulated += h;
  }

  const canScrollUp = clampedScroll > 0;
  const canScrollDown = clampedScroll < maxScroll;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    setScrollLine(maxScroll);
  }, [messages.length, maxScroll]);

  // ── Queue Processor ──────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || queue.length === 0) return;

    const processQueue = async () => {
      const nextQuery = queue[0];
      setQueue(prev => prev.slice(1));
      setLoading(true);

      try {
        const { cleanInput, context } = await parseInputContext(nextQuery);
        const enrichedInput = context 
          ? `${cleanInput}\n\n${context}`
          : cleanInput;

        await engine.run(enrichedInput, (update: string) => {
          setCurrentStatus(update);
        });
        setMessages(engine.getHistory().getMessages());
        setCurrentStatus('');
      } catch (e: any) {
        setMessages(prev => [...prev, { role: 'system', content: `Error: ${e.message}` } as any]);
      } finally {
        setLoading(false);
      }
    };

    processQueue();
  }, [queue, loading, engine]);

  // ── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!input.trim()) return;

    if (input.startsWith('/')) {
      const cmd = input.trim().toLowerCase();
      onCommand?.(cmd);
      setInput('');
      return;
    }

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg } as Message]);
    setQueue(prev => [...prev, userMsg]);
  }, [input, onCommand]);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useInput((_input: string, key: any) => {
    if (key.escape || (key.ctrl && _input === 'c')) exit();

    // Scroll: PageUp / PageDown (5 lines), Ctrl+Up / Ctrl+Down (1 line)
    const SCROLL_BIG = Math.max(1, Math.floor(viewportLines / 2));
    if (key.pageUp)   setScrollLine(p => Math.max(0, p - SCROLL_BIG));
    if (key.pageDown) setScrollLine(p => Math.min(maxScroll, p + SCROLL_BIG));
    if (key.upArrow && key.ctrl)   setScrollLine(p => Math.max(0, p - 1));
    if (key.downArrow && key.ctrl) setScrollLine(p => Math.min(maxScroll, p + 1));
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  const modeColor = MODE_COLOR[mode];

  return (
    <Box flexDirection="column" paddingX={1}>
      <Header status={loading ? 'thinking' : 'ready'} mcpStatus={mcpStatus} mode={mode} />

      {/* Scroll-up hint */}
      {canScrollUp && (
        <Box justifyContent="center">
          <Text dimColor>↑  PageUp to scroll  ↑</Text>
        </Box>
      )}

      {/* Message viewport */}
      <Box flexDirection="column">
        {visibleMsgs.map(({ msg }, i) => {
          // Tool use indicator
          if (msg.role === 'tool') {
            const toolName = (msg as any).tool_calls?.name || 'tool';
            return (
              <Box key={i} marginBottom={0}>
                <Text color="yellow" dimColor>  ⚡ {toolName}</Text>
              </Box>
            );
          }

          const thought = (msg as any).thought as string | undefined;
          const isUser = msg.role === 'user';

          return (
            <Box key={i} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color={isUser ? 'green' : 'cyan'} bold>
                  {isUser ? '❯ ' : '● '}
                </Text>
                <Text wrap="wrap">{msg.content}</Text>
              </Box>
              {thought && (
                <Box marginLeft={2}>
                  <Text dimColor>[{thought}]</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Scroll-down hint */}
      {canScrollDown && (
        <Box justifyContent="center">
          <Text dimColor>↓  PageDown to scroll  ↓</Text>
        </Box>
      )}

      {/* Status / Input */}
      <Box flexDirection="column" marginTop={1}>
        {(loading || queue.length > 0) && (
          <Box marginBottom={1} paddingX={1} flexDirection="column">
            {loading && (
              <Text color="yellow">
                <Spinner type="dots" />{' '}{currentStatus || 'Processing...'}
              </Text>
            )}
            {queue.length > 0 && (
              <Text dimColor>
                {queue.length} message{queue.length > 1 ? 's' : ''} in queue
              </Text>
            )}
          </Box>
        )}

        <Box borderStyle="single" borderColor={modeColor} paddingX={1}>
          <Text color={modeColor} bold>❯ </Text>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder={`[${mode}] Type your message...`}
          />
        </Box>

        <Box marginTop={0} paddingX={1}>
          <Text dimColor>
            PageUp/Down scroll  ·  /model  /mode  /mcp  /history  /bye
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
