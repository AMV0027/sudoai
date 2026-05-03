\# 🧠 sudoai Project Description



A cross-platform, terminal-native AI assistant that runs locally using Ollama, designed to function as a daily driver for developers and technical users.



The application provides a conversational interface similar to ChatGPT or Gemini, but operates directly inside the terminal with support for agentic workflows, tool execution, and persistent memory powered by SQLite.



It is built as an extensible system where capabilities can be expanded through npm-based plugins, enabling a modular ecosystem of AI-powered tools.



the cli cmd is eg:
1. for the char terminal interface
sudoai

2. for 1 question response
sudoai "hello"

3. for the image question
sudoai "hello" --img "<path or link>"



\---



\# 🎯 Project End Goal



To create a \*\*reliable, local-first AI terminal environment\*\* that replaces fragmented workflows (search, scripting, file navigation, automation) with a single intelligent interface.



Long-term vision:



\* A \*\*developer-grade AI operating layer\*\*

\* A \*\*plugin-driven ecosystem (“npm for AI tools”)\*\*

\* A \*\*hybrid intelligence system\*\* (local + optional cloud reasoning)

\* A \*\*persistent personal AI\*\* that evolves with user context



\---



\# 🚀 Project Features



\## 🗨️ Conversational CLI Interface



\* Natural language interaction inside terminal

\* Streaming responses

\* Multi-turn context awareness



\---



\## 🤖 Agentic Execution Engine



\* ReAct-style reasoning loop

\* Multi-step task handling

\* Tool invocation and result integration



\---



\## 🧰 Tool System (MCP-style)



\* Built-in tools:



&#x20; \* Web search

&#x20; \* File system access

&#x20; \* Command execution

\* Extensible via npm plugins



\---



\## 🧠 Persistent Memory



\* Session + long-term memory storage

\* Context-aware recall

\* Lightweight semantic retrieval

\* Powered by SQLite



\---



\## 🔌 Plugin Ecosystem



\* Install tools via npm

\* Dynamic tool loading

\* Developer SDK for custom integrations



\---



\## ⚡ Hybrid Model Support



\* Local inference via Ollama

\* Optional fallback to cloud APIs (e.g., OpenAI API)



\---



\## 📁 File \& Workspace Awareness



\* Read and analyze local files

\* Directory-level context understanding

\* Code and document summarization



\---



\## 🖥️ Cross-Platform CLI UX



\* Works on Windows, macOS, Linux

\* Interactive terminal UI

\* Interruptible execution (Ctrl+C)



\---



\# 🔄 Project Data Flow



Here’s the core execution pipeline:



```txt

User Input

&#x20;  ↓

Session Context Loader

&#x20;  ↓

Memory Retrieval (SQLite)

&#x20;  ↓

Prompt Construction

&#x20;  ↓

LLM (Ollama)

&#x20;  ↓

Structured Output (Thought / Action / Input)

&#x20;  ↓

Tool Execution (if required)

&#x20;  ↓

Result Injection into Context

&#x20;  ↓

Agent Loop (repeat if needed)

&#x20;  ↓

Final Response

&#x20;  ↓

Memory Storage (SQLite)

```



\---



\### 🔁 Agent Loop Breakdown



1\. User submits a query

2\. System enriches prompt with:



&#x20;  \* recent conversation

&#x20;  \* relevant memory

3\. Model generates structured response:



&#x20;  \* reasoning ("thought")

&#x20;  \* action ("tool" or "none")

4\. If tool is called:



&#x20;  \* execute tool

&#x20;  \* append result to context

&#x20;  \* re-run model

5\. Loop ends when:



&#x20;  \* final answer is produced

&#x20;  \* or max steps reached



\---



\# 🧱 Project Tech Stack



\## ⚙️ Core Runtime



\* Node.js (LTS)

\* TypeScript



\---



\## 🖥️ CLI Interface



\* `ink` (React-based CLI rendering)



\---



\## 🧠 AI Layer



\* Ollama

\* Optional: OpenAI API / Gemini API



\---



\## 🤖 Agent Engine



\* Custom ReAct loop (no heavy frameworks)

\* JSON-structured reasoning



\---



\## 🧰 Tool System



\* TypeScript interfaces

\* `zod` for schema validation



\---



\## 🧠 Memory \& Storage



\* SQLite

\* `better-sqlite3` for performance



\---



\## 🔍 Search \& Retrieval



\* DuckDuckGo (web search)

\* Node.js filesystem APIs



\---



\## ⚡ Execution Layer



\* `zx` (shell command execution)



\---



\## 🔌 Plugin System



\* npm-based modular architecture

\* dynamic tool loading



\---



\# 🧠 Positioning (Important)



This is not:



\* just a chatbot

\* just a CLI tool



This is:



> \*\*A local-first AI runtime for developers, built as a terminal-native operating layer\*\*

