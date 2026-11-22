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
