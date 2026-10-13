import { SERIES, CATEGORIES } from './characters.js';
import { LANGUAGES, t, setLanguage, getLanguage, detectLanguage } from './i18n.js';
import { TEAMS, BOARD_SIZE, defaultSettings, buildPool, newGame, applyAction, viewFor } from './game.js';
import { Host, Client, makeRoomCode, normalizeCode } from './net.js';

// ---------- storage ----------
const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode: play without persistence */
    }
  },
};

const prefs = Object.assign(
  { lang: detectLanguage(), display: 'both', showSeries: true, name: '', team: 'red', role: 'operative' },
  store.get('acn-prefs', {}),
);
const savePrefs = () => store.set('acn-prefs', prefs);
setLanguage(prefs.lang);

let pid = store.get('acn-pid');
if (!pid) {
  pid = crypto.getRandomValues(new Uint32Array(3)).join('-');
  store.set('acn-pid', pid);
}

// ---------- app state ----------
const S = {
  screen: 'landing', // landing | profile | game
  intent: 'create', // create | join
  code: '',
  isHost: false,
  status: 'connecting',
  view: null,
  players: [],
  pub: { teamNames: { red: '', blue: '' }, anyoneCanTap: false },
  modal: null,
  pending: null, // index of the card waiting for a confirming second tap
  shownWinFor: null,
};

let H = null; // host-only state: { code, game, players, settings, history, net }
let client = null;

const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');

// ---------- helpers ----------
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const seriesById = Object.fromEntries(SERIES.map((s) => [s.id, s]));

function teamName(team) {
  return S.pub.teamNames?.[team] || t(team);
}

function seriesLabel(id) {
  const s = seriesById[id];
  if (!s) return '';
  return getLanguage() === 'ja' ? s.ja : s.name;
}

function cardNames(w) {
  const ja = w.ja || w.en;
  if (prefs.display === 'en') return [w.en, null];
  if (prefs.display === 'ja') return [ja, null];
  const hasJa = w.ja && w.ja !== w.en;
  if (getLanguage() === 'ja') return [ja, hasJa ? w.en : null];
  return [w.en, hasJa ? w.ja : null];
}

function roomUrl(code) {
  return `${location.origin}${location.pathname}?room=${code}`;
}

