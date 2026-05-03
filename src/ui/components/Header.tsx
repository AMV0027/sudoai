import React from 'react';
import { Box, Text } from 'ink';
import figlet from 'figlet';

interface HeaderProps {
  status?: 'ready' | 'thinking' | 'error';
  modelName?: string;
}

export const Header: React.FC<HeaderProps> = ({ status = 'ready', modelName }) => {
  const title = figlet.textSync('sudoai', { font: 'Slant' });

  const getStatusColor = () => {
    switch (status) {
      case 'thinking': return 'yellow';
      case 'error': return 'red';
      default: return 'green';
    }
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="cyan">{title}</Text>
      <Box paddingX={1} marginTop={-1}>
        <Text color={getStatusColor()}>● </Text>
        <Text bold>{status.toUpperCase()}</Text>
        {modelName && (
          <Text dimColor> | Model: {modelName}</Text>
        )}
      </Box>
      <Box borderStyle="single" borderTop={false} borderLeft={false} borderRight={false} borderColor="dim" />
    </Box>
  );
};
