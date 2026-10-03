import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || path.resolve(here, '../../watchparty.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    host_user_id TEXT NOT NULL,
    video_id TEXT DEFAULT '',
    play_state TEXT NOT NULL DEFAULT 'paused',
    current_time REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

export function saveRoom(room) {
  db.prepare(`
    INSERT INTO rooms (id, host_user_id, video_id, play_state, current_time)
    VALUES (@id, @hostUserId, @videoId, @playState, @currentTime)
    ON CONFLICT(id) DO UPDATE SET
      host_user_id=excluded.host_user_id,
      video_id=excluded.video_id,
      play_state=excluded.play_state,
      current_time=excluded.current_time
  `).run({
    id: room.id, hostUserId: room.hostUserId, videoId: room.videoId || '',
    playState: room.playState || 'paused', currentTime: room.currentTime || 0
  });
}

export function getRoomRecord(id) {
  return db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
}
