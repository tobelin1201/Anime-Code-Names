// Networking. The host's browser is the source of truth: clients send actions to the host,
// the host applies them and pushes each player their own view of the board.
//
// Two kinds of transport run side by side so a game connects on as many networks as possible:
//  - Relay: messages go through free public MQTT brokers over secure WebSockets. Works behind
//    any NAT, but the broker is public, so every message is end-to-end encrypted (ECDH + AES-GCM)
//    between each player and the host. The broker only ever sees ciphertext.
//  - Peer: a direct WebRTC link via PeerJS. Used as a fallback when no relay broker is reachable.
// The Host listens on all of them; the Client uses whichever one answers first.

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PEER_PREFIX = 'anime-codenames-v1-';
const TOPIC_PREFIX = 'anime-codenames/v1/';

// Override by defining window.ACN_RELAYS / window.ACN_PEER_CONFIG before the scripts load.
const DEFAULT_RELAYS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const relayUrls = () => window.ACN_RELAYS || DEFAULT_RELAYS;
const peerOptions = () => ({ debug: 0, ...(window.ACN_PEER_CONFIG || {}) });

const PING_EVERY = 4000;
const SILENCE_LIMIT = 13000; // no reply for this long means the link is gone
const KEY_REFRESH = 60000; // host re-announces itself this often
const KEY_MAX_AGE = 5 * 60000; // announcements older than this belong to an abandoned room

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

function randomId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- crypto helpers ----------
const ECDH = { name: 'ECDH', namedCurve: 'P-256' };
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const enc = new TextEncoder();
const dec = new TextDecoder();

function relayAvailable() {
  return typeof window.mqtt?.connect === 'function' && !!globalThis.crypto?.subtle;
}

async function makeKeys() {
  const pair = await crypto.subtle.generateKey(ECDH, false, ['deriveKey']);
  return { pair, pub: b64(await crypto.subtle.exportKey('raw', pair.publicKey)) };
}

async function deriveKey(privateKey, pubB64) {
  const pub = await crypto.subtle.importKey('raw', unb64(pubB64), ECDH, false, []);
  return crypto.subtle.deriveKey({ name: 'ECDH', public: pub }, privateKey, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

async function seal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(ct) };
}

async function open(key, box) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct));
  return JSON.parse(dec.decode(pt));
}

function parse(payload) {
  try {
    return JSON.parse(typeof payload === 'string' ? payload : dec.decode(payload));
  } catch {
    return null;
  }
}

function connectBroker(url) {
  return window.mqtt.connect(url, {
    clientId: 'acn_' + randomId(),
    clean: true,
    keepalive: 30,
    connectTimeout: 8000,
    reconnectPeriod: 3000,
  });
}

// ---------- relay transport ----------
// Topics: <prefix><CODE>/hk  retained host announcement { pub, t }
//         <prefix><CODE>/h   players -> host  { cid, cpub, iv, ct }
//         <prefix><CODE>/c/<cid>  host -> one player  { iv, ct }
class RelayHost {
  constructor(url, code, { onMessage, onStatus }) {
    this.url = url;
    this.base = TOPIC_PREFIX + code;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.clients = new Map(); // cid -> { key, cpub, pid, lastSeen, gone }
  }

