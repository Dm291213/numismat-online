const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

const rooms = {};

console.log('=== Нумизмат онлайн-сервер запущен на порту ' + PORT + ' ===');

wss.on('connection', (ws, req) => {
  let roomName = 'default';
  try {
    const url = new URL(req.url, 'http://localhost');
    roomName = url.searchParams.get('room') || 'default';
  } catch (e) {}

  if (!rooms[roomName]) {
    rooms[roomName] = {
      clients: new Set(),
      events: {},
      luck: 0,
      cash: 1
    };
    console.log('[+] Создана комната: ' + roomName);
  }

  const room = rooms[roomName];
  room.clients.add(ws);

  console.log(`[${roomName}] + игрок (всего: ${room.clients.size})`);

  ws.send(JSON.stringify({
    type: 'state-sync',
    events: room.events,
    luck: room.luck,
    cash: room.cash
  }));

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch (e) { return; }
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'hello':
        broadcastToRoom(room, msg, ws);
        break;
      case 'admin-event-start':
        if (isAdmin(msg)) {
          room.events[msg.event] = Date.now() + msg.duration * 1000;
          broadcastToRoom(room, msg);
        }
        break;
      case 'admin-event-stop':
        if (isAdmin(msg)) {
          delete room.events[msg.event];
          broadcastToRoom(room, msg);
        }
        break;
      case 'admin-luck':
        if (isAdmin(msg)) {
          room.luck = msg.value;
          broadcastToRoom(room, msg);
        }
        break;
      case 'admin-cash':
        if (isAdmin(msg)) {
          room.cash = msg.value;
          broadcastToRoom(room, msg);
        }
        break;
      case 'admin-broadcast':
        if (isAdmin(msg)) {
          broadcastToRoom(room, msg);
        }
        break;
      case 'state-sync':
        if (isAdmin(msg)) {
          room.events = msg.events || {};
          room.luck = msg.luck || 0;
          room.cash = msg.cash || 1;
          broadcastToRoom(room, msg, ws);
        }
        break;
    }
  });

  ws.on('close', () => {
    room.clients.delete(ws);
  });

  ws.on('error', () => {});
});

function isAdmin(msg) {
  return msg && msg.from && msg.isAdmin === true;
}

function broadcastToRoom(room, message, exceptWs) {
  const data = JSON.stringify(message);
  room.clients.forEach((client) => {
    if (client !== exceptWs && client.readyState === WebSocket.OPEN) {
      try { client.send(data); } catch (e) {}
    }
  });
}

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.ping(); } catch (e) {}
    }
  });
}, 30000);
