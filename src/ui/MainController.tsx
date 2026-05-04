import React, { useState, useEffect } from 'react';
import { useApp } from 'ink';
import { App } from './App.js';
import { SetupWizard } from './SetupWizard.js';
import { HistoryView } from './HistoryView.js';
import { MCPView } from './MCPView.js';
import { ConfigManager } from '../utils/config.js';
import { AgentEngine } from '../engine/index.js';
import { OllamaProvider } from '../llm/ollama.js';
import { ToolRegistry } from '../tools/registry.js';
import { shellExecTool } from '../tools/shell.js';
import { readFileTool, writeFileTool, listFilesTool, searchFilesTool, fileStatsTool } from '../tools/fs.js';
import { webSearchTool, fetchUrlTool } from '../tools/web.js';
import { askUserTool } from '../tools/interactive.js';
import { MCPManager } from '../utils/mcp.js';
import { MCPClientManager } from '../tools/mcp_client.js';
import { HistoryManager } from '../memory/history.js';

interface MainControllerProps {
  configManager: ConfigManager;
}

export const MainController: React.FC<MainControllerProps> = ({ configManager }) => {
  const [view, setView] = useState<'setup' | 'chat' | 'history' | 'mcp'>(
    configManager.get().setupComplete ? 'chat' : 'setup'
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [mcpStatus, setMcpStatus] = useState<string>('Initializing MCP...');
  const { exit } = useApp();

  const [registry] = useState(() => {
    const r = new ToolRegistry();
    r.register(shellExecTool);
    r.register(readFileTool);
    r.register(writeFileTool);
    r.register(listFilesTool);
    r.register(searchFilesTool);
    r.register(fileStatsTool);
    r.register(webSearchTool);
    r.register(fetchUrlTool);
    r.register(askUserTool);
    return r;
  });

  const [mcpClient] = useState(new MCPClientManager());

  useEffect(() => {
    const initMCP = async () => {
      const mcpManager = new MCPManager();
      const config = mcpManager.getCombinedConfig();
      let toolCount = 0;
      for (const [name, cfg] of Object.entries(config.mcpServers)) {
        toolCount += await mcpClient.connectAndRegister(name, cfg, registry);
      }
      setMcpStatus(`MCP Ready (${toolCount} tools)`);
    };
    initMCP();

    return () => {
      mcpClient.disconnectAll();
    };
  }, []);

  const handleSetupComplete = (model: string, ollamaApiKey: string) => {
    configManager.save({ model, ollamaApiKey, setupComplete: true });
    setView('chat');
  };

  const handleCommand = (command: string) => {
    if (command === '/model') {
      setView('setup');
    } else if (command === '/bye') {
      exit();
    } else if (command === '/mcp') {
      setView('mcp');
    } else if (command === '/history') {
      setView('history');
    }
  };

  const handleSessionSelect = (sessionId: string) => {
    setActiveSessionId(sessionId || null);
    setView('chat');
  };

  if (view === 'setup') {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  if (view === 'history') {
    return <HistoryView onSelect={handleSessionSelect} onBack={() => setView('chat')} />;
  }

  if (view === 'mcp') {
    return <MCPView onBack={() => setView('chat')} />;
  }

  // Initialize engine for chat view
  const config = configManager.get();
  const provider = new OllamaProvider(config.model);
  const history = new HistoryManager(activeSessionId || undefined);
  const engine = new AgentEngine({ provider, registry, history });

  return <App engine={engine} onCommand={handleCommand} />;
};
