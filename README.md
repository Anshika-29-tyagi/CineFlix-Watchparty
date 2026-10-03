<<<<<<< HEAD
# WatchTogether — YouTube Watch Party

A student-friendly starter project based on the provided internship assignment:
- React + Vite frontend
- Node.js + Express backend
- Socket.IO for real-time room events
- YouTube IFrame Player API
- SQLite for persistent room metadata (connected participants/live state stay in server memory)

## Features included
- Create room; creator becomes Host
- Join by room code or shareable URL
- YouTube URL input and video ID parsing
- Play, pause, seek and change-video synchronization
- Host / Moderator / Participant roles
- Host can promote/demote users and remove participants
- Server-side permission checks
- Participant list and basic room status
- Basic chat (bonus)
- Live emoji reactions (❤️ 😂 😮 👏 🔥 😢) broadcast to everyone in the room
- Room metadata stored in SQLite

## Requirements
Install Node.js LTS (includes npm) and use a recent Chrome/Firefox browser.

## Run locally

Open two terminals.

### Terminal 1 — backend
```bash
cd server
npm install
cp .env.example .env
npm run dev
```
Backend runs at `http://localhost:4000`.

### Terminal 2 — frontend
```bash
cd client
npm install
cp .env.example .env
npm run dev
```
Open the Vite URL shown in the terminal (usually `http://localhost:5173`).

Open a second browser or Incognito window to test another participant.

## Important notes
- This is an educational MVP, not a production-hardened service. Users are identified by a browser-generated session ID and username, not a full login system. Do not use it for private/sensitive rooms without authentication.
- Live room participants and the latest playback state are kept in backend memory. SQLite stores room metadata, not a full event history. Rooms disappear from active memory when the backend restarts; persistent room metadata remains.
- The server is the authority for role permissions. Never rely only on hiding buttons in React.
- YouTube playback can be affected by browser autoplay policies. Users may need to click Play themselves once.
- YouTube IFrame API requires the video to allow embedding. Some videos cannot be embedded.
- For a production deployment, configure frontend/backend URLs and CORS, use persistent database storage, and add authentication/rate limits.
- Socket.IO is used for bidirectional real-time communication, as permitted by the assignment's WebSocket requirement.

## Environment variables

Frontend `.env`:
```env
VITE_SERVER_URL=http://localhost:4000
```

Backend `.env`:
```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
DATABASE_PATH=./watchparty.sqlite
```

## Suggested deployment
- Deploy `server` to Render or Railway as a Node web service.
- Deploy `client` to Vercel or Render static hosting.
- Set `VITE_SERVER_URL` to the deployed backend URL.
- Set backend `CLIENT_ORIGIN` to the deployed frontend URL.
- If using SQLite in deployment, attach/configure a persistent disk and set `DATABASE_PATH` to a writable path. Otherwise use PostgreSQL for more durable hosted storage.
- Add the live URL to this README after deployment.

## Architecture overview
1. React emits a Socket.IO event.
2. The Express/Socket.IO server validates room membership and role.
3. The server updates in-memory room state and broadcasts the approved state to the room.
4. Clients update their YouTube IFrame player and participant list.
5. Room metadata is written to SQLite.

## Event flow
`join_room`, `leave_room`, `play`, `pause`, `seek`, `change_video`, `assign_role`, `remove_participant`, `sync_state`, `user_joined`, `user_left`, `role_assigned`, `participant_removed`, `chat_message`, `send_reaction`, `room_reaction`.

## Demo checklist
- Create room in one browser
- Join from another browser using room code
- Test play/pause/seek/change video
- Verify Participant cannot control playback
- Promote Participant to Moderator and test controls
- Remove a participant
- Test chat
- Click emoji reactions in one browser and confirm they appear in the other browser
=======
# CineFlex-yt-watch-party-system-
CineFlix is a real-time YouTube Watch Party web application that lets users watch videos together in sync. It features room creation, invite links, role-based permissions, synchronized playback, live chat, and emoji reactions using React, Node.js, Express, and Socket.IO.
>>>>>>> 6dd5d877804d7453c09cbb34623562ef3fb984f7
