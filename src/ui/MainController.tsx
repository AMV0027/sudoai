import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from 'ink';
import { App } from './App.js';
import { SetupWizard } from './SetupWizard.js';
import { HistoryView } from './HistoryView.js';
import { MCPView } from './MCPView.js';
import { ModeSelector } from './ModeSelector.js';
import { ConfigManager, AgentMode } from '../utils/config.js';
import { AgentEngine } from '../engine/index.js';
import { OllamaProvider } from '../llm/ollama.js';
import { ToolRegistry } from '../tools/registry.js';
import { shellExecTool } from '../tools/shell.js';
import { readFileTool, writeFileTool, listFilesTool, searchFilesTool, fileStatsTool } from '../tools/fs.js';
import { webSearchTool, fetchUrlTool } from '../tools/web.js';
import { askUserTool } from '../tools/interactive.js';
import { MCPManager } from '../utils/mcp.js';
import { MCPClientManager, MCPConnectionResult } from '../tools/mcp_client.js';
import { HistoryManager } from '../memory/history.js';

interface MainControllerProps {
  configManager: ConfigManager;
}

export const MainController: React.FC<MainControllerProps> = ({ configManager }) => {
  const [view, setView] = useState<'setup' | 'chat' | 'history' | 'mcp' | 'mode-select'>(
    configManager.get().setupComplete ? 'chat' : 'setup'
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [mcpResults, setMcpResults] = useState<MCPConnectionResult[]>([]);
  const [mcpReady, setMcpReady] = useState(false);

  // Keep a reactive copy of the config so mode changes re-render correctly
  const [config, setConfig] = useState(() => configManager.get());

  const { exit } = useApp();

  // Full tool registry — built once, MCP tools added into it as they connect
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
      const mcpConfig = mcpManager.getCombinedConfig();
      const results: MCPConnectionResult[] = [];
      for (const [name, cfg] of Object.entries(mcpConfig.mcpServers)) {
        const result = await mcpClient.connectAndRegister(name, cfg, registry);
        results.push(result);
      }
      setMcpResults(results);
      setMcpReady(true);
    };
    initMCP();
    return () => { mcpClient.disconnectAll(); };
  }, []);

  // Stable engine — only recreated when model/mode/session changes, NOT on every render
  const engine = useMemo(() => {
    const mode = config.mode ?? 'simple';
    const activeRegistry = mode === 'simple' ? new ToolRegistry() : registry;
    const provider = new OllamaProvider({ model: config.model, thinking: config.thinkingEnabled });
    const history = new HistoryManager(activeSessionId || undefined);
    return new AgentEngine({ provider, registry: activeRegistry, history, mode });
  }, [config.model, config.thinkingEnabled, config.mode, activeSessionId]);

  const handleSetupComplete = (
    model: string,
    ollamaApiKey: string,
    thinkingEnabled: boolean,
    mode: AgentMode
  ) => {
    configManager.save({ model, ollamaApiKey, thinkingEnabled, mode, setupComplete: true });
    const updated = configManager.get();
    setConfig(updated);
    setView('chat');
  };

  const handleCommand = (command: string) => {
    const cmd = command.trim().toLowerCase();
    if (cmd === '/model') {
      setView('setup');
    } else if (cmd === '/bye') {
      exit();
    } else if (cmd === '/mcp') {
      setView('mcp');
    } else if (cmd === '/history') {
      setView('history');
    } else if (cmd === '/mode') {
      setView('mode-select');
    } else if (cmd.startsWith('/mode ')) {
      // Quick inline mode switch: /mode simple|agent|research
      const newMode = cmd.slice(6).trim() as AgentMode;
      if (['simple', 'agent', 'research'].includes(newMode)) {
        configManager.save({ mode: newMode });
        const updated = configManager.get();
        setConfig(updated);
        
        engine.getHistory().addMessage({
          role: 'system',
          content: `Mode switched to ${newMode.toUpperCase()}.`
        });
      } else {
        engine.getHistory().addMessage({
          role: 'system',
          content: `Invalid mode: ${newMode}. Available: simple, agent, research.`
        });
      }
    }
  };

  const handleSessionSelect = (sessionId: string) => {
    setActiveSessionId(sessionId || null);
    setView('chat');
  };

  // ── Views ─────────────────────────────────────────────────────────────────

  if (view === 'setup') {
    return (
      <SetupWizard
        onComplete={handleSetupComplete}
        initialThinking={config.thinkingEnabled}
        initialMode={config.mode}
      />
    );
  }

  if (view === 'history') {
    return <HistoryView onSelect={handleSessionSelect} onBack={() => setView('chat')} />;
  }

  if (view === 'mcp') {
    return <MCPView onBack={() => setView('chat')} connectionResults={mcpResults} />;
  }

  if (view === 'mode-select') {
    return (
      <ModeSelector
        currentMode={config.mode ?? 'simple'}
        onSelect={(newMode) => {
          configManager.save({ mode: newMode });
          setConfig(configManager.get());
          engine.getHistory().addMessage({
            role: 'system',
            content: `Mode switched to ${newMode.toUpperCase()}.`
          });
          setView('chat');
        }}
        onCancel={() => setView('chat')}
      />
    );
  }

  // ── Chat view ─────────────────────────────────────────────────────────────

  const mode = config.mode ?? 'simple';
  const totalMcpTools = mcpResults.reduce((sum, r) => sum + r.toolCount, 0);
  const mcpErrors = mcpResults.filter(r => r.error).length;
  const mcpStatusText = mode === 'simple'
    ? undefined
    : !mcpReady
      ? 'MCP: loading...'
      : mcpErrors > 0
        ? `MCP: ${totalMcpTools} tools (${mcpErrors} failed)`
        : `MCP: ${totalMcpTools} tools`;

  return (
    <App
      engine={engine}
      onCommand={handleCommand}
      mcpStatus={mcpStatusText}
      mode={mode}
    />
  );
};
