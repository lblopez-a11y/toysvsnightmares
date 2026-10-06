# Toys vs. Nightmares · La guardia nocturna — v0.5

Prototipo jugable de escritorio en Three.js, HTML y CSS. Dos facciones, 12 personajes, tres modos, compañeros y rivales controlados por IA. Un jugador humano por partida; los demás puestos los ocupan bots.

## Abrir

Ejecuta `npm start` dentro de esta carpeta y abre **http://localhost:4173/**. Requiere Node.js 20+, WebGL2 y conexión para descargar Three.js y las fuentes desde CDN. No hace falta instalar paquetes para jugar localmente. Entra con **Jugar como invitado**, elige modo y pulsa **¡JUGAR!**. Antes de aparecer, selecciona **bando y héroe**, prepara el despliegue y pulsa **Entrar · Bloquear cursor**.

## Si el cursor no se bloquea

Si el bloqueo del cursor falla, abre «¿El cursor no se bloquea?» en el despliegue. Puedes descargar un acceso directo de Windows y abrirlo desde Descargas para salir del visor integrado, o copiar la dirección para pegarla en una ventana independiente. El mensaje conserva el detalle de error que entregue el navegador para diagnosticar rechazos fuera del visor. El acceso directo requiere que el servidor siga encendido.

## Cómo ganar

- **Conquista — 6 contra 6.** Las Pesadillas deben capturar El Escritorio, El Armario y La Cama, en ese orden. Entra al círculo y elimina a sus defensores: la zona disputada no acumula captura. Un atacante tarda 20 segundos en capturar; dos o más, 10 segundos. Los Juguetes ganan si se agotan los 4 minutos de un sector. Al caer una zona cambia el objetivo; ambos equipos parten de sus bases opuestas y el ambiente pasa gradualmente del día a la tormenta.
- **Baja confirmada — 4 contra 4 o 6 contra 6.** Elimina enemigos y recoge sus objetos para puntuar. Los Juguetes dejan Baterías Doradas y las Pesadillas, Núcleos de Sombra. Recuperar el objeto de un compañero deniega la baja. Gana el primer equipo con 35 confirmaciones. Los objetos desaparecen después de 25 segundos.
- **Cofre Central — de 1 a 4 juguetes.** Defiende el cofre de 1000 HP durante diez oleadas. Las oleadas 3, 6 y 9 incluyen un Titán gigante de 1000 HP. Entre oleadas tienes 20 segundos: compra +10% de daño por 150 puntos, +20 HP por 150 o repara 200 HP del cofre por 100. Cada mejora tiene un máximo de cinco compras. Una baja tuya da 50 puntos de oleada; una baja de un bot aliado, 25. Estos puntos solo duran esa partida.

El minimapa muestra equipos, objetivo y objetos. El marcador sobre el escenario indica la distancia a la zona activa o al cofre. Al morir puedes reaparecer con salud y munición completas; la simulación local se pausa en la pantalla de muerte y al abrir el menú de pausa.

## Controles

| Control | Acción |
|---|---|
| WASD | Moverse |
| Ratón | Girar la cámara con Pointer Lock |
| Mantener clic derecho | Apuntar (ADS): zoom 52°, precisión y movimiento 0,75× |
| Clic izquierdo o F | Usar el arma; mantener para disparo continuo |
| R | Recargar |
| Q / E / C | Habilidades 1, 2 y 3; las pasivas se aplican automáticamente |
| Shift / Espacio | Correr / saltar |
| Espacio / Ctrl durante vuelo | Subir / bajar con Sora |
| 1 / 2 / 3 entre oleadas | Comprar daño / vida / reparación |
| Esc | Pausar |

Sora carga el disparo al mantener clic/F y lo dispara al soltar. La cámara usa exclusivamente **Pointer Lock** sobre `document.body`; ya no existe el control con clic derecho. El visor integrado de Codex rechazó la captura durante la revisión: abre `http://localhost:4173/` directamente en Chrome, Edge o Firefox para jugar. La simulación espera el evento de bloqueo exitoso; un rechazo conserva el despliegue preparado para volver o reintentar. [Referencia de la API](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock). No hay controles táctiles.

## Cambios de la versión 0.5

