<p align="center">
  <img src="./images/audoai_logo.png" width="120" alt="sudoai logo" />
</p>

<h1 align="center">sudoai</h1>

<p align="center">
  <strong>A local-first AI runtime for developers, built as a terminal-native operating layer.</strong>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-usage">Usage</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-license">License</a>
</p>

---

## 🧠 What is sudoai?

`sudoai` is a cross-platform, terminal-native AI assistant designed to function as a daily driver for developers. Unlike standard chatbots, `sudoai` operates directly in your terminal, providing a conversational interface with support for agentic workflows, tool execution, and persistent memory.

## 🚀 Features

- 🗨️ **Conversational CLI**: Natural language interaction with streaming responses and multi-turn context awareness.
- 🤖 **Agentic Execution Engine**: A custom ReAct-style reasoning loop that handles multi-step tasks autonomously.
- 🧰 **Extensible Tool System**: Built-in support for web search, file system access, and command execution (via `zx`).
- 🧠 **Persistent Memory**: Session and long-term memory storage powered by SQLite, enabling context-aware recall.
- 🔌 **Plugin Ecosystem**: Modular architecture allowing you to install and load tools via npm.
- ⚡ **Hybrid Model Support**: Local inference via [Ollama](https://ollama.com/) with optional fallbacks to cloud APIs.
- 📁 **Workspace Awareness**: Analyze local files and directories with deep context understanding.

## 🛠️ Installation

### Prerequisites

1.  **Node.js**: LTS version (v18+ recommended).
2.  **Ollama**: Install from [ollama.com](https://ollama.com/) and ensure it's running locally.

### Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/sudoai.git
cd sudoai
npm install
npm run build
```

Alternatively, link the package globally to use the `sudoai` command anywhere:

```bash
npm link
```

## 📖 Usage

### 1. Interactive Mode

Launch the full conversational terminal interface:

```bash
sudoai
```

### 2. Single Question

Get a quick response to a single query:

```bash
sudoai "How do I list all files in the current directory recursively?"
```

### 3. Image Analysis

Analyze an image with a question:

```bash
sudoai "What is in this image?" --img "./path/to/image.png"
```

## 🏗️ Tech Stack

- **CLI Interface**: [Ink](https://github.com/vadimdemedes/ink) (React-based CLI rendering)
- **Runtime**: Node.js & TypeScript
- **Agent Engine**: Custom ReAct loop with JSON-structured reasoning
- **Memory**: [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- **Validation**: [Zod](https://zod.dev/)
- **Execution**: [zx](https://github.com/google/zx)

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to get started.

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ for the terminal.
</p>