function setRoomInUrl(code) {
  const url = code ? `${location.pathname}?room=${code}` : location.pathname;
  history.replaceState(null, '', url);
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function me() {
  return { name: prefs.name, team: prefs.team, role: prefs.role };
}

function sanitizeProfile(p) {
  return {
    name: String(p.name || 'Player').trim().slice(0, 24) || 'Player',
    team: TEAMS.includes(p.team) ? p.team : 'red',
    role: p.role === 'spymaster' ? 'spymaster' : 'operative',
  };
}

// ---------- host ----------
function hostSave() {
  const { net, ...data } = H;
  store.set('acn-host', { ...data, history: data.history.slice(-15) });
}

function startHosting(saved) {
  H = saved
    ? { ...saved, settings: { ...defaultSettings(), ...saved.settings }, history: saved.history || [] }
    : { code: makeRoomCode(), game: null, players: {}, settings: defaultSettings(), history: [] };
  if (!H.game) H.game = newGame(buildPool(H.settings));
  H.players[pid] = { ...sanitizeProfile(me()), host: true };
  S.isHost = true;
  S.code = H.code;
  S.screen = 'game';
  setRoomInUrl(H.code);
  H.net = new Host(H.code, { onMessage: hostOnMessage, onStatus: setStatus });
  hostSave();
  hostBroadcast();
  H.net.start();
}

function hostOnMessage(from, msg) {
  switch (msg.type) {
    case 'hello':
    case 'profile':
      H.players[from] = { ...sanitizeProfile(msg), host: from === pid };
      break;
    case 'left':
      break;
    case 'action': {
      const res = applyAction(H.game, msg.action || {}, H.players[from], H.settings);
      if (res.error) return sendTo(from, { type: 'error', code: res.error });
      H.history.push(H.game);
      H.history = H.history.slice(-30);
      H.game = res.game;
      break;
    }
    default:
      return;
  }
  hostSave();
  hostBroadcast();
}

function sendTo(id, msg) {
  if (id === pid) handleMessage(structuredClone(msg));
  else H.net.send(id, msg);
}

function hostBroadcast() {
  const online = new Set([pid, ...H.net.connectedPids()]);
  const pub = { teamNames: H.settings.teamNames, anyoneCanTap: H.settings.anyoneCanTap };
  for (const id of online) {
    const p = H.players[id];
    if (!p) continue;
    // Player ids stay on the host; each viewer only learns which row is theirs.
    const players = Object.entries(H.players).map(([pidKey, pl]) => ({
      name: pl.name,
      team: pl.team,
      role: pl.role,
      host: !!pl.host,
      online: online.has(pidKey),
      me: pidKey === id,
    }));
    sendTo(id, { type: 'state', view: viewFor(H.game, p.role === 'spymaster'), players, pub });
  }
}

function hostNewGame() {
  const pool = buildPool(H.settings);
  if (pool.length < BOARD_SIZE) return toast(t('poolTooSmall'));
  H.history = [];
  H.game = newGame(pool);
  S.pending = null;
  hostSave();
  hostBroadcast();
}

function hostUndo() {
  const prev = H.history.pop();
  if (!prev) return;
  H.game = prev;
  hostSave();
  hostBroadcast();
}

// ---------- client ----------
function startJoining(code) {
  S.isHost = false;
  S.code = code;
  S.screen = 'game';
  S.view = null;
  setRoomInUrl(code);
  client = new Client(code, {
    onMessage: handleMessage,
    onStatus: setStatus,
    onOpen: () => client.send({ type: 'hello', pid, ...me() }),
  });
  client.start();
  render();
}

function handleMessage(msg) {
  if (msg.type === 'state') {
    if (S.view && S.view.id !== msg.view.id) S.pending = null;
    S.view = msg.view;
    S.players = msg.players;
    S.pub = msg.pub;
    if (S.pending !== null && S.view.revealed[S.pending]) S.pending = null;
    render();
  } else if (msg.type === 'error') {
    if (t(msg.code) !== msg.code) toast(t(msg.code));
  }
}

function setStatus(status) {
  S.status = status;
  render();
}

function send(msg) {
  if (S.isHost) return hostOnMessage(pid, msg);
  if (!client?.send(msg)) toast(t('reconnecting'));
}

function act(action) {
  send({ type: 'action', action });
}

function leaveGame() {
  if (H?.net?.peer) H.net.peer.destroy();
  if (client?.peer) {
    clearInterval(client.heartbeat);
    client.peer.destroy();
  }
  H = null;
  client = null;
  S.isHost = false;
  S.view = null;
  S.screen = 'landing';
  S.status = 'connecting';
  S.modal = null;
  setRoomInUrl('');
  render();
}

// ---------- rendering ----------
function render() {
  // Keep focus and typed text in inputs across re-renders triggered by the network.
  const active = document.activeElement;
  const focusId = active?.id && app.contains(active) ? active.id : null;
  const sel = focusId && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;
  const values = {};
  app.querySelectorAll('input[id]:not([type=checkbox]), textarea[id]').forEach((el) => (values[el.id] = el.value));

  if (S.screen === 'landing') app.innerHTML = renderLanding();
  else if (S.screen === 'profile') app.innerHTML = renderProfile();
  else app.innerHTML = renderGame();

  for (const [id, v] of Object.entries(values)) {
    const el = document.getElementById(id);
    if (el && app.contains(el)) el.value = v;
  }
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) {
      el.focus();
      if (sel) {
        try {
          el.setSelectionRange(...sel);
        } catch {
          /* not a text input */
        }
      }
    }
  }
  renderModal();
  maybeShowWin();
}

function langSelect() {
  return `<label class="lang-select"><span aria-hidden="true">🌐</span>
    <select id="lang" aria-label="${esc(t('language'))}">
      ${Object.entries(LANGUAGES).map(([k, v]) => `<option value="${k}" ${k === getLanguage() ? 'selected' : ''}>${v}</option>`).join('')}
    </select></label>`;
}

