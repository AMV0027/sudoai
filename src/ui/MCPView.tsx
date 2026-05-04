import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { MCPManager, MCPConfig } from '../utils/mcp.js';
import { MCPConnectionResult } from '../tools/mcp_client.js';
import { getDataDir } from '../utils/paths.js';
import path from 'path';

interface MCPViewProps {
  onBack: () => void;
  connectionResults?: MCPConnectionResult[];
}

export const MCPView: React.FC<MCPViewProps> = ({ onBack, connectionResults = [] }) => {
  const [config, setConfig] = useState<MCPConfig>({ mcpServers: {} });
  const [manager] = useState(new MCPManager());
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setConfig(manager.getCombinedConfig());
  }, []);

  const servers = Object.entries(config.mcpServers);
  const sudoaiConfigPath = path.join(getDataDir(), 'mcp.json');

  // Build a lookup from server name → connection result
  const resultByName = new Map<string, MCPConnectionResult>(
    connectionResults.map(r => [r.name, r])
  );

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : servers.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev < servers.length - 1 ? prev + 1 : 0));
    } else if (key.escape || input === 'b' || input === 'B') {
      onBack();
    }
  });

  const totalTools = connectionResults.reduce((sum, r) => sum + r.toolCount, 0);
  const failedServers = connectionResults.filter(r => r.error).length;
  const connectedServers = connectionResults.filter(r => !r.error).length;

  return (
    <Box flexDirection="column" padding={1} borderStyle="single" borderColor="yellow">
      <Text bold color="yellow">● MCP SERVERS</Text>

      {/* Config paths */}
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text dimColor>Claude: </Text>
          <Text dimColor wrap="wrap">{manager.getClaudeConfigPath() || 'not found'}</Text>
        </Box>
        <Box>
          <Text dimColor>SudoAI: </Text>
          <Text color="yellow" wrap="wrap">{sudoaiConfigPath}</Text>
        </Box>
      </Box>

      {/* Summary bar */}
      {connectionResults.length > 0 && (
        <Box marginTop={1}>
          <Text color="green">{connectedServers} connected</Text>
          {failedServers > 0 && (
            <>
              <Text dimColor>  ·  </Text>
              <Text color="red">{failedServers} failed</Text>
            </>
          )}
          <Text dimColor>  ·  {totalTools} tools registered</Text>
        </Box>
      )}

      {/* Server list */}
      {servers.length === 0 ? (
        <Box marginTop={1}>
          <Text dimColor>No MCP servers configured.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {servers.map(([name, cfg], index) => {
            const result = resultByName.get(name);
            const isSelected = index === selectedIndex;

            // Status indicator
            let statusIcon = '○'; // not yet connected (still loading)
            let statusColor: string = 'gray';
            if (result) {
              if (result.error) {
                statusIcon = '✗';
                statusColor = 'red';
              } else {
                statusIcon = '✓';
                statusColor = 'green';
              }
            }

            return (
              <Box key={name} flexDirection="column" marginBottom={1}>
                <Box>
                  <Text color={isSelected ? 'cyan' : 'white'}>
                    {isSelected ? '❯ ' : '  '}
                  </Text>
                  <Text color={statusColor as any}>{statusIcon} </Text>
                  <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                    {name.toUpperCase()}
                  </Text>
                  <Text dimColor> — {cfg.command} {cfg.args?.join(' ')}</Text>
                </Box>

                {/* Tool list for connected server */}
                {result && !result.error && result.tools.length > 0 && isSelected && (
                  <Box flexDirection="column" marginLeft={4}>
                    {result.tools.map(toolName => (
                      <Text key={toolName} dimColor color="green">
                        ⚡ {toolName}
                      </Text>
                    ))}
                  </Box>
                )}

                {/* Error message */}
                {result?.error && isSelected && (
                  <Box marginLeft={4} flexDirection="column">
                    <Text color="red">Error: {result.error}</Text>
                    <Text dimColor>Check that the command is installed and the server is accessible.</Text>
                  </Box>
                )}

                {/* Tool count badge (not selected) */}
                {result && !result.error && !isSelected && (
                  <Box marginLeft={4}>
                    <Text dimColor>{result.toolCount} tool{result.toolCount !== 1 ? 's' : ''}</Text>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>↑↓: Navigate  ·  ESC/B: Back</Text>
        <Text dimColor>Edit: <Text color="yellow">{sudoaiConfigPath}</Text></Text>
      </Box>
    </Box>
  );
};
