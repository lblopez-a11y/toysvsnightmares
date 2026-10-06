// Configuración pública de la app web Firebase (NO usar claves de Admin SDK).
export const firebaseConfig = {
  apiKey: 'AIzaSyDKnC90o-0gRRr54sp8Pq-nVEBSsdxCYUk',
  authDomain: 'toys-vs-nightmares.firebaseapp.com',
  projectId: 'toys-vs-nightmares',
  storageBucket: 'toys-vs-nightmares.firebasestorage.app',
  messagingSenderId: '938115041601',
  appId: '1:938115041601:web:00d82c949b5d5de4e839c0',
};

export const GAME = Object.freeze({
  worldSize: 240, speed: 10, sprintMultiplier: 1.65, gravity: 25,
  jumpSpeed: 10, playerRadius: 0.5, fixedStep: 1 / 60,
  maxFrameDelta: 0.1, maxPixelRatio: 1.5, sensitivity: 0.0022,
});

/* REQUISITOS PC v0.5 — OBJETIVO 60 FPS, ESTIMACIONES NO CERTIFICADAS.
 * Mínimo orientativo (ventana 720p): i5-8400 / Ryzen 3 3100, GTX 1650 / RX 570
 * con 4 GB VRAM, 8 GB RAM, navegador WebGL2 con aceleración por hardware.
 * Recomendado (1080p): i5-12400 / Ryzen 5 5600, RTX 2060 / RX 6600, 16 GB RAM.
 * Máximo: 24 actores, 6 luces de fogonazo sin sombras, 384 partículas,
 * 96 proyectiles. PBR + PMREM y sombra direccional 2048²; pixel ratio <= 1.5.
 * Node 20+ para servidor local. Internet para Three.js/fuentes al cargar.
 * No se garantizan 60 FPS sin medir hardware, temperatura y p95 de cuadros.
 * Compilación inicial de shaders puede causar pausas. Ver REQUISITOS-PC.md.
 */
