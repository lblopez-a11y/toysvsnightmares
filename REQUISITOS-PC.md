# Requisitos orientativos · v0.5

Objetivo: 60 FPS con materiales PBR, sombras, partículas y hasta 24 actores activos (20 enemigos, 3 aliados y el jugador). Son estimaciones de ingeniería, no requisitos certificados mediante pruebas en cada GPU. No constituyen una garantía de 60 FPS estables en todos los mapas, resoluciones o navegadores.

| Componente | Mínimo estimado para apuntar a 60 FPS | Recomendado para mayor margen |
|---|---|---|
| Resolución de la ventana | 1280 × 720, escala de pantalla 100% | 1920 × 1080, escala 100% |
| CPU | Core i5-8400 / Ryzen 3 3100 o equivalente | Core i5-12400 / Ryzen 5 5600 o equivalente |
| GPU | GTX 1650 / RX 570, 4 GB de VRAM | RTX 2060 / RX 6600 o superior |
| RAM | 8 GB | 16 GB |
| Sistema | Windows de 64 bits con controlador gráfico compatible | Windows 11 de 64 bits, controladores actualizados |
| Navegador | Chrome, Edge o Firefox con WebGL2 y aceleración por hardware | Ventana independiente, sin otras aplicaciones usando intensamente la GPU |
| Servidor local | Node.js 20 o superior | Igual; no necesita una base de datos |
| Red | Internet al cargar Three.js y las fuentes desde CDN | Igual; el combate y el guardado son locales |

No se ha validado una GPU integrada como mínimo para 60 FPS. 4K, varias ventanas 3D o escalado alto de pantalla aumentan el coste. El motor limita la densidad de render a 1,5×; reducir el tamaño de la ventana disminuye la carga. La compilación inicial de shaders puede producir pausas y no debe confundirse con el rendimiento sostenido.

## Límites y optimizaciones

- 12 actores en PvP 6v6; hasta 24 en horda. Los pools reservan capacidad adicional para reutilizar actores y efectos.
- Geometrías y materiales compartidos; piezas estáticas de cada articulación fusionadas por material. Los brazos, piernas, alas y armas conservan su animación independiente.
- Reflejos de entorno precalculados una vez con PMREM, sin ray tracing ni reflejos dinámicos de pantalla.
- Una sombra direccional de 2048² en partida y un foco de 1024² en el lobby. Las seis luces puntuales de fogonazo no proyectan sombras y mantienen intensidad cero cuando están inactivas.
- 384 partículas, 96 proyectiles y 64 trazadoras como máximos reutilizables. Los rayos de navegación consultan volúmenes simples, no los modelos detallados.
- Navegación por campos de distancia, tres sensores de 2,5 m y comprobación de atasco cada 0,6 s. La recuperación no teletransporta ni atraviesa paredes; un destino completamente cerrado sigue siendo inaccesible.

## Cómo comprobar el equipo

Con `npm start` activo, abre `http://localhost:4173/tests/showcase.html` en una ventana independiente. «Simular horda máxima» crea una oleada de 20 enemigos y 3 aliados. El contador muestra cuántos siguen vivos, el FPS medio, el percentil 95 del tiempo entre cuadros, llamadas de dibujo y triángulos. Espera a que termine la carga inicial; compara ventanas de al menos 600 muestras con la misma resolución y número de actores. La cámara de prueba ve gran parte del mapa, no sustituye una partida completa ni un perfil de GPU.

Para sostener 60 FPS, los cuadros deben acercarse a 16,67 ms y evitar picos frecuentes. Un promedio de 60 FPS por sí solo no certifica estabilidad. Verifica también combate cercano, lluvia y explosiones. Pointer Lock y ADS con el ratón deben probarse fuera de la vista previa de ChatGPT/Codex.

## Resultado de la revisión del 6 de octubre de 2026

23 pruebas automáticas y 22 grupos de integración aprobados. La galería con cuatro modelos mostró aproximadamente 60 FPS; una lectura de la horda panorámica mostró 55 FPS medios y p95 de 33,3 ms (600 muestras), con 10 enemigos vivos y 3 aliados en ese momento. La escena comienza con 20 enemigos; las bajas cambian la carga durante la medición. Máximos registrados en esa ejecución: 680 llamadas de dibujo y 205.690 triángulos. Ventana de 1280 × 720 y buffer de render de 1600 × 900, dentro del visor integrado. No se identificó el modelo de GPU/CPU y la sesión de revisión no fue un benchmark de hardware controlado. Estos datos no certifican 60 FPS sostenidos ni validan las configuraciones estimadas de la tabla.
