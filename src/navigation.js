/** Campos de distancia BFS reutilizables. Cada bot sigue el gradiente de una
 * cuadrícula de navegación, evitando atascarse detrás de muebles o torres.
 * No se ejecuta A* por bot y por frame: todos comparten los campos de destino.
 */
export class Navigation {
  constructor(size, cell, blocked) {
    this.size = size; this.cell = cell; this.n = Math.floor(size / cell);
    this.walkable = new Uint8Array(this.n * this.n);
    this.queue = new Int32Array(this.walkable.length);
    for (let z = 0; z < this.n; z++) for (let x = 0; x < this.n; x++)
      this.walkable[z * this.n + x] = blocked(this.coordinate(x), this.coordinate(z)) ? 0 : 1;
  }
  coordinate(i) { return (i + .5) * this.cell - this.size / 2; }
  index(x, z) {
    const ix = Math.max(0, Math.min(this.n - 1, Math.floor((x + this.size / 2) / this.cell)));
    const iz = Math.max(0, Math.min(this.n - 1, Math.floor((z + this.size / 2) / this.cell)));
    return iz * this.n + ix;
  }
  field() { return new Int32Array(this.walkable.length).fill(-1); }
  fill(field, x, z) {
    field.fill(-1);
    let source = this.index(x, z);
    if (!this.walkable[source]) {
      let best = Infinity;
      for (let i = 0; i < field.length; i++) if (this.walkable[i]) {
        const dx = this.coordinate(i % this.n) - x, dz = this.coordinate(Math.floor(i / this.n)) - z;
        const d = dx * dx + dz * dz;
        if (d < best) { source = i; best = d; }
      }
    }
    let head = 0, tail = 0; this.queue[tail++] = source; field[source] = 0;
    const visit = (to, distance) => {
      if (this.walkable[to] && field[to] === -1) { field[to] = distance; this.queue[tail++] = to; }
    };
    while (head < tail) {
      const at = this.queue[head++], cx = at % this.n, cz = Math.floor(at / this.n), next = field[at] + 1;
      if (cx > 0) visit(at - 1, next);
      if (cx < this.n - 1) visit(at + 1, next);
      if (cz > 0) visit(at - this.n, next);
      if (cz < this.n - 1) visit(at + this.n, next);
    }
    return field;
  }
  direction(field, x, z, out) {
    const at = this.index(x, z), cx = at % this.n, cz = Math.floor(at / this.n);
    let best = at, cost = field[at] < 0 ? Infinity : field[at];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= this.n || nz >= this.n || !(dx || dz)) continue;
      if (dx && dz && (!this.walkable[cz * this.n + nx] || !this.walkable[nz * this.n + cx])) continue;
      const i = nz * this.n + nx;
      if (field[i] >= 0 && field[i] < cost) { best = i; cost = field[i]; }
    }
    out.x = this.coordinate(best % this.n) - x;
    out.z = this.coordinate(Math.floor(best / this.n)) - z;
    const length = Math.hypot(out.x, out.z);
    if (length > .05) { out.x /= length; out.z /= length; } else { out.x = out.z = 0; }
    return out;
  }
}

/** Segmento horizontal contra las coberturas: la misma prueba se usa para
 * visión y fuego de bots, por lo que no atacan a través de libros y paredes.
 */
export function clearSight(a, b, obstacles, height = 1.4) {
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const o of obstacles) {
    if (o.h < height) continue;
    let lo = 0, hi = 1;
    for (let axis=0;axis<2;axis++) {
      const p=axis?a.z:a.x,d=axis?dz:dx,min=axis?o.z-o.d/2:o.x-o.w/2,max=axis?o.z+o.d/2:o.x+o.w/2;
      if (Math.abs(d) < 1e-8) { if (p < min || p > max) { lo = 2; break; } }
      else { const t1=(min-p)/d, t2=(max-p)/d; lo=Math.max(lo,Math.min(t1,t2)); hi=Math.min(hi,Math.max(t1,t2)); }
    }
    if (lo <= hi && hi >= .02 && lo <= .98) return false;
  }
  return true;
}