function renderLanding() {
  const saved = store.get('acn-host');
  const sample = buildPool(defaultSettings()).filter((w) => w.en.length <= 9).sort(() => Math.random() - 0.5).slice(0, 6);
  return `
  <main class="landing">
    <div class="landing-top">${langSelect()}</div>
    <div class="hero">
      <div class="logo">
        <span class="logo-jp">コードネーム</span>
        <h1>Anime<br>Codenames</h1>
      </div>
      <p class="tagline">${esc(t('tagline'))}</p>
    </div>
    <div class="deco" aria-hidden="true">
      ${sample.map((w, i) => `<div class="deco-card c${i}"><b>${esc(w.en)}</b><small>${esc(w.ja)}</small></div>`).join('')}
    </div>
    <div class="panel">
      <button class="btn primary big" data-act="create">${esc(t('createGame'))}</button>
      ${saved?.code ? `<button class="btn ghost" data-act="resume">${esc(t('resumeGame', { code: saved.code }))}</button>` : ''}
      <div class="divider"><span>${esc(t('joinGame'))}</span></div>
      <form id="join-form" class="join-form">
        <input id="code-input" class="code-input" maxlength="4" autocomplete="off" autocapitalize="characters"
          spellcheck="false" placeholder="ABCD" aria-label="${esc(t('roomCode'))}">
        <button class="btn" type="submit">${esc(t('join'))}</button>
      </form>
      <button class="link" data-act="rules">${esc(t('rules'))}</button>
    </div>
  </main>`;
}

function teamPicker(selected) {
  return `<div class="picker two">
    ${TEAMS.map((tm) => `<button type="button" class="pick team-${tm} ${selected === tm ? 'on' : ''}" data-pick-team="${tm}">
      <span class="emblem">${tm === 'red' ? '🔥' : '🌊'}</span>${esc(teamName(tm))}</button>`).join('')}
  </div>`;
}

function rolePicker(selected) {
  return `<div class="picker two">
    ${['spymaster', 'operative'].map((r) => `<button type="button" class="pick role ${selected === r ? 'on' : ''}" data-pick-role="${r}">
      <span class="emblem">${r === 'spymaster' ? '🕶️' : '🔍'}</span>${esc(t(r))}<small>${esc(t(r + 'Hint'))}</small></button>`).join('')}
  </div>`;
}

function renderProfile() {
  const title = S.intent === 'create' ? t('createGame') : `${t('joinGame')} · ${S.code}`;
  return `
  <main class="profile">
    <div class="landing-top"><button class="btn ghost small" data-act="back">← ${esc(t('back'))}</button>${langSelect()}</div>
    <form id="profile-form" class="panel">
      <h2>${esc(title)}</h2>
      <label class="field"><span>${esc(t('yourName'))}</span>
        <input id="name-input" maxlength="24" required autocomplete="nickname" value="${esc(prefs.name)}"></label>
      <div class="field"><span>${esc(t('team'))}</span>${teamPicker(prefs.team)}</div>
      <div class="field"><span>${esc(t('role'))}</span>${rolePicker(prefs.role)}</div>
      <button class="btn primary big" type="submit">${esc(t('continue'))}</button>
    </form>
  </main>`;
}

function statusBanner() {
  if (S.status === 'online') return '';
  if (S.isHost) {
    if (S.status === 'offline') return `<div class="banner warn">${esc(t('hostOffline'))}</div>`;
    return `<div class="banner">${esc(t('connecting'))}</div>`;
  }
  if (S.status === 'reconnecting') return `<div class="banner warn">${esc(t('reconnecting'))}</div>`;
  return '';
}

