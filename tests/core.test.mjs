import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectPool, StateMachine, movementVector, createProfile } from '../src/core.js';

test('El pool mantiene capacidad, reinicia objetos y rechaza doble liberación', () => {
  let created = 0;
  const pool = new ObjectPool(2, () => ({ id: ++created, life: 0 }), item => { item.life = 0; });
  const a = pool.acquire(), b = pool.acquire(); a.life = 10;
  assert.equal(pool.acquire(), null); assert.equal(created, 2);
  assert.equal(pool.release(a), true); assert.equal(pool.release(a), false);
  assert.equal(pool.acquire(), a); assert.equal(a.life, 0);
  pool.releaseAll(); assert.equal(pool.active.size, 0); assert.equal(pool.free.length, 2);
  assert.ok(b);
});
test('Pausa y respawn usan transiciones válidas; no se salta el login', () => {
  const events = []; const state = new StateMachine(next => events.push(next));
  assert.throws(() => state.set('playing'));
  for (const next of ['login','menu','playing','paused','playing','dead','playing','menu','login']) state.set(next);
  assert.equal(events.length, 9); assert.equal(state.value, 'login');
});
test('Diagonal no acelera al jugador y yaw transforma adelante', () => {
  const out = {};
  movementVector(1, -1, 0, out); assert.ok(Math.abs(Math.hypot(out.x, out.z) - 1) < 1e-12);
  movementVector(0, -1, Math.PI / 2, out); assert.ok(Math.abs(out.x + 1) < 1e-12); assert.ok(Math.abs(out.z) < 1e-12);
  movementVector(0, 0, 1, out); assert.deepEqual(out, { x: 0, z: 0 });
});
test('Perfiles nuevos no comparten arrays ni estadísticas', () => {
  const a = createProfile('A'), b = createProfile('B');
  a.stats.kills++; a.unlockedCharacters.push('test');
  assert.equal(b.stats.kills, 0); assert.deepEqual(b.unlockedCharacters, ['action-commando']);
});
