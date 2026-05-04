import fs from 'fs';
import path from 'path';
import os from 'os';
import { getDataDir } from './paths.js';

export interface MCPServerConfig {
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
      fs.writeFileSync(this.sudoaiConfigPath, JSON.stringify({ mcpServers: {} }, null, 2));
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