function renderGame() {
  if (!S.view) {
    const notFound = S.status === 'notfound';
    const offline = S.status === 'offline';
    return `<main class="waiting">
      <div class="panel">
        <div class="code-big">${esc(S.code)}</div>
        ${notFound || offline ? `<p>${esc(t(notFound ? 'roomNotFound' : 'hostOffline'))}</p>` : `<div class="spinner"></div><p>${esc(t(S.status === 'reconnecting' ? 'reconnecting' : 'connecting'))}</p>`}
        <button class="btn ghost" data-act="home">← ${esc(t('back'))}</button>
      </div></main>`;
  }
  const v = S.view;
  const self = S.players.find((p) => p.me) || { ...me() };
  const isSpy = self.role === 'spymaster';
  const myTurn = self.team === v.turn;
  const anyone = S.pub.anyoneCanTap;
  const canClue = !v.winner && !v.clue && (anyone || (isSpy && myTurn));
  const canEnd = !v.winner && (anyone || myTurn);

  return `
  <div class="game ${isSpy ? 'is-spy' : ''}">
    <header class="topbar">
      <button class="brand" data-act="home" title="Anime Codenames">⛩️<span>Anime Codenames</span></button>
      <button class="room-chip" data-act="invite" title="${esc(t('invite'))}">
        <span class="room-code">${esc(S.code)}</span><span class="room-label">${esc(t('invite'))}</span></button>
      <nav class="top-actions">
        <button class="icon-btn only-narrow" data-act="players" title="${esc(t('players'))}">👥<span class="count">${S.players.filter((p) => p.online).length}</span></button>
        <button class="icon-btn" data-act="settings" title="${esc(t('settings'))}">⚙️</button>
        <button class="icon-btn" data-act="rules" title="${esc(t('rules'))}">❔</button>
      </nav>
    </header>
    ${statusBanner()}
    <div class="layout">
      <section class="main-col">
        ${renderScoreboard(v)}
        ${renderClueBar(v)}
        <div class="board ${isSpy || v.winner ? 'show-key' : ''}" role="grid">
          ${v.words.map((w, i) => renderCard(v, w, i)).join('')}
        </div>
        <div class="controls">
          <button class="me-chip team-${self.team}" data-act="profile">
            <span>${self.role === 'spymaster' ? '🕶️' : '🔍'}</span>
            <b>${esc(self.name || '?')}</b> · ${esc(teamName(self.team))} ${esc(t(self.role))}
          </button>
          ${canClue ? `<form id="clue-form" class="clue-form">
              <input id="clue-word" maxlength="40" autocomplete="off" placeholder="${esc(t('clueWord'))}" aria-label="${esc(t('clueWord'))}">
              <select id="clue-num" aria-label="${esc(t('number'))}">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => `<option value="${n}">${n}</option>`).join('')}
                <option value="inf">${esc(t('unlimited'))}</option>
              </select>
              <button class="btn primary" type="submit">${esc(t('giveClue'))}</button>
            </form>` : ''}
          ${canEnd ? `<button class="btn" data-act="end-turn">${esc(t('endTurn'))}</button>` : ''}
          ${S.isHost ? `<div class="host-tools">
              <button class="btn ghost small" data-act="undo" ${H.history.length ? '' : 'disabled'}>↶ ${esc(t('undo'))}</button>
              <button class="btn ghost small" data-act="new-game">${esc(t('newGame'))}</button>
            </div>` : ''}
        </div>
      </section>
      <aside class="side-col">
        <div class="side-box">${renderPlayers()}</div>
        <div class="side-box">${renderLog(v)}</div>
      </aside>
    </div>
  </div>`;
}

function renderScoreboard(v) {
  const center = v.winner
    ? `<div class="turn win team-${v.winner}">🏆 ${esc(t('wins', { team: teamName(v.winner) }))}</div>`
    : `<div class="turn team-${v.turn}">${esc(t('turn', { team: teamName(v.turn) }))}</div>`;
  const pill = (team) => `<div class="score team-${team} ${v.turn === team && !v.winner ? 'active' : ''}">
      <span class="score-name">${esc(teamName(team))}</span>
      <span class="score-num">${v.remaining[team]}</span>
      <span class="score-left">${esc(t('left'))}</span></div>`;
  return `<div class="scoreboard">${pill('red')}${center}${pill('blue')}</div>`;
}

function renderClueBar(v) {
  if (v.winner) {
    const reason = v.winReason === 'assassin' ? t('assassinHit', { team: teamName(v.winner === 'red' ? 'blue' : 'red') }) : t('allFound', { team: teamName(v.winner) });
    return `<div class="cluebar">${esc(reason)}</div>`;
  }
  if (!v.clue) return `<div class="cluebar muted">${esc(t('noClue'))}</div>`;
  const guesses = v.guessesLeft === null ? t('guessesUnlimited') : t('guessesLeft', { n: v.guessesLeft });
  return `<div class="cluebar team-${v.clue.team}">
    <span class="clue-label">${esc(t('clue'))}</span>
    <span class="clue-word">${esc(v.clue.word)}</span>
    <span class="clue-num">${v.clue.number === null ? '∞' : v.clue.number}</span>
    <span class="clue-guesses">${esc(guesses)}</span></div>`;
}

const KIND_ICON = { red: '🔥', blue: '🌊', neutral: '🍃', assassin: '💀' };

