import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import { MainController } from './ui/MainController.js';
import { ConfigManager } from './utils/config.js';
import { OllamaProvider } from './llm/ollama.js';
import { ToolRegistry } from './tools/registry.js';
import { shellExecTool } from './tools/shell.js';
import { readFileTool } from './tools/fs.js';
import { HistoryManager } from './memory/history.js';
import { AgentEngine } from './engine/index.js';

const program = new Command();
const configManager = new ConfigManager();

program
  .name('sudoai')
  .description('Terminal-native AI assistant')
  .version('1.0.0');

program
  .argument('[query]', 'A single question to ask')
  .option('-i, --img <path>', 'Path or link to an image')
  .action(async (query, options) => {
    const config = configManager.get();

    if (query) {
      // 1-off mode
      if (!config.setupComplete) {
        console.error('Please run sudoai without arguments first to complete setup.');
        process.exit(1);
      }
      const provider = new OllamaProvider(config.model);
      const registry = new ToolRegistry();
      registry.register(shellExecTool);
      registry.register(readFileTool);

      const history = new HistoryManager();
      const engine = new AgentEngine({ provider, registry, history });

      console.log(`Asking (${config.model}): ${query}`);
      await engine.run(query, (update: string) => {
        process.stdout.write(update + '\n');
      });
      process.exit(0);
    } else {
      // Interactive mode
      render(React.createElement(MainController, { configManager }));
    }
  });

program.parse();
