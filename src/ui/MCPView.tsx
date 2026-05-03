import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { MCPManager, MCPConfig } from '../utils/mcp.js';

interface MCPViewProps {
  onBack: () => void;
}

export const MCPView: React.FC<MCPViewProps> = ({ onBack }) => {
  const [config, setConfig] = useState<MCPConfig>({ mcpServers: {} });
  const [manager] = useState(new MCPManager());
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setConfig(manager.getCombinedConfig());
  }, []);

  const servers = Object.entries(config.mcpServers);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : servers.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev < servers.length - 1 ? prev + 1 : 0));
    } else if (key.escape || input === 'b') {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" padding={1} borderStyle="single" borderColor="yellow">
      <Text bold color="yellow">● MCP CONFIGURATION</Text>
      
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>Claude Config: {manager.getClaudeConfigPath() || 'Not found'}</Text>
        <Text dimColor>SudoAI Config: .sudoai/mcp.json</Text>
      </Box>

      {servers.length === 0 ? (
        <Box marginTop={1}>
          <Text>No MCP servers configured.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {servers.map(([name, cfg], index) => (
            <Box key={name} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color={index === selectedIndex ? 'cyan' : 'white'}>
                  {index === selectedIndex ? '❯ ' : '  '}
                  {name.toUpperCase()}
                </Text>
                <Text dimColor> - {cfg.command} {cfg.args?.join(' ')}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>ESC/B: Back | Add custom servers in .sudoai/mcp.json</Text>
      </Box>
    </Box>
  );
};
