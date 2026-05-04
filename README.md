<p align="center">
  <img src="https://raw.githubusercontent.com/AMV0027/sudoai/main/image/sudoai_logo.png" alt="sudoai logo" />
</p>

<h1 align="center">sudoai</h1>

<p align="center">
  <strong>A local-first AI runtime for developers, built as a terminal-native operating layer.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/sudoai-cli"><img src="https://img.shields.io/npm/v/sudoai-cli?color=brightgreen&label=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/sudoai-cli"><img src="https://img.shields.io/npm/dm/sudoai-cli?color=blue&label=downloads" alt="npm downloads" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/sudoai-cli?color=339933&label=node" alt="node version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/sudoai-cli?color=orange" alt="license" /></a>
  <img src="https://img.shields.io/badge/status-stable-brightgreen" alt="status stable" />
</p>

<p align="center">
  <a href="#-what-is-sudoai">What is sudoai?</a> •
  <a href="#-features">Features</a> •
  <a href="#-prerequisites">Prerequisites</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-usage">Usage</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-contributing">Contributing</a> •
  <a href="#-license">License</a>
</p>

---

## 🧠 What is sudoai?

`sudoai` is a cross-platform, terminal-native AI assistant designed to be a daily driver for developers. It runs entirely locally using [Ollama](https://ollama.com/) for inference, giving you a conversational CLI with full agentic capabilities — file access, shell execution, web search, and persistent memory — without sending your data to the cloud.

Unlike standard chatbots, `sudoai` operates as an **operating layer** directly in your terminal: a ReAct-style reasoning engine that plans, acts, and reflects to complete multi-step tasks autonomously.

## 🚀 Features

- 🗨️ **Conversational CLI** — Natural language interaction with streaming responses and multi-turn context awareness.
- 🚦 **Agent Modes** — Switch between `Simple`, `Agent`, and `Research` modes for tailored execution strategies.
- 🤖 **Agentic Execution Engine** — A custom ReAct-style reasoning loop that handles multi-step tasks autonomously.
- 🧰 **Extensible Tool System** — Built-in tools for web search, file system access, shell command execution, and URL fetching.
- 🧠 **Persistent Memory** — Session and long-term memory storage powered by SQLite for context-aware recall.
- 🔌 **MCP Support** — Connect to any [Model Context Protocol](https://modelcontextprotocol.io/) server to expand tool capabilities.
- ⚡ **Local-First** — Runs fully offline via [Ollama](https://ollama.com/) with no API keys required.
- 📁 **Context Awareness** — Attach local files or entire directories using `@path` for deep context understanding.
- 🖼️ **Vision Support** — Pass images directly to multimodal models for visual analysis.
- 📜 **Virtual Scroll** — High-performance terminal rendering with full history navigation.

## 📋 Prerequisites

Before installing `sudoai`, ensure you have the following:

1. **Node.js** v18 or later — [Download](https://nodejs.org/)
2. **Ollama** — [Install from ollama.com](https://ollama.com/) and make sure the daemon is running:
   ```bash
   ollama serve
   ```
3. **A model pulled in Ollama** — `sudoai` works best with instruction-tuned models:

   ```bash
   # Recommended (tool-calling capable)
   ollama pull gemma4:e2b

   # Alternatives
   ollama pull qwen3.5:latest
   ollama pull phi4-mini:latest
   ```

## 🛠️ Installation

Install globally from npm:

```bash
npm install -g sudoai-cli
```

Verify the installation:

```bash
sudoai --version
```

### Building from Source

```bash
git clone https://github.com/AMV0027/sudoai.git
cd sudoai
npm install
npm run build
npm link   # makes the `sudoai` command available globally
```

## 📖 Usage

### Interactive Mode

Launch the full conversational terminal interface:

```bash
sudoai
```

#### Interactive Commands

| Command    | Description                                      |
| ---------- | ------------------------------------------------ |
| `/mode`    | Switch between `simple`, `agent`, and `research` |
| `/model`   | Select a different Ollama model                  |
| `/mcp`     | Manage MCP server connections                    |
| `/history` | View session history                             |
| `/bye`     | Exit the application                             |

#### Navigation & Shortcuts

- `Enter`: Submit query
- `PageUp` / `PageDown`: Scroll through conversation history
- `Ctrl + Up` / `Ctrl + Down`: Scroll line-by-line
- `Ctrl + C` / `Esc`: Exit

### Context Referencing

You can attach local context to any query using the `@` symbol:

- `@file.ts`: Read and include the content of a specific file.
- `@src/`: Scan and include the directory structure of a folder.

**Example:**

> "Review the logic in @src/engine/index.ts and suggest improvements."

### Image Analysis

Pass an image to a multimodal model (e.g., `llava`, `qwen2.5vl`) for visual analysis:

```bash
sudoai "Describe this screenshot" --img "./screenshot.png"
```

### Agent Modes

`sudoai` now supports three distinct execution modes:

1. **Simple (Standard)**: Direct conversation with the LLM. Best for general questions and coding help.
2. **Agent (Reasoning)**: Uses a ReAct loop to plan and execute tools. Best for tasks requiring file access or shell execution.
3. **Research (Deep)**: Specialized mode for web-based information gathering and synthesis.

### CLI Flags

| Flag           | Description                               |
| -------------- | ----------------------------------------- |
| `--img <path>` | Attach an image for vision model analysis |
| `--version`    | Print the installed version               |
| `--help`       | Show help information                     |

## 🏗️ Tech Stack

| Layer             | Library                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| CLI Rendering     | [Ink](https://github.com/vadimdemedes/ink) + [React](https://react.dev/) |
| Runtime           | Node.js & TypeScript                                                     |
| LLM Inference     | [Ollama](https://github.com/ollama/ollama-js)                            |
| Agent Engine      | Custom ReAct loop with JSON-structured reasoning                         |
| Tool Execution    | [zx](https://github.com/google/zx)                                       |
| Web Search        | [Axios](https://axios-http.com/) + [Cheerio](https://cheerio.js.org/)    |
| Memory            | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)             |
| MCP Integration   | [@modelcontextprotocol/sdk](https://modelcontextprotocol.io/)            |
| Schema Validation | [Zod](https://zod.dev/)                                                  |
| CLI Parsing       | [Commander.js](https://github.com/tj/commander.js)                       |
| State Management  | [Zustand](https://zustand-demo.pmnd.rs/)                                 |

## 🆕 What's New in v1.0.2

- 🚦 **Dynamic Mode Switching**: Transition between Simple, Agent, and Research modes mid-conversation.
- 📁 **@Context System**: Seamlessly pull file contents and directory structures into your prompts.
- 📜 **Virtual Scroll UI**: Smooth navigation through long conversations with dedicated keyboard shortcuts.
- 📥 **Query Queuing**: Background processing for complex, multi-step agent tasks.
- ⚙️ **System Paths**: Better adherence to OS-specific data directories (AppData/Config).
- 🔍 **Optimized Search**: Faster web research results using custom scrapers.

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to get started, open issues, and submit pull requests.

## ⚖️ License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for details.

---

<p align="center">
  Built with ❤️ for the terminal &nbsp;|&nbsp; <a href="https://github.com/AMV0027/sudoai">GitHub</a> &nbsp;|&nbsp; <a href="https://www.npmjs.com/package/sudoai-cli">npm</a>
</p>