function renderCard(v, w, i) {
  const [main, sub] = cardNames(w);
  const revealed = v.revealed[i];
  const kind = v.key[i];
  const len = main.length;
  const size = len > 13 ? 'xxs' : len > 10 ? 'xs' : len > 7 ? 'sm' : '';
  const classes = ['card', size, revealed ? `revealed kind-${kind}` : kind ? `key-${kind}` : '', S.pending === i ? 'pending' : ''];
  const series = prefs.showSeries && w.series ? `<span class="card-series">${esc(seriesLabel(w.series))}</span>` : '';
  return `<button class="${classes.join(' ')}" data-card="${i}" ${revealed ? 'aria-disabled="true"' : ''}>
    ${revealed ? `<span class="card-icon">${KIND_ICON[kind]}</span>` : ''}
    <span class="card-name">${esc(main)}</span>
    ${sub ? `<span class="card-sub">${esc(sub)}</span>` : ''}
    ${series}
    ${S.pending === i ? `<span class="confirm-tag">✓ ?</span>` : ''}
  </button>`;
}

function renderPlayers() {
  const byTeam = (team) =>
    S.players
      .filter((p) => p.team === team)
      .sort((a, b) => (a.role === b.role ? 0 : a.role === 'spymaster' ? -1 : 1))
      .map((p) => `<li class="${p.online ? '' : 'off'}">
        <span>${p.role === 'spymaster' ? '🕶️' : '🔍'}</span>
        <span class="pname">${esc(p.name)}</span>
        ${p.me ? `<em>(${esc(t('me'))})</em>` : ''}
        ${p.host ? `<em>· ${esc(t('host'))}</em>` : ''}
        ${p.online ? '' : `<em>· ${esc(t('offline'))}</em>`}
      </li>`)
      .join('');
  return `<h3>${esc(t('players'))}</h3>
    <div class="teams">
      ${TEAMS.map((tm) => `<div class="team-list team-${tm}"><h4>${esc(teamName(tm))}</h4><ul>${byTeam(tm) || '<li class="off">—</li>'}</ul></div>`).join('')}
    </div>`;
}

function renderLog(v) {
  const kindLabel = (k) => (k === 'red' || k === 'blue' ? teamName(k) : t(k));
  const items = v.log
    .slice(-40)
    .reverse()
    .map((e) => {
      if (e.type === 'new') return `<li>✨ ${esc(t('logNew'))}</li>`;
      const cls = `team-${e.team}`;
      if (e.type === 'clue') return `<li class="${cls}">🕶️ ${esc(t('logClue', { player: e.player, word: e.word, n: e.n }))}</li>`;
      if (e.type === 'end') return `<li class="${cls}">⏭️ ${esc(t('logEnd', { player: e.player }))}</li>`;
      if (e.type === 'reveal') {
        const w = v.words.find((x) => x.en === e.card) || { en: e.card };
        return `<li class="${cls}">${KIND_ICON[e.kind]} ${esc(t('logReveal', { player: e.player, card: cardNames(w)[0], kind: kindLabel(e.kind) }))}</li>`;
      }
      return '';
    })
    .join('');
  return `<h3>${esc(t('log'))}</h3><ul class="log">${items}</ul>`;
}

// ---------- modals ----------
function openModal(name) {
  S.modal = name;
  renderModal();
}

function closeModal() {
  S.modal = null;
  renderModal();
}

function renderModal() {
  if (!S.modal) {
    modalRoot.innerHTML = '';
    delete modalRoot.dataset.open;
    return;
  }
  // Don't wipe a form someone is filling in when a network update re-renders the page.
  if (modalRoot.dataset.open === S.modal && (S.modal === 'settings' || S.modal === 'profile')) return;
  modalRoot.dataset.open = S.modal;
  let body = '';
  if (S.modal === 'rules') body = `<h2>${esc(t('rules'))}</h2><div class="rules">${t('rulesBody')}</div>`;
  if (S.modal === 'invite') body = renderInvite();
  if (S.modal === 'players') body = renderPlayers();
  if (S.modal === 'profile') body = renderProfileModal();
  if (S.modal === 'settings') body = renderSettings();
  if (S.modal === 'win') body = renderWin();
  modalRoot.innerHTML = `<div class="modal-backdrop" data-act="close-modal">
    <div class="modal" role="dialog" aria-modal="true">
      <button class="modal-x" data-act="close-modal" aria-label="${esc(t('close'))}">✕</button>
      ${body}
    </div></div>`;
  if (S.modal === 'settings') updatePoolCount();
}

function refreshModal() {
  delete modalRoot.dataset.open;
  renderModal();
}

