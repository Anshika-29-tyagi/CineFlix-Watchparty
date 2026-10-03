import { randomBytes } from 'node:crypto';
import { saveRoom, getRoomRecord } from '../db/database.js';

export const rooms = new Map();

function makeCode() {
  return randomBytes(3).toString('hex').toUpperCase();
}

export function createRoom({ username, userId }) {
  let id;
  do { id = makeCode(); } while (rooms.has(id) || getRoomRecord(id));
  const room = {
    id, hostUserId: userId, videoId: '', playState: 'paused', currentTime: 0,
    participants: new Map(), chat: [], createdAt: new Date().toISOString()
  };
  rooms.set(id, room);
  saveRoom(room);
  return room;
}

export function getRoom(id) {
  return rooms.get(String(id || '').toUpperCase());
}

export function persistRoom(room) {
  saveRoom(room);
}

export function publicParticipants(room) {
  return [...room.participants.values()].map(p => ({
    userId: p.userId, username: p.username, role: p.role
  }));
}

export function stateFor(room, userId) {
  return {
    roomId: room.id, role: room.participants.get(userId)?.role || 'Participant',
    participants: publicParticipants(room), videoId: room.videoId,
    playState: room.playState, currentTime: room.currentTime, chat: room.chat
  };
}
