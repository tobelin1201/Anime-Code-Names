import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPool, defaultSettings, newGame, applyAction, viewFor, remaining, parseCustom } from '../js/game.js';
import { SERIES } from '../js/characters.js';

const settings = defaultSettings();
const red = { name: 'R', team: 'red', role: 'operative' };
const blue = { name: 'B', team: 'blue', role: 'operative' };
const redSpy = { name: 'RS', team: 'red', role: 'spymaster' };

function gameStartingWith(team) {
  let g;
  do g = newGame(buildPool(settings));
  while (g.startTeam !== team);
  return g;
}
const indexOf = (g, kind, skip = 0) => g.key.map((k, i) => [k, i]).filter(([k]) => k === kind)[skip][1];

test('deck has unique English names', () => {
  const names = SERIES.flatMap((s) => s.chars.map((c) => c[0].toLowerCase()));
  assert.equal(new Set(names).size, names.length);
});

test('new game has the standard key layout', () => {
  const g = newGame(buildPool(settings));
  assert.equal(g.words.length, 25);
  assert.equal(new Set(g.words.map((w) => w.en)).size, 25);
  assert.equal(remaining(g, g.startTeam), 9);
  assert.equal(remaining(g, g.startTeam === 'red' ? 'blue' : 'red'), 8);
  assert.equal(g.key.filter((k) => k === 'neutral').length, 7);
  assert.equal(g.key.filter((k) => k === 'assassin').length, 1);
});

test('operatives never receive unrevealed key colors', () => {
  const g = newGame(buildPool(settings));
  assert.ok(viewFor(g, false).key.every((k) => k === null));
  assert.ok(viewFor(g, true).key.every((k) => k !== null));
});

test('only the current team operatives can reveal', () => {
  const g = gameStartingWith('red');
  assert.equal(applyAction(g, { type: 'reveal', index: 0 }, blue, settings).error, 'notYourTurn');
  assert.equal(applyAction(g, { type: 'reveal', index: 0 }, redSpy, settings).error, 'spymasterCannotTap');
  assert.ok(applyAction(g, { type: 'reveal', index: 0 }, red, settings).game);
  assert.ok(applyAction(g, { type: 'reveal', index: 0 }, blue, { ...settings, anyoneCanTap: true }).game);
});

test('guess limit is clue number + 1, wrong guess passes the turn', () => {
  let g = gameStartingWith('red');
  g = applyAction(g, { type: 'clue', word: 'Pirates', number: 1 }, redSpy, settings).game;
  assert.equal(g.guessesLeft, 2);
  g = applyAction(g, { type: 'reveal', index: indexOf(g, 'red', 0) }, red, settings).game;
  assert.equal(g.turn, 'red');
  g = applyAction(g, { type: 'reveal', index: indexOf(g, 'red', 1) }, red, settings).game;
  assert.equal(g.turn, 'blue');
  assert.equal(g.clue, null);
  g = applyAction(g, { type: 'reveal', index: indexOf(g, 'neutral') }, blue, settings).game;
  assert.equal(g.turn, 'red');
});

test('assassin loses immediately', () => {
  const g = gameStartingWith('red');
  const res = applyAction(g, { type: 'reveal', index: indexOf(g, 'assassin') }, red, settings).game;
  assert.equal(res.winner, 'blue');
  assert.equal(res.winReason, 'assassin');
  assert.ok(viewFor(res, false).key.every((k) => k !== null), 'key is shown to everyone after the game');
});

test('finding all your cards wins, even on the other team’s turn', () => {
  let g = gameStartingWith('red');
  const blues = g.key.map((k, i) => [k, i]).filter(([k]) => k === 'blue').map(([, i]) => i);
  for (const i of blues.slice(0, 7)) g.revealed[i] = true;
  g = applyAction(g, { type: 'reveal', index: blues[7] }, red, settings).game;
  assert.equal(g.winner, 'blue');
});

test('end turn passes to the other team', () => {
  const g = gameStartingWith('blue');
  assert.equal(applyAction(g, { type: 'endTurn' }, red, settings).error, 'notYourTurn');
  assert.equal(applyAction(g, { type: 'endTurn' }, blue, settings).game.turn, 'red');
});

test('custom characters parse and can make a whole deck', () => {
  assert.deepEqual(parseCustom('Rimuru | リムル\n\n  Ainz '), [
    { en: 'Rimuru', ja: 'リムル', series: '' },
    { en: 'Ainz', ja: '', series: '' },
  ]);
  const custom = Array.from({ length: 25 }, (_, i) => `Hero ${i}`).join('\n');
  assert.equal(buildPool({ ...settings, customOnly: true, custom }).length, 25);
  assert.equal(buildPool({ ...settings, series: [], custom: 'Goku' }).length, 1);
});