function renderInvite() {
  const url = roomUrl(S.code);
  let qr = '';
  if (typeof window.qrcode === 'function') {
    const q = window.qrcode(0, 'M');
    q.addData(url);
    q.make();
    qr = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }
  return `<h2>${esc(t('invite'))}</h2>
    <div class="invite">
      <div class="code-big">${esc(S.code)}</div>
      <div class="qr">${qr}</div>
      <div class="invite-link"><input id="invite-url" readonly value="${esc(url)}"><button class="btn primary" data-act="copy-link">${esc(t('copyLink'))}</button></div>
      <p class="muted">${esc(t('inviteHint'))}</p>
    </div>`;
}

function renderProfileModal() {
  return `<h2>${esc(t('changeRole'))}</h2>
    <form id="profile-modal-form">
      <label class="field"><span>${esc(t('yourName'))}</span><input id="pm-name" maxlength="24" required value="${esc(prefs.name)}"></label>
      <div class="field"><span>${esc(t('team'))}</span>${teamPicker(S.draftTeam ?? prefs.team)}</div>
      <div class="field"><span>${esc(t('role'))}</span>${rolePicker(S.draftRole ?? prefs.role)}</div>
      <button class="btn primary big" type="submit">${esc(t('continue'))}</button>
    </form>`;
}

function renderWin() {
  const v = S.view;
  return `<div class="win-modal team-${v.winner}">
    <div class="win-emoji">🏆</div>
    <h2>${esc(t('wins', { team: teamName(v.winner) }))}</h2>
    ${renderClueBar(v)}
    ${S.isHost ? `<button class="btn primary big" data-act="new-game-now">${esc(t('newGame'))}</button>` : ''}
  </div>`;
}

function maybeShowWin() {
  const v = S.view;
  if (S.screen !== 'game' || !v?.winner || S.shownWinFor === v.id) return;
  S.shownWinFor = v.id;
  openModal('win');
}

function renderSettings() {
  const personal = `
    <h2>${esc(t('settings'))}</h2>
    <div class="field"><span>${esc(t('language'))}</span>
      <div class="seg">${Object.entries(LANGUAGES).map(([k, v]) => `<button type="button" class="${k === getLanguage() ? 'on' : ''}" data-set-lang="${k}">${v}</button>`).join('')}</div></div>
    <div class="field"><span>${esc(t('display'))}</span>
      <div class="seg">${['en', 'ja', 'both'].map((d) => `<button type="button" class="${prefs.display === d ? 'on' : ''}" data-set-display="${d}">${esc(t('display' + d[0].toUpperCase() + d.slice(1)))}</button>`).join('')}</div></div>
    <label class="check"><input type="checkbox" id="show-series" ${prefs.showSeries ? 'checked' : ''}> ${esc(t('showSeries'))}</label>`;
  if (!S.isHost) return personal;

  const st = H.settings;
  const enabled = new Set(st.series);
  const cats = CATEGORIES.map((cat) => {
    const list = SERIES.filter((s) => s.category === cat);
    return `<div class="cat">
      <div class="cat-head"><b>${esc(t(cat))}</b>
        <button type="button" class="link" data-cat-all="${cat}">${esc(t('all'))}</button>
        <button type="button" class="link" data-cat-none="${cat}">${esc(t('none'))}</button></div>
      <div class="chips">${list.map((s) => `<label class="chip"><input type="checkbox" name="series" value="${s.id}" ${enabled.has(s.id) ? 'checked' : ''}><span>${esc(getLanguage() === 'ja' ? s.ja : s.name)} <small>${s.chars.length}</small></span></label>`).join('')}</div>
    </div>`;
  }).join('');

  return `${personal}
    <hr>
    <form id="host-settings">
      <h3>${esc(t('gameSettings'))}</h3>
      <div class="field"><span>${esc(t('teamNames'))}</span>
        <div class="two-inputs">
          <input id="tn-red" class="team-red" maxlength="20" placeholder="${esc(t('red'))}" value="${esc(st.teamNames.red)}">
          <input id="tn-blue" class="team-blue" maxlength="20" placeholder="${esc(t('blue'))}" value="${esc(st.teamNames.blue)}">
        </div></div>
      <label class="check"><input type="checkbox" id="anyone-tap" ${st.anyoneCanTap ? 'checked' : ''}> ${esc(t('anyoneCanTap'))}</label>
      <div class="field"><span>${esc(t('seriesPool'))}</span>${cats}</div>
      <div class="field"><span>${esc(t('custom'))}</span>
        <textarea id="custom-words" rows="4" placeholder="Rimuru | リムル&#10;Ainz | アインズ">${esc(st.custom)}</textarea>
        <small class="muted">${esc(t('customHint'))}</small></div>
      <label class="check"><input type="checkbox" id="custom-only" ${st.customOnly ? 'checked' : ''}> ${esc(t('customOnly'))}</label>
      <p id="pool-count" class="pool-count"></p>
      <div class="row-btns">
        <button type="button" class="btn" data-act="save-settings">${esc(t('save'))}</button>
        <button type="submit" class="btn primary" id="save-new">${esc(t('saveAndNew'))}</button>
      </div>
    </form>`;
}

