# Wall Bounce para Android

Desde PowerShell, con Node 22 o posterior, Android Studio Otter o posterior, JDK 21 y Android SDK Platform 36 instalados, entra en la carpeta `mobile` de esta rama y ejecuta:

```powershell
$env:JAVA_HOME = "$env:ProgramFiles\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
npm.cmd ci
npm.cmd run sync
cd android
.\gradlew.bat assembleDebug
explorer.exe .\app\build\outputs\apk\debug
```

Si instalaste Android Studio o el SDK en otra ruta, usa esas rutas. La primera compilación descarga Gradle y sus dependencias. El archivo instalable es `app-debug.apk`. Después de modificar los recursos o el juego, vuelve a ejecutar `npm.cmd run sync` desde `mobile` antes de compilar.

El lanzador usa la ilustración PNG de Sonrisas. La partida, los sellos y las compras se guardan en las preferencias privadas del dispositivo. El interruptor de Ajustes permite activar y cancelar el recordatorio local.

## Novedades 1.3.1

- Pasaporte con nivel de experiencia separado de las 15 divisiones de liga. Las ligas son progresión personal sin clasificación multijugador.
- Ruta diaria opcional, con tres variantes: altura, correo y rebotes. Cada variante usa una semilla fija para el día, y repetirla no duplica monedas. Los encargos permanentes y la práctica siguen disponibles.
- Ocho estelas, imán permanente, escudos y bobina de impulso con dos niveles. Las mejoras no alteran las rutas competitivas de marca personal. No hay compras reales.
- Los sellos no se pierden por no entrar. Sin anuncios ni conexión necesaria para jugar.
- Interfaz propia con indicadores de nivel, liga y siguiente pelota; botones táctiles y adaptación a pantallas estrechas.
- Guardado previo de respaldo y recuperación si el JSON principal resulta dañado.
- Notificaciones locales desactivadas por defecto: un único aviso silencioso tras cuatro días sin abrir la app; se cancela al desactivar el ajuste. Android puede retrasar su entrega.
- Dos MP3 originales renovados en la primera adaptación de Android y 12 efectos WAV existentes.

### Verificación en dispositivo

Instalar el APK debug, iniciar un ascenso y probar los controles, suspensión y reanudación, botón Atrás, sonido, taller, sellos, ruta del día, reapertura con progreso conservado, y permiso de notificaciones. Verificar la interfaz en pantalla estrecha y tablet. No se requiere una cuenta ni acceso a Internet durante el juego.
