import fs from 'fs';
import path from 'path';

export interface AppConfig {
  model: string;
  mcpEnabled: boolean;
  setupComplete: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  model: '',
  mcpEnabled: false,
  setupComplete: false,
};

export class ConfigManager {
  private configPath: string;
  private config: AppConfig;

  constructor() {
    const dataDir = path.join(process.cwd(), '.sudoai');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.configPath = path.join(dataDir, 'config.json');
    this.config = this.load();
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
    this.config = { ...this.config, ...config };
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  get(): AppConfig {
    return this.config;
  }

  isSetup(): boolean {
    return this.config.setupComplete;
  }
}