function readHostSettings() {
  const f = document.getElementById('host-settings');
  if (!f) return null;
  return {
    teamNames: { red: f.querySelector('#tn-red').value.trim(), blue: f.querySelector('#tn-blue').value.trim() },
    anyoneCanTap: f.querySelector('#anyone-tap').checked,
    series: [...f.querySelectorAll('input[name=series]:checked')].map((el) => el.value),
    custom: f.querySelector('#custom-words').value,
    customOnly: f.querySelector('#custom-only').checked,
  };
}

function updatePoolCount() {
  const st = readHostSettings();
  if (!st) return;
  const n = buildPool(st).length;
  const el = document.getElementById('pool-count');
  el.textContent = n < BOARD_SIZE ? `${t('poolCount', { n })} — ${t('poolTooSmall')}` : t('poolCount', { n });
  el.classList.toggle('bad', n < BOARD_SIZE);
  document.getElementById('save-new').disabled = n < BOARD_SIZE;
}

function saveHostSettings(startNew) {
  const st = readHostSettings();
  if (!st) return;
  H.settings = st;
  hostSave();
  if (startNew) hostNewGame();
  else hostBroadcast();
  closeModal();
}

// ---------- events ----------
function onCardTap(i) {
  const v = S.view;
  if (!v || v.winner || v.revealed[i]) return;
  const self = S.players.find((p) => p.me) || me();
  if (!S.pub.anyoneCanTap) {
    if (self.role === 'spymaster') return toast(t('spymasterCannotTap'));
    if (self.team !== v.turn) return toast(t('notYourTurn'));
  }
  // Two taps to reveal, so a slip of the thumb doesn't cost a turn.
  if (S.pending !== i) {
    S.pending = i;
    return render();
  }
  S.pending = null;
  act({ type: 'reveal', index: i });
}

