// 太陽系撞球：配對 + 房間中繼伺服器（骨架，尚未與前端串接、尚未測試）
// 設計：擊球方的瀏覽器負責模擬並回報結果；伺服器只做配對、輪次檢查與轉送。
// 協定見 docs/ONLINE.md。執行：cd server && npm install && npm start
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8787;
const WAIT_MS = 12000;                 // 等多久沒配到人，就通知前端改打電腦
const wss = new WebSocketServer({ port: PORT });
let waiting = null;                    // 等待中的玩家
const rooms = new Map();               // roomId -> { players:[ws,ws], turn:0, seq:0 }
let nextRoom = 1;

const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg));

function startRoom(a, b) {
  const id = 'r' + nextRoom++;
  const seed = Math.random() * 2 ** 31 | 0;       // 擺球順序用
  const room = { id, players: [a, b], turn: 0, seq: 0 };
  rooms.set(id, room); a.room = b.room = room;
  send(a, { t: 'matched', room: id, you: 0, seed });
  send(b, { t: 'matched', room: id, you: 1, seed });
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'queue') {
      if (waiting && waiting !== ws && waiting.readyState === 1) { clearTimeout(waiting.timer); const w = waiting; waiting = null; startRoom(w, ws); return; }
      waiting = ws;
      ws.timer = setTimeout(() => { if (waiting === ws) { waiting = null; send(ws, { t: 'no_opponent' }); } }, WAIT_MS);
    } else if (m.t === 'cancel') {
      if (waiting === ws) { clearTimeout(ws.timer); waiting = null; }
    } else if (ws.room) {
      const room = ws.room, me = room.players.indexOf(ws), other = room.players[1 - me];
      // 只有輪到的人可以送出 shot / result；其餘訊息（聊天、放棄）直接轉送
      if ((m.t === 'shot' || m.t === 'result' || m.t === 'frames') && me !== room.turn) return;
      if (m.t === 'result') { room.turn = m.nextTurn === 1 ? 1 : 0; }
      send(other, { ...m, seq: ++room.seq });
    }
  });
  ws.on('close', () => {
    if (waiting === ws) { clearTimeout(ws.timer); waiting = null; }
    if (ws.room) { const o = ws.room.players.find((p) => p !== ws); send(o, { t: 'opponent_left' }); rooms.delete(ws.room.id); }
  });
});
console.log('relay listening on :' + PORT);
