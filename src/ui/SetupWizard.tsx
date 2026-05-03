import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { OllamaProvider } from '../llm/ollama.js';
import { ConfigManager } from '../utils/config.js';

interface SetupWizardProps {
  onComplete: (model: string) => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState<'checking' | 'selecting' | 'confirming'>('checking');
  const [models, setModels] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkOllama = async () => {
      const provider = new OllamaProvider();
      const availableModels = await provider.listModels();
      if (availableModels.length === 0) {
        setError('No models found in Ollama. Please make sure Ollama is running and you have pulled at least one model (e.g., llama3).');
      } else {
        setModels(availableModels);
        setStep('selecting');
      }
    };
    checkOllama();
  }, []);

  useInput((input, key) => {
    if (step === 'selecting') {
      if (key.upArrow) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : models.length - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => (prev < models.length - 1 ? prev + 1 : 0));
      } else if (key.return) {
        onComplete(models[selectedIndex]);
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
    </Box>
  );
};
