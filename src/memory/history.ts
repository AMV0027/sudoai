import db from './db.js';
import { v4 as uuidv4 } from 'uuid';

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  thought?: string;
  plan?: string;
  tool_calls?: any;
  tool_results?: any;
}

export class HistoryManager {
  private sessionId: string;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || uuidv4();
    this.ensureSession();
  }

  private ensureSession() {
    const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(this.sessionId);
    if (!session) {
      db.prepare('INSERT INTO sessions (id) VALUES (?)').run(this.sessionId);
    }
  }

  addMessage(message: Message) {
    const stmt = db.prepare(`
      INSERT INTO messages (session_id, role, content, thought, plan, tool_calls, tool_results)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      this.sessionId,
      message.role,
      message.content,
      message.thought || null,
      message.plan || null,
      message.tool_calls ? JSON.stringify(message.tool_calls) : null,
      message.tool_results ? JSON.stringify(message.tool_results) : null
    );
  }

  getMessages(): Message[] {
    const rows = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC').all(this.sessionId) as any[];
    return rows.map(row => ({
      role: row.role,
      content: row.content,
      thought: row.thought || undefined,
      plan: row.plan || undefined,
      tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      tool_results: row.tool_results ? JSON.parse(row.tool_results) : undefined,
    }));
  }


  getSessionId() {
    return this.sessionId;
  }

  setSessionId(id: string) {
    this.sessionId = id;
    this.ensureSession();
  }

  static listSessions() {
    return db.prepare(`
      SELECT s.id, s.created_at, m.content as last_message 
      FROM sessions s
      LEFT JOIN messages m ON m.session_id = s.id 
      WHERE m.id = (SELECT MAX(id) FROM messages WHERE session_id = s.id)
      ORDER BY s.updated_at DESC
    `).all() as { id: string, created_at: string, last_message: string }[];
  }

  static deleteSession(id: string) {
    db.prepare('DELETE FROM messages WHERE session_id = ?').run(id);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }
}