  async start() {
    if (!relayAvailable()) return this.onStatus('offline');
    this.onStatus('connecting');
    this.keys = await makeKeys();
    const mq = connectBroker(this.url);
    this.mq = mq;
    mq.on('connect', () => {
      mq.subscribe(this.base + '/h', { qos: 0 });
      this.#announce();
      this.onStatus('online');
    });
    mq.on('reconnect', () => this.onStatus('connecting'));
    mq.on('offline', () => this.onStatus('offline'));
    mq.on('error', () => {});
    mq.on('message', (_topic, payload) => this.#onPacket(payload));
    this.timers = [setInterval(() => this.#announce(), KEY_REFRESH), setInterval(() => this.#sweep(), 3000)];
  }

  #announce() {
    if (this.mq?.connected) {
      this.mq.publish(this.base + '/hk', JSON.stringify({ pub: this.keys.pub, t: Date.now() }), { qos: 1, retain: true });
    }
  }

  async #onPacket(payload) {
    const p = parse(payload);
    if (!p || typeof p.cid !== 'string' || typeof p.cpub !== 'string' || p.cid.length > 40) return;
    let c = this.clients.get(p.cid);
    let msg;
    try {
      if (!c || c.cpub !== p.cpub) {
        c = { key: await deriveKey(this.keys.pair.privateKey, p.cpub), cpub: p.cpub, pid: null, lastSeen: 0, gone: false };
        this.clients.set(p.cid, c);
      }
      msg = await open(c.key, p);
    } catch {
      return; // not for us, or tampered
    }
    if (!msg || typeof msg !== 'object') return;
    c.lastSeen = Date.now();
    if (msg.type === 'hello' && typeof msg.pid === 'string') c.pid = msg.pid.slice(0, 40);
    if (!c.pid) return;
    if (c.gone) {
      c.gone = false;
      this.onMessage(c.pid, { type: 'presence' });
    }
    if (msg.type === 'ping') return this.#sendTo(p.cid, c, { type: 'pong' });
    this.onMessage(c.pid, msg);
  }

  #sweep() {
    const now = Date.now();
    for (const [cid, c] of this.clients) {
      if (c.gone || !c.pid || now - c.lastSeen < SILENCE_LIMIT) {
        if (!c.pid && now - c.lastSeen > 60000) this.clients.delete(cid);
        continue;
      }
      c.gone = true;
      if (!this.connectedPids().includes(c.pid)) this.onMessage(c.pid, { type: 'left' });
    }
  }

  async #sendTo(cid, c, msg) {
    if (!this.mq?.connected) return;
    this.mq.publish(`${this.base}/c/${cid}`, JSON.stringify(await seal(c.key, msg)), { qos: 0 });
  }

  send(pid, msg) {
    for (const [cid, c] of this.clients) {
      if (c.pid === pid && !c.gone) this.#sendTo(cid, c, msg);
    }
  }

  connectedPids() {
    return [...this.clients.values()].filter((c) => c.pid && !c.gone).map((c) => c.pid);
  }

  stop() {
    this.timers?.forEach(clearInterval);
    if (this.mq) {
      // Clear the announcement so joiners see "not found" instead of waiting on a closed room.
      if (this.mq.connected) this.mq.publish(this.base + '/hk', '', { qos: 1, retain: true });
      this.mq.end(false);
    }
  }
}

class RelayClient {
  constructor(url, code, { onMessage, onStatus, hello }) {
    this.url = url;
    this.base = TOPIC_PREFIX + code;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.hello = hello;
    this.cid = randomId();
    this.key = null;
    this.lastSeen = 0;
  }

