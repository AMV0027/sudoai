<p align="center">
  <img src="https://raw.githubusercontent.com/AMV0027/sudoai/main/image/sudoai_logo.png" alt="sudoai logo" />
</p>

<h1 align="center">sudoai</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/sudoai-cli"><img src="https://img.shields.io/npm/v/sudoai-cli?color=brightgreen&label=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/sudoai-cli"><img src="https://img.shields.io/npm/dm/sudoai-cli?color=blue&label=downloads" alt="npm downloads" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/sudoai-cli?color=339933&label=node" alt="node version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/sudoai-cli?color=orange" alt="license" /></a>
  <img src="https://img.shields.io/badge/status-stable-brightgreen" alt="status stable" />
</p>

<p align="center">
  <strong>A local-first AI runtime for developers, built as a terminal-native operating layer.</strong>
</p>

---

## 📖 About sudoai

`sudoai` is a cross-platform, terminal-native AI assistant designed to be a daily driver for developers. It runs entirely locally using **Ollama** for inference, giving you a conversational CLI with full agentic capabilities—file access, shell execution, web search, and persistent memory—without sending your data to the cloud.

### The "Operating Layer" Philosophy
Unlike standard chatbots, `sudoai` operates as a true **operating layer**. It doesn't just answer questions; it interacts with your environment. Using a sophisticated **ReAct (Reason + Act)** orchestration engine, it:
1.  **Analyzes** your request.
2.  **Plans** a sequence of tool calls.
3.  **Executes** actions (shell commands, file reads, web scrapes).
4.  **Reflects** on the results to either refine the plan or provide a final answer.

---

## 🛠️ Installation

Install `sudoai-cli` globally via npm:

```bash
npm install -g sudoai-cli
```

### Prerequisites
- **Node.js:** v18 or higher.
- **Ollama:** Must be installed and running ([ollama.com](https://ollama.com/)).

---

## 🚀 Quickstart

1.  **Pull a recommended model:**
    ```bash
    ollama pull gemma4:e2b
    ```
2.  **Launch the interactive CLI:**
    ```bash
    sudoai
    ```
3.  **Try an agentic task:**
    > "Find the latest version of React and create a package.json for a new project."

---

## ⌨️ Commands Available

While in the interactive session, use these slash-commands for configuration:

| Command    | Description                                                                          |
| ---------- | ------------------------------------------------------------------------------------ |
| `/mode`    | Toggle between `simple` (standard chat), `agent` (tools enabled), and `research`. |
| `/model`   | List available local models and select your active provider.                         |
| `/mcp`     | View status of connected Model Context Protocol servers.                              |
| `/history` | Search and view conversation logs from the local SQLite database.                    |
| `/bye`     | Gracefully exit the session.                                                         |

---

## ✨ Features

- 🗨️ **Conversational CLI** — Ultra-fast streaming UI built with Ink/React.
- 🚦 **Dynamic Modes** — Optimized prompts for standard chat or complex tool-use orchestration.
- 🤖 **ReAct Orchestration** — High-fidelity agentic loop that avoids hallucination loops.
- 🧰 **Native Toolbelt**:
    - **Shell:** Run any CLI command safely through a managed environment.
    - **FS:** Read, write, and list files across your entire project.
    - **Web:** Deep search and content extraction via DuckDuckGo and Cheerio.
- 🧠 **Smart Memory** — Automatically persists conversation history and tool outputs to SQLite.
- 🔌 **MCP First** — Native support for MCP servers. Add your custom tools in `%APPDATA%/sudoai/mcp.json`.
- 📁 **Contextual `@` Syntax** — Attach files or directories as context by simply typing `@` followed by the filename.
- 🖼️ **Multimodal Vision** — Pass images to the LLM using `--img <path>` for analysis or coding help.
- 📜 **Virtual Scroll UI** — Optimized rendering that handles thousands of lines without performance degradation.

---

## 🤝 Contribution

Contributions are welcome! Whether it's adding new tools, improving the UI, or optimizing the agent loop:
1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

---

## 🏗️ Tech Stack

| Layer             | Technology                                                               |
| ----------------- | ------------------------------------------------------------------------ |
| **Terminal UI**   | [Ink](https://github.com/vadimdemedes/ink) + [React](https://react.dev/) |
| **Logic**         | TypeScript / Node.js                                                     |
| **Inference**     | [Ollama](https://ollama.com/)                                            |
| **Scripting**     | [zx](https://github.com/google/zx)                                       |
| **Database**      | [SQLite](https://github.com/WiseLibs/better-sqlite3)                     |
| **State**         | [Zustand](https://zustand-demo.pmnd.rs/)                                 |
| **Connectivity**  | [@modelcontextprotocol/sdk](https://modelcontextprotocol.io/)            |

---

## 🔄 Recent Updates

### v1.0.2 — The Stability Update
- **Refactored Input Logic:** Major fixes to the `@` context selector to prevent state desync during rapid typing.
- **Scroll Buffering:** Implemented a new line-height-aware virtual scroll system for jitter-free rendering.
- **Improved Tool Mapping:** Enhanced the mapping between user intent and MCP tool selection.
- **Windows Path Fixes:** Standardized configuration storage in `%APPDATA%` for Windows users.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/AMV0027">AMV0027</a>
</p>
