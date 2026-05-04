import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { AgentMode } from '../utils/config.js';

interface ModeSelectorProps {
  currentMode: AgentMode;
  onSelect: (mode: AgentMode) => void;
  onCancel: () => void;
}

const MODES: { value: AgentMode; label: string; desc: string; color: string }[] = [
  {
    value: 'simple',
    label: 'Simple',
    desc: 'Conversational chat — fast, no tools. Best for general questions.',
    color: 'green',
  },
  {
    value: 'agent',
    label: 'Agent',
    desc: 'Tools + MCP enabled — can search, read files, run shell commands.',
    color: 'cyan',
  },
  {
    value: 'research',
    label: 'Research',
    desc: 'Deep multi-step research — more tool calls, structured answers.',
    color: 'magenta',
  },
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({ currentMode, onSelect, onCancel }) => {
  const [selectedIndex, setSelectedIndex] = useState(
    MODES.findIndex(m => m.value === currentMode) || 0
  );

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex(p => (p > 0 ? p - 1 : MODES.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex(p => (p < MODES.length - 1 ? p + 1 : 0));
    } else if (key.return) {
      onSelect(MODES[selectedIndex].value);
    } else if (key.escape || _input === 'b' || _input === 'B') {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" padding={1} borderStyle="single" borderColor="cyan" width={60}>
      <Text bold color="cyan">● SELECT AGENT MODE</Text>
      
      <Box flexDirection="column" marginTop={1}>
        {MODES.map((m, i) => (
          <Box key={m.value} flexDirection="column" marginBottom={1}>
            <Box>
              <Text color={i === selectedIndex ? m.color : 'white'} bold={i === selectedIndex}>
                {i === selectedIndex ? '❯ ' : '  '}
              </Text>
              <Text color={i === selectedIndex ? m.color : 'white'} bold={i === selectedIndex}>
                [{m.label.toUpperCase()}]
              </Text>
              {m.value === currentMode && (
                <Text dimColor> (current)</Text>
              )}
            </Box>
            {i === selectedIndex && (
              <Box marginLeft={4}>
                <Text dimColor italic>{m.desc}</Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>

      <Box marginTop={1} borderStyle="classic" borderColor="gray" paddingX={1}>
        <Text dimColor>↑↓ navigate  ·  Enter select  ·  Esc back</Text>
      </Box>
    </Box>
  );
};
