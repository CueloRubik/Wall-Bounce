# Wall Bounce 1.2.0 · Electron 28

El cuaderno de ruta permite practicar las ocho estaciones alcanzadas sin gastar monedas ni alterar récords. Los escenarios cambian al llegar al puerto (750 m) y al observatorio (3350 m).

Juego arcade vertical de **un solo toque**, con controles para ratón, teclado y teléfono, 36 pelotas ilustradas, recompensas por partida y progresión sin misiones para desbloquear las pelotas.

## Instalación en macOS Catalina

Requiere **Node.js 18** y conexión durante la primera instalación de Electron. Descomprime el ZIP y entra en la carpeta que contiene `package.json`:

```bash
npm install
npm start
```

`package.json` fija **Electron 28.3.3**, compatible con macOS Catalina (10.15). No se incluye `node_modules`; se instala mediante npm. El juego funciona sin internet después de instalarlo.

## Controles y dificultad

- **Clic, toque o barra espaciadora**: impulso hacia arriba. La pelota cambia de pared automáticamente.
- **Pausa**: botón II o tecla Escape. Puedes continuar, reintentar o volver al menú.
- **Inicio accesible**: velocidad lateral más lenta, espacios amplios y primera plataforma de supersalto. La dificultad aumenta gradualmente según la puntuación, y aparecen nuevos tipos de obstáculo.
- **Obstáculos**: pinchos de cristal, bloques, sierras, plataformas móviles, cuchillas y barras de energía.
- **Ayudas y premios**: plataformas de supersalto, monedas, estrellas y burbujas-escudo que absorben una colisión.
- **Ambientación**: valle pintado con luz que cambia al subir, animación de giro leve, rebote deformable, estelas coloreadas y partículas.

## Progresión

Las **36 pelotas** se desbloquean **únicamente por porcentaje acumulado en partidas**, sin misiones para adquirirlas. Cada partida entrega entre **3 % y 14 %** según la puntuación y las estrellas recogidas. Al llegar al 100 %, se desbloquea la siguiente pelota, que se puede equipar desde la colección. El progreso anterior de Wall Bounce 4.0 se conserva al actualizar.

Además de las pelotas:

- **Festival de estrellas**: cada 12 estrellas recolectadas en partidas entrega automáticamente 80 monedas, sin fechas límite.
- **Misiones permanentes**: reclama monedas por altura, partidas, estrellas y rebotes desde el campamento. Los logros del perfil anterior cuentan para sus recompensas.
- **Estelas cosméticas**: cinco diseños, el primero gratuito y los demás obtenibles con monedas ganadas jugando. No hay compras con dinero real.
- **Récords, estadísticas y preferencias** persistentes.

## Música y efectos

`assets/music/` incluye dos MP3 originales, uno para el menú y otro para la partida. `assets/sfx/` tiene **12 archivos WAV** independientes, incluyendo supersalto, estrellas y escudo. El reproductor limita el solapamiento de sonidos repetidos y mezcla los efectos con volúmenes bajos para evitar saturación al tocar rápido. Desde Ajustes puedes desactivar la música, los efectos o reducir las partículas.

## Dónde se guarda el progreso

**En Electron, el progreso se guarda en `~/Documents/Wall Bounce/`, nunca en `localStorage`.** La ruta concreta se obtiene de `app.getPath('documents')`. Se guardan:

- `progreso.json`: estadísticas, monedas, porcentajes, pelotas, estelas y configuración.
- `progreso-respaldo.json`: respaldo automático del guardado anterior.
- `session/`, `cache/` y `crashes/`: carpetas configuradas para datos del proceso Electron.

Se puede abrir desde **Ajustes → Abrir carpeta**. Desinstalar o volver a instalar la app no elimina el progreso. Si se cambia el nombre de la carpeta, la aplicación crea una nueva y comienza con un progreso vacío.

## Pruebas

```bash
npm run check
npm test
```

Las pruebas automatizadas comprueban el guardado en Documentos, los respaldos, los porcentajes, la economía, los eventos, la compra segura de estelas con monedas virtuales, el orden de dificultad y la conservación de perfiles de la versión anterior.

## Organización

- `main.js`, `preload.js`: Electron y acceso exclusivo al guardado.
- `src/logic.js`: progresión y generación de obstáculos.
- `src/game.js`: juego Canvas, animación y pantallas.
- `src/music.js`: mezcla y reproducción de MP3/WAV.
- `assets/balls/`: 36 PNG centrados, uno por diseño.
- `assets/`: fondos, sprites de obstáculos, estrellas, escudos y música.
- Tipografía: utiliza fuentes del sistema; el archivo OTF original no se redistribuye en el repositorio.
- `tests/`: pruebas de regresión.

El motor es HTML/CSS/JS Canvas. Cuando se pase a Capacitor, solo habrá que adaptar el puente de almacenamiento a un API de archivos nativo de Android, manteniendo la lógica del juego.

## Compilar DMG para macOS

En un Mac, con Node 18 y Xcode Command Line Tools instaladas, ejecutar:

```bash
npm install
npm run check
npm test
npm run build:mac:intel
```

El DMG para Intel se guarda en `dist/`. Para una aplicacion universal (Intel y Apple Silicon):

```bash
npm run build:mac:universal
```

`npm run build:mac` es un alias para Intel. No uses `npm:run:build:mac:universal`, porque la sintaxis correcta de npm es con espacios. La version de electron-builder se fija en 24.13.3, compatible con Node 18 para generar compilaciones en el Mac con Catalina. El DMG sin firma puede requerir abrirlo desde el menu contextual de macOS.

Para reiniciar la instalacion sin perder progreso, no elimines `~/Documents/Wall Bounce`.

> Nota de recursos: la fuente OTF recibida con la versión de desarrollo no se publica en GitHub. El juego emplea una tipografía alternativa del sistema.
