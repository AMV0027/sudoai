import path from 'path';
import os from 'os';
import fs from 'fs';

/**
 * Returns the global application data directory for SudoAI.
 * Windows: %APPDATA%\sudoai
 * macOS: ~/Library/Application Support/sudoai
 * Linux: ~/.sudoai
 */
export function getDataDir(): string {
  const home = os.homedir();
  let dataDir: string;

  switch (os.platform()) {
    case 'win32':
      dataDir = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'sudoai');
      break;
    case 'darwin':
      dataDir = path.join(home, 'Library', 'Application Support', 'sudoai');
      break;
    default:
      dataDir = path.join(home, '.sudoai');
      break;
  }

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  return dataDir;
}
