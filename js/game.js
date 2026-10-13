// Pure game rules. No DOM, no network — the host runs these and broadcasts the result.
import { SERIES } from './characters.js';

export const TEAMS = ['red', 'blue'];
export const BOARD_SIZE = 25;

export function otherTeam(team) {
  return team === 'red' ? 'blue' : 'red';
}

function randomInt(n) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % n;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function defaultSettings() {
  return {
    teamNames: { red: '', blue: '' },
    anyoneCanTap: false,
    series: SERIES.map((s) => s.id),
    custom: '',
    customOnly: false,
  };
}

export function parseCustom(text) {
  return (text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [en, ja] = line.split('|').map((s) => s.trim());
      return { en: en.slice(0, 30), ja: (ja || '').slice(0, 30), series: '' };
    })
    .filter((c) => c.en);
}

// Every character the next game can draw from, de-duplicated by English name.
export function buildPool(settings) {
  const pool = [];
  if (!settings.customOnly) {
    const enabled = new Set(settings.series);
    for (const s of SERIES) {
      if (!enabled.has(s.id)) continue;
      for (const [en, ja] of s.chars) pool.push({ en, ja, series: s.id });
    }
  }
  pool.push(...parseCustom(settings.custom));
  const seen = new Set();
  return pool.filter((c) => {
    const k = c.en.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function newGame(pool) {
  if (pool.length < BOARD_SIZE) throw new Error('pool too small');
  const startTeam = TEAMS[randomInt(2)];
  const key = shuffle([
    ...Array(9).fill(startTeam),
    ...Array(8).fill(otherTeam(startTeam)),
    ...Array(7).fill('neutral'),
    'assassin',
  ]);
  return {
    id: Math.random().toString(36).slice(2, 10),
    words: shuffle(pool).slice(0, BOARD_SIZE),
    key,
    revealed: Array(BOARD_SIZE).fill(false),
    startTeam,
    turn: startTeam,
    clue: null,
    guessesLeft: null,
    winner: null,
    winReason: null,
    log: [{ type: 'new' }],
  };
}

export function remaining(game, team) {
  return game.key.filter((k, i) => k === team && !game.revealed[i]).length;
}

function canGuess(game, player, settings) {
  if (game.winner) return 'over';
  if (settings.anyoneCanTap) return null;
  if (!player) return 'notYourTurn';
  if (player.team !== game.turn) return 'notYourTurn';
  if (player.role === 'spymaster') return 'spymasterCannotTap';
  return null;
}

function passTurn(game) {
  game.turn = otherTeam(game.turn);
  game.clue = null;
  game.guessesLeft = null;
}

// Applies one action to a copy of the game. Returns { game } or { error }.
export function applyAction(prev, action, player, settings) {
  const game = structuredClone(prev);
  const who = player?.name || '?';

  if (action.type === 'reveal') {
    const err = canGuess(game, player, settings);
    if (err) return { error: err };
    const i = action.index;
    if (!Number.isInteger(i) || i < 0 || i >= BOARD_SIZE || game.revealed[i]) return { error: 'invalid' };
    game.revealed[i] = true;
    const kind = game.key[i];
    game.log.push({ type: 'reveal', player: who, card: game.words[i].en, kind, team: game.turn });

    if (kind === 'assassin') {
      game.winner = otherTeam(game.turn);
      game.winReason = 'assassin';
      return { game };
    }
    for (const team of TEAMS) {
      if (remaining(game, team) === 0) {
        game.winner = team;
        game.winReason = 'all';
        return { game };
      }
    }
    if (kind !== game.turn) {
      passTurn(game);
    } else if (game.guessesLeft !== null) {
      game.guessesLeft -= 1;
      if (game.guessesLeft <= 0) passTurn(game);
    }
    return { game };
  }

  if (action.type === 'clue') {
    if (game.winner) return { error: 'over' };
    if (!settings.anyoneCanTap && (player?.role !== 'spymaster' || player.team !== game.turn)) {
      return { error: 'notYourTurn' };
    }
    const word = String(action.word || '').trim().slice(0, 40);
    if (!word) return { error: 'invalid' };
    const n = action.number === null ? null : Math.max(0, Math.min(9, parseInt(action.number, 10) || 0));
    game.clue = { word, number: n, team: game.turn };
    game.guessesLeft = n === null || n === 0 ? null : n + 1;
    game.log.push({ type: 'clue', player: who, word, n: n === null ? '∞' : n, team: game.turn });
    return { game };
  }

  if (action.type === 'endTurn') {
    if (game.winner) return { error: 'over' };
    if (!settings.anyoneCanTap && player?.team !== game.turn) return { error: 'notYourTurn' };
    game.log.push({ type: 'end', player: who, team: game.turn });
    passTurn(game);
    return { game };
  }

  return { error: 'invalid' };
}

// What one viewer is allowed to see. Operatives never receive unrevealed key colors.
export function viewFor(game, seesKey) {
  const showAll = seesKey || !!game.winner;
  return {
    ...game,
    key: game.key.map((k, i) => (showAll || game.revealed[i] ? k : null)),
    remaining: { red: remaining(game, 'red'), blue: remaining(game, 'blue') },
  };
}
