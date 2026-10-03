

import {
  getRoom,
  publicParticipants,
  stateFor,
  persistRoom
} from '../services/roomService.js';

import {
  canControlPlayback,
  isHost
} from '../middleware/checkPermissions.js';

function ackError(ack, message) {
  if (typeof ack === 'function') {
    ack({ error: message });
  }
}

export function registerSocketHandlers(io) {
  io.on('connection', socket => {

    socket.on('join_room', ({ roomId, username, userId } = {}) => {
      const id = String(roomId || '').toUpperCase();
      const name = String(username || '').trim().slice(0, 30);
      const uid = String(userId || '').slice(0, 80);

      const room = getRoom(id);

      if (!room) {
        return socket.emit('room_error', {
          message: 'Room not found or no longer active. Create a new room or check the code.'
        });
      }

      if (!name || !uid) {
        return socket.emit('room_error', {
          message: 'A display name and user session are required.'
        });
      }

      // DEBUG: compare the joining user's ID with the host ID
      console.log('ROOM JOIN:', {
        roomId: id,
        incomingUserId: uid,
        hostUserId: room.hostUserId,
        sameUser: uid === room.hostUserId
      });

      const existing = room.participants.get(uid);

      const role = uid === room.hostUserId
        ? 'Host'
        : (existing?.role || 'Participant');

      room.participants.set(uid, {
        userId: uid,
        username: name,
        role,
        socketId: socket.id
      });

      socket.data.roomId = id;
      socket.data.userId = uid;
      socket.join(id);

      socket.emit('sync_state', stateFor(room, uid));

      socket.to(id).emit('user_joined', {
        username: name,
        userId: uid,
        role,
        participants: publicParticipants(room)
      });

      io.to(id).emit('participants_update', {
        participants: publicParticipants(room)
      });
    });

    socket.on('leave_room', ({ roomId } = {}) => {
      const id = String(roomId || socket.data.roomId || '').toUpperCase();
      const uid = socket.data.userId;
      const room = getRoom(id);

      if (!room || !uid) return;

      const participant = room.participants.get(uid);

      if (participant?.socketId === socket.id) {
        room.participants.delete(uid);
        socket.leave(id);

        io.to(id).emit('user_left', {
          username: participant.username,
          userId: uid,
          participants: publicParticipants(room)
        });
      }
    });

    function withRoom(payload, ack, callback) {
      const room = getRoom(payload?.roomId || socket.data.roomId);
      const uid = socket.data.userId;
      const participant = room?.participants.get(uid);

      if (!room || !participant || participant.socketId !== socket.id) {
        ackError(
          ack,
          'You are not an active participant in this room. Rejoin the room.'
        );
        return;
      }

      callback(room, participant, uid);
    }

    for (const event of ['play', 'pause', 'seek', 'change_video']) {
      socket.on(event, (payload = {}, ack) =>
        withRoom(payload, ack, (room, participant) => {
          if (!canControlPlayback(participant)) {
            return ackError(
              ack,
              'Only the Host or Moderator can control playback.'
            );
          }

          if (event === 'change_video') {
            const videoId = String(payload.videoId || '');

            if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
              return ackError(ack, 'Invalid YouTube video ID.');
            }

            room.videoId = videoId;
            room.currentTime = 0;
            room.playState = 'playing';

          } else if (event === 'seek') {
            const time = Number(payload.time);

            if (!Number.isFinite(time) || time < 0 || time > 86400) {
              return ackError(ack, 'Invalid seek time.');
            }

            room.currentTime = time;

          } else {
            const time = Number(payload.currentTime);

            if (Number.isFinite(time) && time >= 0) {
              room.currentTime = time;
            }

            if (
              payload.videoId &&
              /^[a-zA-Z0-9_-]{11}$/.test(payload.videoId)
            ) {
              room.videoId = payload.videoId;
            }

            room.playState = event === 'play' ? 'playing' : 'paused';
          }

          persistRoom(room);

          io.to(room.id).emit('playback_update', {
            event,
            videoId: room.videoId,
            playState: room.playState,
            currentTime: room.currentTime,
            updatedBy: participant.username
          });

          if (typeof ack === 'function') {
            ack({ ok: true });
          }
        })
      );
    }

    socket.on('assign_role', (payload = {}, ack) =>
      withRoom(payload, ack, (room, participant) => {
        if (!isHost(participant)) {
          return ackError(ack, 'Only the Host can assign roles.');
        }

        const targetId = String(payload.userId || '');
        const nextRole = payload.role;

        if (!['Moderator', 'Participant'].includes(nextRole)) {
          return ackError(ack, 'Choose Moderator or Participant.');
        }

        if (targetId === room.hostUserId) {
          return ackError(ack, 'The Host role cannot be changed here.');
        }

        const target = room.participants.get(targetId);

        if (!target) {
          return ackError(ack, 'Participant is no longer in this room.');
        }

        target.role = nextRole;

        const data = {
          userId: targetId,
          username: target.username,
          role: nextRole,
          participants: publicParticipants(room)
        };

        io.to(room.id).emit('role_assigned', data);

        if (typeof ack === 'function') {
          ack({ ok: true });
        }
      })
    );

    socket.on('remove_participant', (payload = {}, ack) =>
      withRoom(payload, ack, room => {
        const participant = room.participants.get(socket.data.userId);

        if (!isHost(participant)) {
          return ackError(ack, 'Only the Host can remove participants.');
        }

        const targetId = String(payload.userId || '');

        if (!targetId || targetId === room.hostUserId) {
          return ackError(ack, 'The Host cannot be removed.');
        }

        const target = room.participants.get(targetId);

        if (!target) {
          return ackError(ack, 'Participant is no longer in this room.');
        }

        room.participants.delete(targetId);

        io.to(target.socketId).emit('participant_removed', {
          userId: targetId,
          participants: publicParticipants(room)
        });

        io.to(target.socketId).socketsLeave(room.id);

        io.to(room.id).emit('participant_removed', {
          userId: targetId,
          participants: publicParticipants(room)
        });

        if (typeof ack === 'function') {
          ack({ ok: true });
        }
      })
    );

    socket.on('chat_message', (payload = {}, ack) =>
      withRoom(payload, ack, (room, participant) => {
        const message = String(payload.message || '').trim().slice(0, 400);

        if (!message) {
          return ackError(ack, 'Message cannot be empty.');
        }

        const item = {
          username: participant.username,
          userId: participant.userId,
          message,
          createdAt: new Date().toISOString()
        };

        room.chat.push(item);
        room.chat = room.chat.slice(-100);

        io.to(room.id).emit('chat_message', item);

        if (typeof ack === 'function') {
          ack({ ok: true });
        }
      })
    );

    socket.on('send_reaction', (payload = {}, ack) =>
      withRoom(payload, ack, (room, participant) => {
        const allowedEmojis = ['❤️', '😂', '😮', '👏', '🔥', '😢'];
        const emoji = String(payload.emoji || '');

        if (!allowedEmojis.includes(emoji)) {
          return ackError(
            ack,
            'Choose one of the available emoji reactions.'
          );
        }

        const item = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          emoji,
          username: participant.username,
          userId: participant.userId,
          createdAt: new Date().toISOString()
        };

        io.to(room.id).emit('room_reaction', item);

        if (typeof ack === 'function') {
          ack({ ok: true });
        }
      })
    );

    socket.on('disconnect', () => {
      const id = socket.data.roomId;
      const uid = socket.data.userId;
      const room = getRoom(id);

      if (!room || !uid) return;

      const participant = room.participants.get(uid);

      if (participant?.socketId === socket.id) {
        room.participants.delete(uid);

        io.to(id).emit('user_left', {
          username: participant.username,
          userId: uid,
          participants: publicParticipants(room)
        });
      }
    });
  });
}