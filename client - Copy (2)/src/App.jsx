import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
const USER_KEY = 'watchtogether-user-id';

function getUserId() {
  let id = sessionStorage.getItem(USER_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(USER_KEY, id);
  }
  return id;
}

function Home() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  
  const navState = window.history.state?.usr || {};
const userId = navState.userId || getUserId();

  async function createRoom(e) {
    e.preventDefault();
    setError('');
    if (!username.trim()) return setError('Please enter a display name.');
    setBusy(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), userId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create room.');
      navigate(`/room/${data.roomId}`, { state: { username: username.trim(), userId } });
    } catch (err) { setError(err.message || 'Backend not reachable. Is it running?'); }
    finally { setBusy(false); }
  }

  function joinRoom(e) {
    e.preventDefault();
    if (!username.trim()) return setError('Please enter a display name.');
    if (!roomCode.trim()) return setError('Enter a room code or invite link.');
    let code = roomCode.trim();
    try {
      if (code.includes('/room/')) code = new URL(code).pathname.split('/').filter(Boolean).pop();
    } catch {}
    navigate(`/room/${code.toUpperCase()}`, { state: { username: username.trim(), userId } });
  }

  return <main className="home-wrap">
    <nav className="topbar"><Link className="brand" to="/"><span className="brand-icon">▶</span>CineFlix</Link><span className="pill">Watch in sync</span></nav>
    <section className="hero">
      <div className="eyebrow"><span className="live-dot" /> YOUR SHARED WATCH ROOM</div>
      <h1>Press play.<br /><span>Stay together.</span></h1>
      <p className="hero-copy">Create a room, invite your friends, and watch YouTube videos together — one click away.</p>
      <form className="entry-card" onSubmit={createRoom}>
        <label htmlFor="username">Your display name</label>
        <input id="username" value={username} onChange={e=>setUsername(e.target.value)} maxLength={30} placeholder="e.g. Anshika" />
        <button className="primary-btn" disabled={busy}>{busy ? 'Creating…' : '＋ Create a room'}</button>
        <div className="or-divider"><span /> OR <span /></div>
        <label htmlFor="room-code">Join an existing room</label>
        <div className="join-row"><input id="room-code" value={roomCode} onChange={e=>setRoomCode(e.target.value)} placeholder="Enter room code or link" /><button className="secondary-btn" onClick={joinRoom} type="button">Join room →</button></div>
        {error && <p className="error-text">{error}</p>}
      </form>
      <div className="feature-row"><span>◉ Real-time sync</span><span>♙ Room roles</span><span>↗ Invite by link</span></div>
    </section>
    <footer>Made for shared moments · Student project starter</footer>
  </main>;
}

