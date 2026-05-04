import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import fs from 'fs';
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
  
  // Autocomplete state
  const [autocompleteVisible, setAutocompleteVisible] = useState(false);
  const [autocompleteOptions, setAutocompleteOptions] = useState<string[]>([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  
  const { exit } = useApp();
  const { stdout } = useStdout();

  const termWidth = stdout?.columns || 80;
  const termHeight = stdout?.rows || 24;

  // Reserve lines for: header (~5) + status bar (~2 when loading) + input box (~3) + autocomplete (~6)
  const RESERVED = 15;
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
    const imgCount = msg.images?.length ? 1 : 0; // count images as taking up a line for placeholder
    return estimateLines(msg.content, termWidth) + (thought ? 1 : 0) + imgCount;
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
        const { cleanInput, context, images } = await parseInputContext(nextQuery);
        const enrichedInput = context 
          ? `${cleanInput}\n\n${context}`
          : cleanInput;

        await engine.run(enrichedInput, images, (update: string) => {
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

  // ── Input change handler for Autocomplete ────────────────────────────────
  const handleInputChange = (newInput: string) => {
    setInput(newInput);
    
    // Check if we are currently typing a mention at the end of the input
    const match = newInput.match(/@([^\s]*)$/);
    if (match) {
      const prefix = match[1];
      
      try {
        const cwd = process.cwd();
        const files = fs.readdirSync(cwd);
        // Filter out hidden files unless explicitly typing a dot, and match prefix
        const filtered = files.filter(f => {
           if (!prefix && f.startsWith('.')) return false;
           return f.toLowerCase().startsWith(prefix.toLowerCase());
        }).slice(0, 5); // Limit to top 5 results for neat UI

        if (filtered.length > 0) {
          setAutocompleteOptions(filtered);
          setAutocompleteVisible(true);
          setAutocompleteIndex(0);
        } else {
          setAutocompleteVisible(false);
          setAutocompleteOptions([]);
        }
      } catch {
        setAutocompleteVisible(false);
        setAutocompleteOptions([]);
      }
    } else {
      setAutocompleteVisible(false);
      setAutocompleteOptions([]);
    }
  };

  // ── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (autocompleteVisible && autocompleteOptions.length > 0) {
      // If we press enter during autocomplete, we assume they want to complete the mention instead of submitting the message.
      const selected = autocompleteOptions[autocompleteIndex];
      if (selected) {
        const updatedInput = input.replace(/@([^\s]*)$/, `@${selected} `);
        setInput(updatedInput);
      }
      setAutocompleteVisible(false);
      setAutocompleteOptions([]);
      return;
    }

    if (!input.trim()) return;

    if (input.startsWith('/')) {
      const cmd = input.trim().toLowerCase();
      onCommand?.(cmd);
      setInput('');
      setAutocompleteVisible(false);
      setAutocompleteOptions([]);
      return;
    }

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg } as Message]);
    setQueue(prev => [...prev, userMsg]);
  }, [input, onCommand, autocompleteVisible, autocompleteOptions, autocompleteIndex]);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  const inputRef = React.useRef(input);
  inputRef.current = input;

  const autocompleteStateRef = React.useRef({ visible: autocompleteVisible, options: autocompleteOptions, index: autocompleteIndex });
  autocompleteStateRef.current = { visible: autocompleteVisible, options: autocompleteOptions, index: autocompleteIndex };

  useInput((_input: string, key: any) => {
    if (key.escape || (key.ctrl && _input === 'c')) exit();

    if (autocompleteStateRef.current.visible) {
      if (key.upArrow) {
        setAutocompleteIndex(prev => (prev > 0 ? prev - 1 : autocompleteStateRef.current.options.length - 1));
        return;
      }
      if (key.downArrow) {
        setAutocompleteIndex(prev => (prev < autocompleteStateRef.current.options.length - 1 ? prev + 1 : 0));
        return;
      }
      if (key.tab || (key.rightArrow)) {
        // Complete the mention
        const selected = autocompleteStateRef.current.options[autocompleteStateRef.current.index];
        if (selected) {
          const updatedInput = inputRef.current.replace(/@([^\s]*)$/, `@${selected} `);
          setInput(updatedInput);
        }
        setAutocompleteVisible(false);
        setAutocompleteOptions([]);
        return;
      }
    }

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
          const hasImages = msg.images && msg.images.length > 0;

          return (
            <Box key={i} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color={isUser ? 'green' : 'cyan'} bold>
                  {isUser ? '❯ ' : '● '}
                </Text>
                <Text wrap="wrap">{msg.content}</Text>
                {hasImages && (
                  <Text dimColor> [+{msg.images?.length} image(s)]</Text>
                )}
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
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            placeholder={`[${mode}] Type your message... (@ to mention files)`}
          />
        </Box>
        
        {/* Autocomplete Menu */}
        {autocompleteVisible && autocompleteOptions.length > 0 && (
          <Box flexDirection="column" paddingX={2} marginTop={0}>
            {autocompleteOptions.map((opt, i) => (
              <Box key={opt}>
                <Text color={i === autocompleteIndex ? 'magenta' : undefined} bold={i === autocompleteIndex}>
                  {i === autocompleteIndex ? '▶ ' : '  '}
                  {opt}
                </Text>
              </Box>
            ))}
          </Box>
        )}

        <Box marginTop={0} paddingX={1}>
          <Text dimColor>
            PageUp/Down scroll  ·  /model  /mode  /mcp  /history  /bye
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
