import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { OllamaProvider } from '../llm/ollama.js';

interface SetupWizardProps {
  onComplete: (model: string, ollamaApiKey: string) => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState<'checking' | 'selecting' | 'apiKey' | 'confirming'>('checking');
  const [models, setModels] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [ollamaUser, setOllamaUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkOllama = async () => {
      const provider = new OllamaProvider();
      try {
        // Check models
        const availableModels = await provider.listModels();
        if (availableModels.length === 0) {
          setError('No models found in Ollama. Please make sure Ollama is running and you have pulled at least one model (e.g., llama3).');
          return;
        }
        setModels(availableModels);

        // Try to auto-detect signed-in user
        try {
          const { stdout } = await import('zx').then(zx => zx.$`ollama signin`.nothrow());
          const match = stdout.match(/signed in as user '([^']+)'/);
          if (match && match[1]) {
            setOllamaUser(match[1]);
          }
        } catch (e) {
          // Ignore error for signin check
        }

        setStep('selecting');
      } catch (e: any) {
        setError(`Failed to connect to Ollama: ${e.message}. Please make sure Ollama is running.`);
      }
    };
    checkOllama();
  }, []);

  const handleModelSelect = () => {
    setStep('apiKey');
  };

  const handleApiKeySubmit = () => {
    onComplete(models[selectedIndex], apiKey);
  };

  useInput((input, key) => {
    if (step === 'selecting') {
      if (key.upArrow) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : models.length - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => (prev < models.length - 1 ? prev + 1 : 0));
      } else if (key.return) {
        handleModelSelect();
      }
    }
  });

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
      <Text bold color="cyan">● INITIAL SETUP</Text>
      
      {step === 'checking' && (
        <Box marginTop={1}>
          <Text color="yellow">
            <Spinner type="dots" /> Checking Ollama models...
          </Text>
        </Box>
      )}

      {step === 'selecting' && (
        <Box flexDirection="column" marginTop={1}>
          <Text>Select a default model to use with sudoai:</Text>
          <Box flexDirection="column" marginTop={1}>
            {models.map((model, index) => (
              <Box key={model}>
                <Text color={index === selectedIndex ? 'blue' : 'white'}>
                  {index === selectedIndex ? '❯ ' : '  '}
                  {model}
                </Text>
              </Box>
            ))}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Use ↑↓ arrows to navigate, Enter to select.</Text>
          </Box>
        </Box>
      )}

      {step === 'apiKey' && (
        <Box flexDirection="column" marginTop={1}>
          <Text>Enter your Ollama API Key:</Text>
          {ollamaUser ? (
            <Box marginTop={1}>
              <Text>Signed in as: </Text>
              <Text color="green" bold>{ollamaUser}</Text>
            </Box>
          ) : (
            <Box marginTop={1}>
              <Text dimColor>Not signed in to Ollama CLI. You can still use a manual key.</Text>
            </Box>
          )}
          
          <Box marginTop={1}>
            <Text>Get your key here: </Text>
            <Text color="blue" underline>https://ollama.com/settings/keys</Text>
          </Box>

          <Box marginTop={1} borderStyle="round" borderColor="yellow" paddingX={1}>
            <TextInput
              value={apiKey}
              onChange={setApiKey}
              onSubmit={handleApiKeySubmit}
              placeholder="ollama_..."
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to complete setup.</Text>
            <Text dimColor italic>(You can leave this blank if you don't need web search yet)</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
