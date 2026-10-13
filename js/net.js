// Peer-to-peer sync over WebRTC (PeerJS). The host's browser is the source of truth:
// clients send actions to the host, the host applies them and pushes each player their own view.
// PeerJS's free public broker is only used to introduce peers; no game data is stored there.

const PREFIX = 'anime-codenames-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function makeRoomCode() {
  let code = '';
  const buf = new Uint32Array(4);
  crypto.getRandomValues(buf);
  for (const n of buf) code += CODE_CHARS[n % CODE_CHARS.length];
  return code;
}

export function normalizeCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
}

// Optional: point at your own PeerJS server by defining window.ACN_PEER_CONFIG before this
// script loads, e.g. { host: 'peer.example.com', port: 443, path: '/', secure: true }.
function peerOptions() {
  return { debug: 0, ...(window.ACN_PEER_CONFIG || {}) };
}

function peerAvailable() {
  return typeof window.Peer === 'function';
}

export class Host {
  constructor(code, { onMessage, onStatus }) {
    this.code = code;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.conns = new Set();
    this.attempts = 0;
  }

  start() {
    if (!peerAvailable()) return this.onStatus('offline');
    this.onStatus('connecting');
    const peer = new window.Peer(PREFIX + this.code, peerOptions());
    this.peer = peer;
    peer.on('open', () => {
      this.attempts = 0;
      this.onStatus('online');
    });
    peer.on('connection', (conn) => this.#attach(conn));
    peer.on('disconnected', () => {
      setTimeout(() => {
        if (!peer.destroyed && peer.disconnected) peer.reconnect();
      }, 1500);
    });
    peer.on('error', (err) => {
      // After a page reload the broker may still hold our old id for a few seconds.
      if (err.type === 'unavailable-id' && this.attempts < 15) {
        this.attempts += 1;
        peer.destroy();
        setTimeout(() => this.start(), 2000);
        return;
      }
      if (['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible'].includes(err.type)) {
        this.onStatus('offline');
        if (err.type !== 'browser-incompatible' && !peer.destroyed) {
          peer.destroy();
          setTimeout(() => this.start(), 5000);
        }
      }
    });
  }

  #attach(conn) {
    conn.on('open', () => this.conns.add(conn));
    conn.on('data', (msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'ping') return conn.send({ type: 'pong' });
      if (msg.type === 'hello' && typeof msg.pid === 'string') conn.pid = msg.pid.slice(0, 40);
      if (!conn.pid) return;
      this.onMessage(conn.pid, msg);
    });
    const drop = () => {
      this.conns.delete(conn);
      if (conn.pid && ![...this.conns].some((c) => c.pid === conn.pid)) {
        this.onMessage(conn.pid, { type: 'left' });
      }
    };
    conn.on('close', drop);
    conn.on('error', drop);
  }

  send(pid, msg) {
    for (const conn of this.conns) {
      if (conn.pid === pid && conn.open) conn.send(msg);
    }
  }

  connectedPids() {
    return [...this.conns].filter((c) => c.open && c.pid).map((c) => c.pid);
  }
}

export class Client {
  constructor(code, { onMessage, onStatus, onOpen }) {
    this.code = code;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.onOpen = onOpen;
    this.everConnected = false;
    this.lastSeen = 0;
  }

  start() {
    if (!peerAvailable()) return this.onStatus('offline');
    this.onStatus('connecting');
    const peer = new window.Peer(peerOptions());
    this.peer = peer;
    peer.on('open', () => this.#connect());
    peer.on('disconnected', () => {
      setTimeout(() => {
        if (!peer.destroyed && peer.disconnected) peer.reconnect();
      }, 1500);
    });
    peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') {
        if (!this.everConnected) return this.onStatus('notfound');
        this.onStatus('reconnecting');
        return this.#retrySoon();
      }
      if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) {
        this.onStatus('reconnecting');
        peer.destroy();
        setTimeout(() => this.start(), 4000);
      }
    });
    clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => this.#tick(), 4000);
  }

  #connect() {
    if (this.conn) this.conn.close();
    const conn = this.peer.connect(PREFIX + this.code, { reliable: true });
    this.conn = conn;
    conn.on('open', () => {
      this.everConnected = true;
      this.lastSeen = Date.now();
      this.onStatus('online');
      this.onOpen();
    });
    conn.on('data', (msg) => {
      this.lastSeen = Date.now();
      if (msg && msg.type !== 'pong') this.onMessage(msg);
    });
    conn.on('close', () => {
      if (this.conn !== conn) return;
      this.onStatus('reconnecting');
      this.#retrySoon();
    });
  }

  #retrySoon() {
    clearTimeout(this.retry);
    this.retry = setTimeout(() => {
      if (this.peer.destroyed) return this.start();
      if (this.peer.disconnected) return this.peer.reconnect();
      this.#connect();
    }, 2500);
  }

  #tick() {
    if (!this.conn?.open) return;
    this.conn.send({ type: 'ping' });
    // Mobile browsers often drop WebRTC silently; treat 12s of silence as a lost link.
    if (Date.now() - this.lastSeen > 12000) {
      this.lastSeen = Date.now();
      this.onStatus('reconnecting');
      this.#connect();
    }
  }

  send(msg) {
    if (this.conn?.open) {
      this.conn.send(msg);
      return true;
    }
    return false;
  }
}
