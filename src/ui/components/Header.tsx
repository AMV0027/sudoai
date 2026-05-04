import React from 'react';
import { Box, Text } from 'ink';
import figlet from 'figlet';
import { AgentMode } from '../../utils/config.js';

interface HeaderProps {
  status?: 'ready' | 'thinking' | 'error';
  modelName?: string;
  mcpStatus?: string;
  mode?: AgentMode;
}

const MODE_LABELS: Record<AgentMode, { label: string; color: string }> = {
  simple:   { label: 'SIMPLE',   color: 'green' },
  agent:    { label: 'AGENT',    color: 'cyan' },
  research: { label: 'RESEARCH', color: 'magenta' },
};

export const Header: React.FC<HeaderProps> = ({ status = 'ready', modelName, mcpStatus, mode }) => {
  const title = figlet.textSync('sudoai', { font: 'Slant' });

  const statusColor = status === 'thinking' ? 'yellow' : status === 'error' ? 'red' : 'green';
  const modeInfo = mode ? MODE_LABELS[mode] : null;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="cyan">{title}</Text>
      <Box paddingX={1} marginTop={-1}>
        <Text color={statusColor}>● </Text>
        <Text bold>{status.toUpperCase()}</Text>
        {modeInfo && (
          <>
            <Text dimColor>  │  </Text>
            <Text color={modeInfo.color as any} bold>[{modeInfo.label}]</Text>
          </>
        )}
        {modelName && (
          <Text dimColor>  │  {modelName}</Text>
        )}
        {mcpStatus && (
          <Text dimColor>  │  {mcpStatus}</Text>
        )}
      </Box>
      <Box borderStyle="single" borderTop={false} borderLeft={false} borderRight={false} borderColor="gray" />
    </Box>
  );
};