- **Rediseño estilizado:** cuerpos redondeados y biselados, articulaciones, protecciones, visores, capas, armas de varias piezas y acabados diferenciados de plástico, metal, tela, baba y porcelana. Los modelos son originales y procedurales; «Roblox 2026» se interpreta como dirección visual, no como certificación o equivalencia con un motor externo.
- **Materiales e iluminación:** MeshStandardMaterial/MeshPhysicalMaterial, clearcoat, emisión, entorno de reflexión de estudio y sombras. Las auras tienen anillo y partículas orbitales; las habilidades activan un pulso adicional. Los disparos usan luces puntuales de 75 ms, con un máximo de seis simultáneas.
- **ADS:** mantener clic derecho interpola el FOV de 75° a 52°, reduce un 60% el radio de dispersión, aplica 0,45× al retroceso y 0,75× al movimiento. Durante ADS se desactiva el sprint. La cadencia, el daño y la munición no cambian. Soltar el botón o perder el bloqueo limpia ADS. La retícula ahora se dibuja en Canvas 2D y se cierra y afina al apuntar.
- **IA:** tres rayos frontales a 0° y ±30° detectan cobertura a menos de 2,5 m. Si un bot que intenta caminar avanza menos de 0,2 m por muestra de 0,6 s, acumula tiempo de atasco. Al superar 1,2 s, realiza un salto corto, evade lateralmente durante un segundo e invalida su ruta para recalcularla. Las colisiones siguen activas durante el salto.
- **Esbirros de horda:** Esbirro Sombrío, rápido, 40 HP y mordisco de 10; Glóbulo de Baba, lento, 60 HP y proyectil de lodo de 12. No tienen habilidades de héroe ni aparecen como personajes comprables. Solo las oleadas 3, 6 y 9 incluyen un Titán jefe de 1000 HP. El lodo daña el cofre cuando el proyectil llega, no instantáneamente.
- **Rendimiento:** consulta [REQUISITOS-PC.md](REQUISITOS-PC.md). Incluye mínimos y recomendados orientativos para el objetivo de 60 FPS, límites de la simulación y una página de medición reproducible.

## Cambios de la versión 0.4

- **Ajustes** en el menú principal y en pausa: slider que cambia `window.cameraSensitivity` inmediatamente y guarda el valor en este navegador. Rango 0,0004–0,008 radianes por píxel; inicial 0,0022. ESC cierra Ajustes sin reanudar la partida.
- **Despliegue previo:** selección de facción y héroe desbloqueado. En Cofre Central solo se habilitan Juguetes, según las reglas de la horda.
- **Bases opuestas y rutas:** más de 190 metros entre spawns, offsets laterales aleatorios y corredores izquierdo, central y derecho. Los bots rodean obstáculos, combaten al encontrar enemigos y retoman su avance.
- **Props agrupados:** edificios de cartón con solapas y ventanas, torres de bloques, crayones y libros-rampa que pueden recorrerse caminando.
- **Bomba de Capitán Espuma (Q):** esfera oscura con banda roja y mecha, lanzamiento parabólico, rebote y detonación a los 1,5 segundos. Aplica 40 de daño en 7 metros, empuja hasta 4 metros y genera fuego, humo y pintura ralentizadora. Las otras clases conservan su habilidad Q propia.
- **Daño flotante:** números rojos por impactos, amarillos por críticos de cabeza, con ascenso y desaparición. El daño continuo se agrupa para mantenerlo legible.
- **Regeneración:** tras cinco segundos sin daño, el jugador recupera 10 HP por segundo hasta su máximo. Un impacto, incluso absorbido por escudo, reinicia la espera. El tiempo se detiene durante la pausa.
- **Volver:** botones en personajes, modos, ajustes, despliegue, pausa, muerte y resultados. Desde resultados también puedes elegir bando para otra partida.

La imagen enviada se utilizó como referencia de composición y ambientación; los modelos continúan siendo procedurales. `tests/visual.html` permite revisar props y un fotograma de explosión en una simulación aislada, sin alterar partidas ni progreso.

## Personajes y progresión

El catálogo conserva las cifras individuales solicitadas, incluidas las excepciones a los rangos generales por clase.

| Personaje | Vida / velocidad | Desbloqueo |
|---|---|---|
| Capitán Espuma | 125 / 1,00× | Inicial |
| Dra. Felpa | 100 / 1,05× | Nivel 3 |
| Meca-Lego | 220 / 0,80× | 500 Monedas |
| Sora la Planeadora | 90 / 1,15× | Nivel 8 |
| Don Dinosaurio | 180 / 0,88× | 1200 Monedas |
| Chispita | 110 / 1,10× | 5 victorias como Juguete |
| Sombrío | 125 / 1,10× | Inicial |
| Gargajo de Baba | 240 / 0,75× | Nivel 3 |
| Espectro Ocular | 95 / 1,12× | 500 Esencias |
| Señor Costura | 110 / 1,00× | Nivel 10 |
| Titán de Porcelana | 250 / 0,70× | 1500 Esencias |
| Susurro | 100 / 1,15× | 10 victorias como Pesadilla |

