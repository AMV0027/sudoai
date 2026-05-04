import fs from 'fs';
import path from 'path';
import { getDataDir } from './paths.js';

export type AgentMode = 'simple' | 'agent' | 'research';

export interface AppConfig {
  model: string;
  mcpEnabled: boolean;
  setupComplete: boolean;
  ollamaApiKey?: string;
  thinkingEnabled: boolean;
  mode: AgentMode;
}

const DEFAULT_CONFIG: AppConfig = {
  model: '',
  mcpEnabled: false,
  setupComplete: false,
  ollamaApiKey: '',
  thinkingEnabled: false,
  mode: 'simple',
};

export class ConfigManager {
  private static instance: ConfigManager;
  private configPath: string;
  private config: AppConfig;

  private constructor() {
    const dataDir = getDataDir();
    this.configPath = path.join(dataDir, 'config.json');
    this.config = this.load();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private load(): AppConfig {
    if (fs.existsSync(this.configPath)) {
      try {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      } catch (e) {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  }

  save(config: Partial<AppConfig>) {
    try {
      this.config = { ...this.config, ...config };
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (e: any) {
      console.error('Failed to save config:', e.message);
    }
  }

  get(): AppConfig {
    return this.config;
  }

  isSetup(): boolean {
    return this.config.setupComplete;
  }
}
