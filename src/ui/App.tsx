import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { AgentEngine } from '../engine/index.js';
import { Header } from './components/Header.js';
import { Message } from '../memory/history.js';
import { useStdout } from 'ink';

interface AppProps {
  engine: AgentEngine;
  onCommand?: (command: string) => void;
}

export const App: React.FC<AppProps> = ({ engine, onCommand }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');
  const [scrollOffset, setScrollOffset] = useState(0);
  const { exit } = useApp();
  const { stdout } = useStdout();

  const terminalHeight = stdout?.rows || 24;
  const maxVisibleMessages = Math.max(5, terminalHeight - 15); // Adjust for header/input

  useEffect(() => {
    // Initial sync
    setMessages(engine.getHistory().getMessages());
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    if (messages.length > maxVisibleMessages) {
      setScrollOffset(messages.length - maxVisibleMessages);
    }
  }, [messages.length, maxVisibleMessages]);

  const handleSubmit = async () => {
    if (!input.trim()) return;

    if (input.startsWith('/')) {
      const command = input.trim().toLowerCase();
      if (onCommand) {
        onCommand(command);
      }
      setInput('');
      return;
    }

    const userMsg = input;
    setInput('');
    // Optimistic update
    setMessages((prev) => [...prev, { role: 'user', content: userMsg } as Message]);
    setLoading(true);

    try {
      await engine.run(userMsg, (update: string) => {
        setCurrentStatus(update);
      });
      // Sync messages from history
      setMessages(engine.getHistory().getMessages());
      setCurrentStatus('');
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: 'system', content: `Error: ${e.message}` } as any]);
    } finally {
      setLoading(false);
    }
  };

  useInput((input: string, key: any) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      exit();
    }
    // Manual scroll support
    if (key.pageUp) setScrollOffset(prev => Math.max(0, prev - 1));
    if (key.pageDown) setScrollOffset(prev => Math.min(messages.length - maxVisibleMessages, prev + 1));
  });

  const visibleMessages = messages.slice(scrollOffset, scrollOffset + maxVisibleMessages);

  return (
    <Box flexDirection="column" paddingX={1} height={terminalHeight} overflowY="hidden">
      <Header status={loading ? 'thinking' : 'ready'} />

      <Box flexDirection="column" flexGrow={1}>
        {scrollOffset > 0 && (
          <Box justifyContent="center">
            <Text dimColor>↑ More messages above (PageUp) ↑</Text>
          </Box>
        )}
        
        {visibleMessages.map((msg, index) => (
          <Box key={index} flexDirection="column" marginBottom={1}>
            <Box>
              <Text color={msg.role === 'user' ? 'green' : (msg.role === 'tool' ? 'yellow' : 'white')} bold>
                {msg.role === 'user' ? '❯ ' : (msg.role === 'tool' ? '● ' : '● ')}
              </Text>
              <Text>{msg.content}</Text>
            </Box>
            {msg.plan && (
              <Box marginLeft={2} marginTop={0}>
                <Text color="cyan" dimColor>[PLAN] {msg.plan}</Text>
              </Box>
            )}
            {msg.thought && (
              <Box marginLeft={2} marginTop={0}>
                <Text dimColor italic>[THOUGHT] {msg.thought}</Text>
              </Box>
            )}
          </Box>
        ))}

        {scrollOffset + maxVisibleMessages < messages.length && (
          <Box justifyContent="center">
            <Text dimColor>↓ More messages below (PageDown) ↓</Text>
          </Box>
        )}
      </Box>

      <Box flexDirection="column">
        {loading && (
          <Box marginBottom={1} borderStyle="single" borderColor="yellow" paddingX={1}>
            <Text color="yellow">
              <Spinner type="dots" /> {currentStatus || 'Processing...'}
            </Text>
          </Box>
        )}

        <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1}>
          <Text color="cyan" bold>❯ </Text>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder="Type your message..."
          />
        </Box>
      </Box>
    </Box>
  );
};