  #set(status) {
    this.status = status;
    this.onStatus(status);
  }

  async start() {
    if (!relayAvailable()) return this.#set('offline');
    this.#set('connecting');
    this.keys = await makeKeys();
    const mq = connectBroker(this.url);
    this.mq = mq;
    // A broker we can't reach shouldn't keep the join screen spinning; count it as offline.
    this.unreachable = setTimeout(() => {
      if (!mq.connected) this.#set('offline');
    }, 10000);
    mq.on('connect', () => {
      clearTimeout(this.unreachable);
      mq.subscribe([this.base + '/hk', `${this.base}/c/${this.cid}`], { qos: 0 });
      clearTimeout(this.notFound);
      this.notFound = setTimeout(() => {
        if (!this.key) this.#set('notfound');
      }, 7000);
    });
    mq.on('reconnect', () => {
      if (!this.key && this.status !== 'offline') this.#set('connecting');
    });
    mq.on('offline', () => this.#set('offline'));
    mq.on('error', () => {});
    mq.on('message', (topic, payload) => this.#onPacket(topic, payload));
    this.timer = setInterval(() => this.#tick(), PING_EVERY);
  }

  async #onPacket(topic, payload) {
    if (topic.endsWith('/hk')) {
      const ann = parse(payload);
      if (!ann?.pub || Math.abs(Date.now() - (ann.t || 0)) > KEY_MAX_AGE) {
        this.key = null;
        this.hostPub = null;
        return this.#set('notfound');
      }
      if (ann.pub === this.hostPub) return;
      // A new announcement means the host (re)started: re-key and say hello again.
      this.hostPub = ann.pub;
      this.key = await deriveKey(this.keys.pair.privateKey, ann.pub);
      this.lastSeen = Date.now();
      this.#set('waiting');
      this.send(this.hello());
      return;
    }
    if (!this.key) return;
    let msg;
    try {
      msg = await open(this.key, parse(payload));
    } catch {
      return;
    }
    this.lastSeen = Date.now();
    if (this.status !== 'online') this.#set('online');
    if (msg?.type !== 'pong') this.onMessage(msg);
  }

  #tick() {
    if (!this.key) return;
    this.send({ type: 'ping' });
    if (Date.now() - this.lastSeen > SILENCE_LIMIT) {
      this.lastSeen = Date.now();
      this.#set('waiting');
      this.send(this.hello());
    }
  }

  send(msg) {
    if (!this.key || !this.mq?.connected) return false;
    const key = this.key;
    seal(key, msg).then((box) => {
      this.mq.publish(this.base + '/h', JSON.stringify({ cid: this.cid, cpub: this.keys.pub, ...box }), { qos: 0 });
    });
    return true;
  }

  stop() {
    clearInterval(this.timer);
    clearTimeout(this.notFound);
    clearTimeout(this.unreachable);
    this.mq?.end(true);
  }
}

// ---------- peer transport ----------
class PeerHost {
  constructor(code, { onMessage, onStatus }) {
    this.code = code;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.conns = new Set();
    this.attempts = 0;
  }

  start() {
    if (typeof window.Peer !== 'function' || this.stopped) return this.onStatus('offline');
    this.onStatus('connecting');
    const peer = new window.Peer(PEER_PREFIX + this.code, peerOptions());
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
          setTimeout(() => this.start(), 8000);
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
      if (conn.pid && !this.connectedPids().includes(conn.pid)) this.onMessage(conn.pid, { type: 'left' });
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

  stop() {
    this.stopped = true;
    this.peer?.destroy();
  }
}

class PeerClient {
  constructor(code, { onMessage, onStatus, hello }) {
    this.code = code;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.hello = hello;
    this.everConnected = false;
    this.lastSeen = 0;
  }

  start() {
    if (typeof window.Peer !== 'function' || this.stopped) return this.onStatus('offline');
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
        if (!this.everConnected) this.onStatus('notfound');
        return this.#retrySoon();
      }
      if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) {
        this.onStatus('offline');
        peer.destroy();
        setTimeout(() => this.start(), 5000);
      }
    });
    clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => this.#tick(), PING_EVERY);
  }

  #connect() {
    if (this.stopped) return;
    if (this.conn) this.conn.close();
    const conn = this.peer.connect(PEER_PREFIX + this.code, { reliable: true });
    this.conn = conn;
    // WebRTC can fail silently (e.g. strict NAT); never wait on a link that won't open.
    clearTimeout(this.openTimer);
    this.openTimer = setTimeout(() => {
      if (this.conn === conn && !conn.open) this.#retrySoon();
    }, 10000);
    conn.on('open', () => {
      clearTimeout(this.openTimer);
      this.everConnected = true;
      this.lastSeen = Date.now();
      this.onStatus('online');
      conn.send(this.hello());
    });
    conn.on('data', (msg) => {
      this.lastSeen = Date.now();
      if (msg && msg.type !== 'pong') this.onMessage(msg);
    });
    const lost = () => {
      if (this.conn !== conn) return;
      this.onStatus('waiting');
      this.#retrySoon();
    };
    conn.on('close', lost);
    conn.on('error', lost);
  }

  #retrySoon() {
    clearTimeout(this.retry);
    this.retry = setTimeout(() => {
      if (this.stopped) return;
      if (this.peer.destroyed) return this.start();
      if (this.peer.disconnected) return this.peer.reconnect();
      this.#connect();
    }, 3000);
  }

  #tick() {
    if (!this.conn?.open) return;
    this.conn.send({ type: 'ping' });
    if (Date.now() - this.lastSeen > SILENCE_LIMIT) {
      this.lastSeen = Date.now();
      this.onStatus('waiting');
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

  stop() {
    this.stopped = true;
    clearInterval(this.heartbeat);
    clearTimeout(this.retry);
    clearTimeout(this.openTimer);
    this.peer?.destroy();
  }
}

