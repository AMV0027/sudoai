import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { OllamaProvider } from '../llm/ollama.js';
import { AgentMode } from '../utils/config.js';

interface SetupWizardProps {
  onComplete: (model: string, ollamaApiKey: string, thinkingEnabled: boolean, mode: AgentMode) => void;
  initialThinking?: boolean;
  initialMode?: AgentMode;
}

const MODES: { value: AgentMode; label: string; desc: string; color: string }[] = [
  {
    value: 'simple',
    label: 'Simple',
    desc: 'Conversational chat — fast, no tools. Best for general questions.',
    color: 'green',
  },
  {
    value: 'agent',
    label: 'Agent',
    desc: 'Tools + MCP enabled — can search, read files, run shell commands.',
    color: 'cyan',
  },
  {
    value: 'research',
    label: 'Research',
    desc: 'Deep multi-step research — more tool calls, structured answers.',
    color: 'magenta',
  },
];

export const SetupWizard: React.FC<SetupWizardProps> = ({
  onComplete,
  initialThinking = false,
  initialMode = 'simple',
}) => {
  const [step, setStep] = useState<'checking' | 'selecting' | 'mode' | 'thinking' | 'apiKey'>('checking');
  const [models, setModels] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [modeIndex, setModeIndex] = useState(MODES.findIndex(m => m.value === initialMode) || 0);
  const [thinkingEnabled, setThinkingEnabled] = useState(initialThinking);
  const [apiKey, setApiKey] = useState('');
  const [ollamaUser, setOllamaUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkOllama = async () => {
      const provider = new OllamaProvider();
      try {
        const availableModels = await provider.listModels();
        if (availableModels.length === 0) {
          setError('No models found in Ollama. Please make sure Ollama is running and you have pulled at least one model (e.g., llama3).');
          return;
        }
        setModels(availableModels);

        try {
          const { stdout } = await import('zx').then(zx => zx.$`ollama signin`.nothrow());
          const match = stdout.match(/signed in as user '([^']+)'/);
          if (match && match[1]) {
            setOllamaUser(match[1]);
          }
        } catch (_) {}

        setStep('selecting');
      } catch (e: any) {
        setError(`Failed to connect to Ollama: ${e.message}. Please make sure Ollama is running.`);
      }
    };
    checkOllama();
  }, []);

  useInput((input, key) => {
    if (step === 'selecting') {
      if (key.upArrow) setSelectedIndex(p => (p > 0 ? p - 1 : models.length - 1));
      else if (key.downArrow) setSelectedIndex(p => (p < models.length - 1 ? p + 1 : 0));
      else if (key.return) setStep('mode');
    }

    if (step === 'mode') {
      if (key.upArrow) setModeIndex(p => (p > 0 ? p - 1 : MODES.length - 1));
      else if (key.downArrow) setModeIndex(p => (p < MODES.length - 1 ? p + 1 : 0));
      else if (key.return) setStep('thinking');
      else if (key.escape) setStep('selecting');
    }

    if (step === 'thinking') {
      if (input === 't' || input === 'T') setThinkingEnabled(p => !p);
      else if (key.return) setStep('apiKey');
      else if (key.escape) setStep('mode');
    }
  });

  const selectedMode = MODES[modeIndex];

  if (error) {
    return (
      <Box flexDirection="column" padding={1} borderStyle="single" borderColor="red">
        <Text color="red" bold>● SETUP ERROR</Text>
        <Text>{error}</Text>
        <Box marginTop={1}>
          <Text dimColor>Press Ctrl+C to exit and fix the issue.</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1} borderStyle="single" borderColor="cyan">
      <Text bold color="cyan">● SUDOAI SETUP</Text>

      {/* Step indicator */}
      <Box marginTop={1}>
        {(['selecting', 'mode', 'thinking', 'apiKey'] as const).map((s, i) => {
          const labels = ['Model', 'Mode', 'Thinking', 'API Key'];
          const done = ['selecting', 'mode', 'thinking', 'apiKey'].indexOf(step) > i;
          const current = step === s;
          return (
            <React.Fragment key={s}>
              <Text color={done ? 'green' : current ? 'cyan' : 'gray'}>
                {done ? '✓ ' : current ? '▶ ' : '○ '}{labels[i]}
              </Text>
              {i < 3 && <Text dimColor>  →  </Text>}
            </React.Fragment>
          );
        })}
      </Box>

      {/* Step 1 — Checking */}
      {step === 'checking' && (
        <Box marginTop={1}>
          <Text color="yellow"><Spinner type="dots" /> Checking Ollama...</Text>
        </Box>
      )}

      {/* Step 2 — Model selection */}
      {step === 'selecting' && (
        <Box flexDirection="column" marginTop={1}>
          <Text>Select a model:</Text>
          <Box flexDirection="column" marginTop={1}>
            {models.map((model, index) => (
              <Box key={model}>
                <Text color={index === selectedIndex ? 'cyan' : 'white'}>
                  {index === selectedIndex ? '❯ ' : '  '}{model}
                </Text>
              </Box>
            ))}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>↑↓ navigate · Enter select</Text>
          </Box>
        </Box>
      )}

      {/* Step 3 — Mode selection */}
      {step === 'mode' && (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text>Model: </Text>
            <Text color="cyan" bold>{models[selectedIndex]}</Text>
          </Box>
          <Box marginTop={1}>
            <Text bold>Select a mode:</Text>
          </Box>
          <Box flexDirection="column" marginTop={1}>
            {MODES.map((m, i) => (
              <Box key={m.value} flexDirection="column" marginBottom={1}>
                <Box>
                  <Text color={i === modeIndex ? m.color : 'white'} bold={i === modeIndex}>
                    {i === modeIndex ? '❯ ' : '  '}
                  </Text>
                  <Text color={i === modeIndex ? m.color : 'white'} bold={i === modeIndex}>
                    [{m.label.toUpperCase()}]
                  </Text>
                </Box>
                {i === modeIndex && (
                  <Box marginLeft={4}>
                    <Text dimColor>{m.desc}</Text>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>↑↓ navigate · Enter select · Esc back</Text>
          </Box>
        </Box>
      )}

      {/* Step 4 — Thinking toggle */}
      {step === 'thinking' && (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text>Model: </Text><Text color="cyan" bold>{models[selectedIndex]}</Text>
            <Text>  Mode: </Text><Text color={selectedMode.color} bold>[{selectedMode.label.toUpperCase()}]</Text>
          </Box>

          <Box marginTop={1} flexDirection="column">
            <Text bold>Enable Thinking Mode?</Text>
            <Text dimColor>Step-by-step reasoning before answering (requires qwq, deepseek-r1 etc.)</Text>
          </Box>

          <Box marginTop={1} borderStyle="round" borderColor={thinkingEnabled ? 'magenta' : 'gray'} paddingX={2}>
            <Text color={thinkingEnabled ? 'magenta' : 'gray'} bold>
              {thinkingEnabled ? '◉  THINKING ON ' : '○  THINKING OFF'}
            </Text>
          </Box>

          <Box marginTop={1}>
            <Text dimColor>T toggle · Enter confirm · Esc back</Text>
          </Box>
        </Box>
      )}

      {/* Step 5 — API Key */}
      {step === 'apiKey' && (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text>Model: </Text><Text color="cyan" bold>{models[selectedIndex]}</Text>
            <Text>  Mode: </Text><Text color={selectedMode.color} bold>[{selectedMode.label.toUpperCase()}]</Text>
            <Text>  Thinking: </Text><Text color={thinkingEnabled ? 'magenta' : 'gray'} bold>{thinkingEnabled ? 'ON' : 'OFF'}</Text>
          </Box>

          <Box marginTop={1}>
            <Text>Ollama API Key </Text><Text dimColor>(optional — leave blank to skip):</Text>
          </Box>

          {ollamaUser && (
            <Box marginTop={1}>
              <Text>Signed in as: </Text><Text color="green" bold>{ollamaUser}</Text>
            </Box>
          )}

          <Box marginTop={1} borderStyle="round" borderColor="yellow" paddingX={1}>
            <TextInput
              value={apiKey}
              onChange={setApiKey}
              onSubmit={() => onComplete(models[selectedIndex], apiKey, thinkingEnabled, selectedMode.value)}
              placeholder="ollama_... (or press Enter to skip)"
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Enter to finish setup</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