Cada personaje tiene arma, tamaño de hitbox y tres habilidades propias. El panel Personajes permite previsualizar a los bloqueados y consultar estadísticas y habilidades antes de desbloquearlos. Los bots de PvP pueden usar todo el catálogo; la horda usa esbirros y reserva el Titán para las oleadas de jefe. el jugador debe cumplir los requisitos.

**Guardado local activo.** Al terminar una partida se guardan XP, divisas, estadísticas y desbloqueos en `localStorage`, bajo `tvn-v3-guest`. La selección y las compras se guardan inmediatamente. Cada 1000 XP subes un nivel, empezando en nivel 1. Jugar con Juguetes otorga Monedas; jugar con Pesadillas, Esencias. La pantalla de resultados muestra lo ganado.

Recompensas: 25 XP y 12 divisas por baja; 5 XP y 3 divisas por cada 20 HP de curación a aliados; 40 XP y 20 divisas por objetivo; más 300 XP y 150 divisas por victoria, o 75 XP y 35 por derrota. En Conquista, permanecer diez segundos en el círculo cuenta como objetivo. Los resultados repetidos no duplican recompensas. Abandonar o recargar una partida en curso no otorga sus recompensas. Borrar los datos del sitio borra este progreso; otros navegadores y puertos tienen almacenamiento separado.

## Escena y límites de esta versión

Mapa abierto de 240 × 240 con coberturas, escritorio/cuaderno, armario, cama, carreteras, ciudad de bloques, libros, lápices, canicas, dominó, portales y cofre. Los modos PvP usan el cuarto abierto completo, con bases reconocibles en extremos opuestos. El lobby usa una escena 3D independiente con pedestal, foco, respiración y rotación suave. Las miniaturas se generan con los mismos modelos jugables.

Los modelos son figuras procedurales articuladas de estilo geométrico. Incluyen locomoción, respiración, alas, salto, recarga, retroceso, fogonazo, impacto y muerte; trazadoras, partículas, zonas de habilidades, barreras, portales, lluvia y siluetas de escáner. Es un prototipo: las representaciones de algunas habilidades son abstractas, no animaciones cinematográficas ni assets artísticos finales. No incluye audio ni multijugador real. Las tres ranuras de invitación muestran el aviso de LAN/Online próximamente.

**Firebase está desactivado** (`firebaseConfig = null`) y no se ha creado ni desplegado ningún servicio. El adaptador y la función opcional están en `src/services/firebase.js` y `functions/`. Para conectarlos en una etapa posterior se necesita un proyecto, Auth Google, Firestore, desplegar `profileAction` y sus reglas, y agregar la configuración web pública. La integración remota no se validó contra un proyecto real. Las estadísticas del prototipo proceden del cliente: para competición online hará falta una simulación autoritativa de servidor. Los saldos locales no se importan automáticamente a una cuenta.

## Verificación

- `npm test`: 23 pruebas de reglas, navegación, input, progreso, compras y guardado local.
- `http://localhost:4173/tests/browser.html`: botón **Ejecutar pruebas**, 22 grupos de integración con el mapa, Three.js, actores y pools reales. Comprueba ambos equipos, movimiento, disparos/recarga, habilidades, daño y curación, inmunidad, confirmación/denegación, daño al cofre, diez oleadas/jefes/mejoras, sectores/clima, muerte/respawn y limpieza.
- Revisión visual del lobby, fichas, modos y combate en navegador; selección de Sombrío conservada después de recargar; invitación y pausa verificadas.

Los tests no alteran el progreso de tu partida. La página de integración construye su propia simulación aislada.

## Organización

`src/main.js` compone el motor; `battle.js`, `combat.js`, `abilities.js`, `mode-systems.js` y `match.js` implementan partidas; `characters.js`, `world.js` y `effects.js` generan el mundo; `lobby.js` y `ui.js` controlan la interfaz; `progress-store.js` guarda el perfil. El catálogo y las reglas de progresión compartidas están en `functions/shared/`.
