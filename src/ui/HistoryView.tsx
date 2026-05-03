import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { HistoryManager } from '../memory/history.js';

interface HistoryViewProps {
  onSelect: (sessionId: string) => void;
  onBack: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onSelect, onBack }) => {
  const [sessions, setSessions] = useState<{ id: string, created_at: string, last_message: string }[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const loadSessions = () => {
    setSessions(HistoryManager.listSessions());
  };

  useEffect(() => {
    loadSessions();
  }, []);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : sessions.length));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev < sessions.length ? prev + 1 : 0));
    } else if (key.return) {
      if (selectedIndex === 0) {
        onSelect(''); // Signal new chat
      } else if (sessions[selectedIndex - 1]) {
        onSelect(sessions[selectedIndex - 1].id);
      }
    } else if (key.delete || input === 'd') {
      if (selectedIndex > 0 && sessions[selectedIndex - 1]) {
        HistoryManager.deleteSession(sessions[selectedIndex - 1].id);
        loadSessions();
      }
    } else if (key.escape || input === 'b') {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" padding={1} borderStyle="single" borderColor="magenta">
      <Text bold color="magenta">● CHAT HISTORY</Text>
      
      <Box flexDirection="column" marginTop={1}>
        {/* New Chat Option */}
        <Box>
          <Text color={selectedIndex === 0 ? 'green' : 'white'} bold={selectedIndex === 0}>
            {selectedIndex === 0 ? '❯ ' : '  '}
            ● NEW CHAT
          </Text>
        </Box>

        {sessions.map((session, index) => {
          const listIndex = index + 1;
          return (
            <Box key={session.id}>
              <Text color={listIndex === selectedIndex ? 'blue' : 'white'}>
                {listIndex === selectedIndex ? '❯ ' : '  '}
                {new Date(session.created_at).toLocaleString()} | 
                <Text dimColor> {session.last_message?.substring(0, 50) || 'No messages'}...</Text>
              </Text>
            </Box>
          );
        })}
      </Box>


      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Enter: Select | D: Delete | ESC/B: Back</Text>
      </Box>
    </Box>
  );
};
