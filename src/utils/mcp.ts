import fs from 'fs';
import path from 'path';
import os from 'os';
import { getDataDir } from './paths.js';

export interface MCPServerConfig {
  type?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

export class MCPManager {
  private sudoaiConfigPath: string;

  constructor() {
    const dataDir = getDataDir();
    this.sudoaiConfigPath = path.join(dataDir, 'mcp.json');
    this.ensureConfig();
  }

  private ensureConfig() {
    if (!fs.existsSync(this.sudoaiConfigPath)) {
      try {
        // Resolve project root based on import.meta.url
        // dist/utils/mcp.js -> root is ../../
        const currentFilePath = new URL(import.meta.url).pathname;
        // On Windows, new URL().pathname might start with a leading slash like /C:/..., we can strip it
        const normalizedPath = os.platform() === 'win32' && currentFilePath.startsWith('/') 
          ? currentFilePath.slice(1) 
          : currentFilePath;
          
        const defaultMcpPath = path.resolve(path.dirname(normalizedPath), '../../mcp.json');
        
        if (fs.existsSync(defaultMcpPath)) {
          fs.copyFileSync(defaultMcpPath, this.sudoaiConfigPath);
        } else {
          fs.writeFileSync(this.sudoaiConfigPath, JSON.stringify({ mcpServers: {} }, null, 2));
        }
      } catch (e) {
        // Fallback
        fs.writeFileSync(this.sudoaiConfigPath, JSON.stringify({ mcpServers: {} }, null, 2));
      }
    }
  }

  getClaudeConfigPath(): string | null {
    const home = os.homedir();
    switch (os.platform()) {
      case 'win32':
        return path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
      case 'darwin':
        return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      case 'linux':
        return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
      default:
        return null;
    }
  }

  getCombinedConfig(): MCPConfig {
    const sudoaiConfig: MCPConfig = JSON.parse(fs.readFileSync(this.sudoaiConfigPath, 'utf8'));
    
    const claudePath = this.getClaudeConfigPath();
    if (claudePath && fs.existsSync(claudePath)) {
      try {
        const claudeConfig: MCPConfig = JSON.parse(fs.readFileSync(claudePath, 'utf8'));
        return {
          mcpServers: {
            ...claudeConfig.mcpServers,
            ...sudoaiConfig.mcpServers,
          },
        };
      } catch (e) {
        console.error('Error reading Claude config:', e);
      }
    }

    return sudoaiConfig;
  }

  saveSudoaiConfig(config: MCPConfig) {
    fs.writeFileSync(this.sudoaiConfigPath, JSON.stringify(config, null, 2));
  }
}
