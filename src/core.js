/** Pool acotado: reserva todo al construir; acquire() nunca crea objetos.
 * Si está lleno devuelve null. El sistema consumidor decide omitir el efecto.
 * Usado por las balas, partículas, trazadoras y enemigos del combate.
 */
export class ObjectPool {
  constructor(capacity, factory, reset = () => {}) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('Capacidad inválida');
    this.items = Array.from({ length: capacity }, (_, i) => factory(i));
    this.free = this.items.slice();
    this.active = new Set();
    this.reset = reset;
  }
  acquire() {
    const item = this.free.pop();
    if (item === undefined) return null;
    this.active.add(item);
    return item;
  }
  release(item) {
    if (!this.active.has(item)) return false;
    this.reset(item);
    this.active.delete(item);
    this.free.push(item);
    return true;
  }
  releaseAll() { for (const item of this.active) this.release(item); }
}

const transitions = {
  loading: ['login', 'error'], login: ['menu', 'error'],
  ready:['playing','menu','error'], menu: ['ready','playing', 'login', 'error'], playing: ['paused', 'dead', 'result', 'menu', 'error'],
  paused: ['playing', 'menu', 'login', 'error'], dead: ['playing', 'menu', 'error'], result: ['menu','error'], error: [],
};
export class StateMachine {
  constructor(onChange) { this.value = 'loading'; this.onChange = onChange; }
  set(next) {
    if (next === this.value) return;
    if (!transitions[this.value]?.includes(next)) throw new Error(`Transición inválida: ${this.value} → ${next}`);
    this.value = next;
    this.onChange(next);
  }
}

/** Normaliza diagonal y gira los ejes según yaw sin asignaciones por frame. */
export function movementVector(x, z, yaw, out) {
  const length = Math.hypot(x, z) || 1;
  x /= length; z /= length;
  out.x = x * Math.cos(yaw) + z * Math.sin(yaw);
  out.z = -x * Math.sin(yaw) + z * Math.cos(yaw);
  return out;
}

export function createProfile(name = 'Invitado') {
  return { displayName: name.slice(0, 60), level: 1, experience: 0,
    unlockedCharacters: ['action-commando'], selectedCharacter: 'action-commando',
    stats: { kills: 0, deaths: 0 } };
}
