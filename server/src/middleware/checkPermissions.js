export function getParticipant(room, userId) {
  return room?.participants.get(userId);
}

export function canControlPlayback(participant) {
  return ['Host', 'Moderator'].includes(participant?.role);
}

export function isHost(participant) {
  return participant?.role === 'Host';
}