// ---------- combined ----------
export class Host {
  constructor(code, { onMessage, onStatus }) {
    this.routes = new Map(); // pid -> transport that last heard from them
    this.statuses = new Map();
    const make = (T, ...args) => {
      const t = new T(...args, code, {
        onMessage: (pid, msg) => {
          if (msg.type === 'left' && this.connectedPids().includes(pid)) return; // still reachable elsewhere
          if (msg.type !== 'left') this.routes.set(pid, t);
          onMessage(pid, msg);
        },
        onStatus: (s) => {
          this.statuses.set(t, s);
          const all = [...this.statuses.values()];
          onStatus(all.includes('online') ? 'online' : all.includes('connecting') ? 'connecting' : 'offline');
        },
      });
      return t;
    };
    this.transports = [...relayUrls().map((url) => make(RelayHost, url)), make(PeerHost)];
  }

  start() {
    this.transports.forEach((t) => t.start());
  }

  send(pid, msg) {
    const t = this.routes.get(pid);
    if (t?.connectedPids().includes(pid)) return t.send(pid, msg);
    this.transports.forEach((x) => x.send(pid, msg));
  }

  connectedPids() {
    return [...new Set(this.transports.flatMap((t) => t.connectedPids()))];
  }

  stop() {
    this.transports.forEach((t) => t.stop());
  }
}

export class Client {
  constructor(code, { onMessage, onStatus, hello }) {
    this.statuses = new Map();
    this.onStatus = onStatus;
    const make = (T, ...args) => {
      const t = new T(...args, code, {
        hello,
        onMessage: (msg) => {
          this.active = t;
          clearTimeout(this.fallback);
          onMessage(msg);
        },
        onStatus: (s) => {
          this.statuses.set(t, s);
          this.#report();
        },
      });
      return t;
    };
    this.relays = relayUrls().map((url) => make(RelayClient, url));
    this.peer = make(PeerClient);
  }

  start() {
    this.relays.forEach((t) => t.start());
    // Start the direct link too if no relay has brought us the game within a few seconds.
    this.fallback = setTimeout(() => this.#startPeer(), 6000);
  }

  #startPeer() {
    if (this.peerStarted) return;
    this.peerStarted = true;
    this.peer.start();
  }

  #report() {
    const relayStates = this.relays.map((t) => this.statuses.get(t));
    if (relayStates.every((s) => s === 'notfound' || s === 'offline')) this.#startPeer();
    const all = [...this.statuses.values()];
    let status = 'connecting';
    if (all.includes('online')) status = 'online';
    else if (all.includes('waiting')) status = 'waiting';
    else if (this.peerStarted && all.length === this.relays.length + 1 && all.every((s) => s === 'notfound' || s === 'offline')) {
      status = all.includes('notfound') ? 'notfound' : 'offline';
    }
    if (status !== this.last) this.onStatus((this.last = status));
  }

  send(msg) {
    if (this.active?.send(msg)) return true;
    return [...this.relays, this.peer].some((t) => t.send(msg));
  }

  stop() {
    clearTimeout(this.fallback);
    this.relays.forEach((t) => t.stop());
    this.peer.stop();
  }
}