function getVideoId(input) {
  try {
    const url = new URL(input);
    if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || null;
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtube-nocookie.com')) {
      if (url.searchParams.get('v')) return url.searchParams.get('v');
      const parts = url.pathname.split('/').filter(Boolean);
      const i = parts.findIndex(p => ['embed','shorts','live'].includes(p));
      if (i >= 0) return parts[i + 1] || null;
    }
  } catch {}
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return input.trim();
  return null;
}

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const navState = window.history.state?.usr || {};
  const userId = useMemo(getUserId, []);
  const [username, setUsername] = useState(navState.username || sessionStorage.getItem('cineflix-name') || '');
  const [nameDraft, setNameDraft] = useState('');
  const [role, setRole] = useState('Participant');
  const [participants, setParticipants] = useState([]);
  const [videoId, setVideoId] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [playState, setPlayState] = useState('paused');
  const [currentTime, setCurrentTime] = useState(0);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState('');
  const [reactions, setReactions] = useState([]);
  const reactionEmojis = ['❤️', '😂', '😮', '👏', '🔥', '😢'];
  const socketRef = useRef(null);
  const playerRef = useRef(null);
  const playerReady = useRef(false);
  const applyingRemote = useRef(false);
  const roleRef = useRef(role);
  const videoRef = useRef(videoId);
  const stateRef = useRef(playState);

  useEffect(() => { roleRef.current = role; }, [role]);
  useEffect(() => { videoRef.current = videoId; }, [videoId]);
  useEffect(() => { stateRef.current = playState; }, [playState]);

  useEffect(() => {
    if (!username) return;
    sessionStorage.setItem('watchtogether-name', username);
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => { setConnected(true); setError(''); socket.emit('join_room', { roomId, username, userId }); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setError('Cannot connect to the server. Check that the backend is running.'));
    socket.on('room_error', data => setError(data?.message || 'Room error.'));
    socket.on('sync_state', state => {
      if (state.role) setRole(state.role);
      if (state.participants) setParticipants(state.participants);
      if (state.videoId !== undefined) setVideoId(state.videoId || '');
      if (state.playState) setPlayState(state.playState);
      if (typeof state.currentTime === 'number') setCurrentTime(state.currentTime);
      if (state.chat) setChat(state.chat);
    });
    socket.on('user_joined', data => { if (data.participants) setParticipants(data.participants); });
    socket.on('user_left', data => { if (data.participants) setParticipants(data.participants); });
    socket.on('role_assigned', data => {
      if (data.participants) setParticipants(data.participants);
      if (data.userId === userId) setRole(data.role);
    });
    socket.on('participant_removed', data => {
      if (data.userId === userId) { setError('The host removed you from this room.'); socket.disconnect(); }
      if (data.participants) setParticipants(data.participants);
    });
    socket.on('playback_update', data => {
      if (data.videoId !== undefined && data.videoId !== videoRef.current) setVideoId(data.videoId);
      if (data.playState) setPlayState(data.playState);
      if (typeof data.currentTime === 'number') setCurrentTime(data.currentTime);
    });
    socket.on('chat_message', item => setChat(prev => [...prev.slice(-99), item]));
    socket.on('room_reaction', item => {
      setReactions(prev => [...prev.slice(-11), { ...item, localId: `${item.id}-${Date.now()}-${Math.random()}` }]);
      window.setTimeout(() => setReactions(prev => prev.filter(reaction => reaction.id !== item.id)), 4500);
    });
    return () => { socket.emit('leave_room', { roomId }); socket.disconnect(); };
  }, [roomId, username, userId]);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    function loadAPI() {
      if (window.YT?.Player) { createPlayer(); return; }
      if (!document.querySelector('script[data-youtube-api]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api'; tag.dataset.youtubeApi = 'true';
        document.head.appendChild(tag);
      }
      const old = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { old?.(); if (!cancelled) createPlayer(); };
    }
    function createPlayer() {
      if (cancelled || playerRef.current) return;
      playerRef.current = new window.YT.Player('youtube-player', {
        width: '100%', height: '100%', videoId: '',
        playerVars: { playsinline: 1, rel: 0 },
        events: {
          onReady: () => { playerReady.current = true; },
          onStateChange: event => {
            if (applyingRemote.current) return;
            const socket = socketRef.current;
            if (!socket || ![1,2].includes(event.data)) return;
            if (!['Host','Moderator'].includes(roleRef.current)) return;
            const time = event.target.getCurrentTime?.() || 0;
            socket.emit(event.data === 1 ? 'play' : 'pause', { roomId, currentTime: time, videoId: videoRef.current });
          }
        }
      });
    }
    loadAPI();
    return () => { cancelled = true; };
  }, [username, roomId]);

  useEffect(() => {
    if (!playerReady.current || !playerRef.current || !window.YT?.PlayerState) return;
    const player = playerRef.current;
    applyingRemote.current = true;
    try {
      if (videoId) {
        if (player.getVideoData?.()?.video_id !== videoId) {
          player.loadVideoById({ videoId, startSeconds: Math.max(0, currentTime || 0) });
        } else if (typeof currentTime === 'number' && Math.abs((player.getCurrentTime?.() || 0) - currentTime) > 2.5) {
          player.seekTo(currentTime, true);
        }
        if (playState === 'playing') player.playVideo();
        else player.pauseVideo();
      } else if (player.getVideoData?.()?.video_id) player.stopVideo();
    } catch {}
    const timer = setTimeout(() => { applyingRemote.current = false; }, 500);
    return () => clearTimeout(timer);
  }, [videoId, playState, currentTime]);

  function emitControl(event, payload = {}) {
    setError('');
    socketRef.current?.emit(event, { roomId, ...payload }, response => {
      if (response?.error) setError(response.error);
    });
  }
  function changeVideo(e) {
    e.preventDefault();
    const id = getVideoId(videoUrl);
    if (!id) return setError('Please paste a valid YouTube video URL or 11-character video ID.');
    emitControl('change_video', { videoId: id });
    setVideoUrl('');
  }
  function seek(e) {
    const time = Number(e.target.value);
    setCurrentTime(time);
    emitControl('seek', { time, videoId });
  }
  function assignRole(targetId, nextRole) { emitControl('assign_role', { userId: targetId, role: nextRole }); }
  function removeUser(targetId) { if (window.confirm('Remove this participant from the room?')) emitControl('remove_participant', { userId: targetId }); }
  function sendChat(e) {
    e.preventDefault();
    if (!message.trim()) return;
    emitControl('chat_message', { message: message.trim() });
    setMessage('');
  }
  function sendReaction(emoji) {
    emitControl('send_reaction', { emoji });
  }
  function copyInvite() {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard?.writeText(url).then(() => alert('Invite link copied!')).catch(() => window.prompt('Copy this invite link:', url));
  }

  if (!username) return <main className="name-gate"><form className="entry-card" onSubmit={e=>{e.preventDefault(); if(nameDraft.trim()) setUsername(nameDraft.trim());}}>
    <Link className="brand" to="/">▶ WatchTogether</Link><h2>Join room {roomId}</h2><label>Your display name</label><input value={nameDraft} onChange={e=>setNameDraft(e.target.value)} placeholder="Enter your name" maxLength={30} autoFocus/><button className="primary-btn">Join room</button>
  </form></main>;

  const isController = role === 'Host' || role === 'Moderator';
  const you = participants.find(p => p.userId === userId);
  const duration = playerReady.current ? (playerRef.current?.getDuration?.() || 0) : 0;

  return <main className="room-shell">
    <header className="room-topbar"><Link className="brand" to="/"><span className="brand-icon">▶</span>CineFlix</Link><div className="room-meta"><span className={`status-dot ${connected ? 'online' : ''}`}></span>{connected ? 'Connected' : 'Connecting…'} <span className="room-code">ROOM {roomId}</span><button className="small-btn" onClick={copyInvite}>↗ Copy invite</button></div></header>
    {error && <div className="notice">{error}<button onClick={()=>setError('')}>×</button></div>}
    <div className="room-content">
      <section className="watch-column">
        <div className="section-heading"><div><div className="eyebrow">NOW WATCHING</div><h1>Watch room <span className="muted">/ {roomId}</span></h1></div><span className="role-badge">{role}</span></div>
        <div className="player-frame">
          <div id="youtube-player"></div>
          {!videoId && <div className="player-empty"><div className="big-play">▶</div><h2>Your next shared moment</h2><p>{isController ? 'Paste a YouTube link below to get started.' : 'The host will choose a video soon.'}</p></div>}
          <div className="floating-reactions" aria-live="polite" aria-label="Live reactions">
            {reactions.map((reaction, index) => <div className="floating-reaction" key={reaction.localId || reaction.id} style={{ '--reaction-left': `${12 + ((index * 19 + (String(reaction.id).length * 7)) % 76)}%`, '--reaction-delay': `${(index % 3) * 0.12}s` }} title={`${reaction.username} reacted`}><span>{reaction.emoji}</span><small>{reaction.username}</small></div>)}
          </div>
        </div>
        <div className="player-info"><div><span className={`state-pill ${playState === 'playing' ? 'playing' : ''}`}>{playState === 'playing' ? '▶ Playing' : 'Ⅱ Paused'}</span><span className="muted small-text"> • synced for everyone</span></div><span className="muted small-text">{participants.length} in room</span></div>
        {isController && <form className="video-form" onSubmit={changeVideo}><label htmlFor="youtube-url">Change YouTube video</label><div className="join-row"><input id="youtube-url" value={videoUrl} onChange={e=>setVideoUrl(e.target.value)} placeholder="Paste a YouTube URL or video ID" /><button className="primary-btn">Load video</button></div></form>}
        <section className="reactions-panel" aria-label="Live reactions">
          <div className="reactions-heading"><strong>React together</strong><span className="muted tiny">Reactions float over the video for everyone</span></div>
          <div className="reaction-buttons">{reactionEmojis.map(emoji => <button key={emoji} type="button" className="reaction-btn" onClick={() => sendReaction(emoji)} aria-label={`Send ${emoji} reaction`} title={`Send ${emoji}`}>{emoji}</button>)}</div>
          <div className="reaction-feed" aria-live="polite">{reactions.map(reaction => <div className="reaction-chip" key={reaction.localId || reaction.id}><span className="reaction-emoji">{reaction.emoji}</span><span>{reaction.username}</span></div>)}</div>
        </section>
        <div className="seek-panel"><div className="seek-label"><span>Playback position</span><span>{formatTime(currentTime)} / {formatTime(duration)}</span></div><input aria-label="Seek video" type="range" min="0" max={Math.max(duration, 1)} value={Math.min(currentTime, Math.max(duration, 1))} onChange={seek} disabled={!isController || !videoId}/><p className="muted small-text">{isController ? 'Use the timeline to seek for everyone.' : 'Only the host or moderator can control playback.'}</p></div>
        <div className="hint-card"><span className="hint-icon">✦</span><div><strong>Watching together, wherever you are</strong><p>Share the room link to invite someone. Everyone in the room will receive playback updates.</p></div></div>
      </section>
      <aside className="side-column">
        <section className="panel participants-panel"><div className="panel-title"><h2>People here</h2><span className="count-badge">{participants.length}</span></div>
          {participants.length === 0 && <p className="muted small-text">Waiting for room members…</p>}
          <div className="people-list">{participants.map((p,i)=><div className="person" key={p.userId}><div className={`avatar avatar-${i%5}`}>{(p.username || '?').slice(0,1).toUpperCase()}</div><div className="person-info"><strong>{p.username}{p.userId === userId ? ' (you)' : ''}</strong><span>{p.role}</span></div>{p.role === 'Host' && <span title="Host">♛</span>}
            {role === 'Host' && p.userId !== userId && <div className="person-actions"><select aria-label={`Role for ${p.username}`} value={p.role} onChange={e=>assignRole(p.userId,e.target.value)}><option>Participant</option><option>Moderator</option></select><button className="icon-btn danger" title="Remove participant" onClick={()=>removeUser(p.userId)}>×</button></div>}
          </div>)}</div>
          <button className="invite-btn" onClick={copyInvite}>＋ Invite a friend</button>
          {you && <p className="muted tiny">You joined as {you.role}.</p>}
        </section>
        <section className="panel chat-panel"><div className="panel-title"><h2>Room chat</h2><span className="muted tiny">Optional bonus</span></div><div className="chat-messages">{chat.map((m,i)=><div className="chat-message" key={`${m.createdAt}-${i}`}><strong>{m.username}</strong><p>{m.message}</p><span>{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div>)}{chat.length===0 && <p className="muted small-text">Say hello to everyone 👋</p>}</div><form className="chat-form" onSubmit={sendChat}><input value={message} onChange={e=>setMessage(e.target.value)} maxLength={400} placeholder="Send a message…" /><button aria-label="Send message">➤</button></form></section>
        <div className="role-note"><strong>Room permissions</strong><p><b>Host:</b> full control and role management.</p><p><b>Moderator:</b> playback controls.</p><p><b>Participant:</b> watch and chat.</p></div>
      </aside>
    </div>
    <footer className="room-footer"><span>WatchTogether · Student project</span><button className="text-btn" onClick={()=>navigate('/')}>Leave room</button></footer>
  </main>;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
}

export default function App() {
  return <Routes><Route path="/" element={<Home/>}/><Route path="/room/:roomId" element={<Room/>}/><Route path="*" element={<Home/>}/></Routes>;
}
