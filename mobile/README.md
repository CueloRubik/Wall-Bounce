# Wall Bounce para Android

Desde la raíz del repositorio, en PowerShell, con Node 22+, Temurin JDK 21 y Android SDK Platform 36 (los mismos requisitos que O-Isym):

```powershell
npm.cmd --prefix mobile ci
npm.cmd run android:doctor
npm.cmd run android:debug
explorer.exe .\dist-android
```

El script detecta JDK 21 incluso si Android Studio utiliza Java 25, configura el SDK, sincroniza Capacitor y ejecuta únicamente `assembleDebug`. No abre Android Studio ni instala o ejecuta el juego. El APK se copia como `dist-android/Wall-Bounce-1.3.1-Android-debug.apk`. Si falta el JDK, instala `winget install --id EclipseAdoptium.Temurin.21.JDK --exact --source winget`.

El lanzador usa la ilustración PNG de Sonrisas. La partida, los sellos y las compras se guardan en las preferencias privadas del dispositivo. El interruptor de Ajustes permite activar y cancelar el recordatorio local.

## Novedades 1.3.1

- Pasaporte con nivel de experiencia separado de las 15 divisiones de liga. Las ligas son progresión personal sin clasificación multijugador.
- Ruta diaria opcional, con tres variantes: altura, correo y rebotes. Cada variante usa una semilla fija para el día, y repetirla no duplica monedas. Los encargos permanentes y la práctica siguen disponibles.
- Ocho estelas, imán permanente, escudos y bobina de impulso con dos niveles. Las mejoras se aplican al ascenso normal; no alteran los encargos cronometrados ni el modo de práctica. No hay compras reales.
- Los sellos no se pierden por no entrar. Sin anuncios ni conexión necesaria para jugar.
- Interfaz propia con indicadores de nivel, liga y siguiente pelota; botones táctiles y adaptación a pantallas estrechas.
- Guardado previo de respaldo y recuperación si el JSON principal resulta dañado.
- Notificaciones locales desactivadas por defecto: un único aviso silencioso tras cuatro días sin abrir la app; se cancela al desactivar el ajuste. Android puede retrasar su entrega.
- Dos MP3 originales renovados en la primera adaptación de Android y 12 efectos WAV existentes.

### Verificación en dispositivo

Instalar el APK debug, iniciar un ascenso y probar los controles, suspensión y reanudación, botón Atrás, sonido, taller, sellos, ruta del día, reapertura con progreso conservado, y permiso de notificaciones. Verificar la interfaz en pantalla estrecha y tablet. No se requiere una cuenta ni acceso a Internet durante el juego.