document.addEventListener('click', (e) => {
  const card = e.target.closest('[data-card]');
  if (card && app.contains(card)) return onCardTap(Number(card.dataset.card));

  const pickTeam = e.target.closest('[data-pick-team]');
  if (pickTeam) {
    const team = pickTeam.dataset.pickTeam;
    if (S.modal === 'profile') {
      S.draftTeam = team;
      refreshModalKeepingName();
    } else {
      prefs.team = team;
      savePrefs();
      render();
    }
    return;
  }
  const pickRole = e.target.closest('[data-pick-role]');
  if (pickRole) {
    const role = pickRole.dataset.pickRole;
    if (S.modal === 'profile') {
      S.draftRole = role;
      refreshModalKeepingName();
    } else {
      prefs.role = role;
      savePrefs();
      render();
    }
    return;
  }

  const langBtn = e.target.closest('[data-set-lang]');
  if (langBtn) return changeLanguage(langBtn.dataset.setLang);
  const dispBtn = e.target.closest('[data-set-display]');
  if (dispBtn) {
    prefs.display = dispBtn.dataset.setDisplay;
    savePrefs();
    render();
    return refreshSettingsKeepingDraft();
  }
  const catAll = e.target.closest('[data-cat-all], [data-cat-none]');
  if (catAll) {
    const on = !!catAll.dataset.catAll;
    const cat = catAll.dataset.catAll || catAll.dataset.catNone;
    const ids = new Set(SERIES.filter((s) => s.category === cat).map((s) => s.id));
    document.querySelectorAll('input[name=series]').forEach((el) => {
      if (ids.has(el.value)) el.checked = on;
    });
    return updatePoolCount();
  }

  const btn = e.target.closest('[data-act]');
  if (!btn) {
    if (S.pending !== null && !e.target.closest('.board')) {
      S.pending = null;
      render();
    }
    return;
  }
  const a = btn.dataset.act;
  if (a === 'close-modal') {
    if (e.target !== btn && !e.target.closest('.modal-x')) return; // clicks inside the dialog
    S.draftTeam = S.draftRole = undefined;
    return closeModal();
  }
  if (a === 'create') {
    S.intent = 'create';
    S.screen = 'profile';
    return render();
  }
  if (a === 'resume') return startHosting(store.get('acn-host'));
  if (a === 'back' || a === 'home') return leaveGame();
  if (a === 'rules') return openModal('rules');
  if (a === 'invite') return openModal('invite');
  if (a === 'players') return openModal('players');
  if (a === 'settings') return openModal('settings');
  if (a === 'profile') {
    S.draftTeam = S.draftRole = undefined;
    return openModal('profile');
  }
  if (a === 'end-turn') return act({ type: 'endTurn' });
  if (a === 'undo') return hostUndo();
  if (a === 'new-game') {
    if (confirm(t('confirmNewGame'))) hostNewGame();
    return;
  }
  if (a === 'new-game-now') {
    closeModal();
    return hostNewGame();
  }
  if (a === 'save-settings') return saveHostSettings(false);
  if (a === 'copy-link') {
    const url = roomUrl(S.code);
    const done = () => {
      btn.textContent = t('copied');
      setTimeout(() => (btn.textContent = t('copyLink')), 1500);
    };
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      navigator.share({ title: 'Anime Codenames', url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(done, () => document.getElementById('invite-url').select());
    } else {
      document.getElementById('invite-url').select();
    }
  }
});

function refreshModalKeepingName() {
  const name = document.getElementById('pm-name')?.value;
  refreshModal();
  if (name !== undefined) document.getElementById('pm-name').value = name;
}

function refreshSettingsKeepingDraft() {
  if (S.modal !== 'settings') return;
  const draft = readHostSettings();
  const saved = H?.settings;
  if (draft && H) H.settings = draft;
  refreshModal();
  if (draft && H) H.settings = saved;
}

function changeLanguage(lang) {
  prefs.lang = lang;
  savePrefs();
  setLanguage(lang);
  render();
  refreshSettingsKeepingDraft();
}

document.addEventListener('change', (e) => {
  if (e.target.id === 'lang') return changeLanguage(e.target.value);
  if (e.target.id === 'show-series') {
    prefs.showSeries = e.target.checked;
    savePrefs();
    return render();
  }
  if (e.target.closest('#host-settings')) updatePoolCount();
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'code-input') e.target.value = normalizeCode(e.target.value);
  if (e.target.id === 'custom-words') updatePoolCount();
});

document.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'join-form') {
    const code = normalizeCode(f.querySelector('#code-input').value);
    if (code.length !== 4) return f.querySelector('#code-input').focus();
    S.intent = 'join';
    S.code = code;
    S.screen = 'profile';
    return render();
  }
  if (f.id === 'profile-form') {
    prefs.name = f.querySelector('#name-input').value.trim().slice(0, 24);
    if (!prefs.name) return;
    savePrefs();
    if (S.intent === 'create') return startHosting(null);
    return startJoining(S.code);
  }
  if (f.id === 'profile-modal-form') {
    const name = f.querySelector('#pm-name').value.trim().slice(0, 24);
    if (!name) return;
    const role = S.draftRole ?? prefs.role;
    const becomingSpy = role === 'spymaster' && prefs.role !== 'spymaster';
    if (becomingSpy && S.view && !S.view.winner && !confirm(t('confirmSpymaster'))) return;
    prefs.name = name;
    prefs.team = S.draftTeam ?? prefs.team;
    prefs.role = role;
    S.draftTeam = S.draftRole = undefined;
    savePrefs();
    closeModal();
    return send({ type: 'profile', ...me() });
  }
  if (f.id === 'clue-form') {
    const word = f.querySelector('#clue-word').value.trim();
    if (!word) return f.querySelector('#clue-word').focus();
    const num = f.querySelector('#clue-num').value;
    f.querySelector('#clue-word').value = '';
    return act({ type: 'clue', word, number: num === 'inf' ? null : Number(num) });
  }
  if (f.id === 'host-settings') return saveHostSettings(true);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.modal) closeModal();
});

// ---------- boot ----------
const roomParam = normalizeCode(new URLSearchParams(location.search).get('room'));
const savedHost = store.get('acn-host');
if (roomParam && savedHost?.code === roomParam && savedHost.players?.[pid]?.host) {
  startHosting(savedHost);
} else if (roomParam.length === 4) {
  S.intent = 'join';
  S.code = roomParam;
  S.screen = 'profile';
  render();
} else {
  render();
}
