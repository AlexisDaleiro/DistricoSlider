# Districo y la central de juegos

Puzzle usa el SDK común descargado del endpoint publicado `?view=sdk`. Está incluido sin cambios en `src/integrations/gamehub/vendor/shared-sdk.js`; Vite lo incorpora al juego. No se crea ni publica otro backend. `demo` y `_template` mantienen su flujo local anterior.

## Configuración aplicada

El bloque `gameHub` de `brands/districo/theme.config.json` contiene la configuración proporcionada para la fila propia de Puzzle en **Juegos**:

| Campo                | Valor configurado                                            |
| -------------------- | ------------------------------------------------------------ |
| `endpoint`           | URL `/exec` publicada, incluida en la configuración          |
| `gameKey`            | Clave pública propia de Puzzle, incluida en la configuración |
| `brandId`            | `biofresh`                                                   |
| `brandName`          | `Biofresh`                                                   |
| `gameId`             | `biofresh-puzzle`                                            |
| `gameName`           | `Puzzle`                                                     |
| `gameVersion`        | `1.0.0`                                                      |
| `defaultCallingCode` | `598`                                                        |
| `allowPreview`       | `false`                                                      |

No faltan valores de conexión para Puzzle. No se usaron la clave ni el ID de Fresh Slice. La versión enviada es `gameVersion:1.0.0`; `package.json` es solo el respaldo para configuraciones que omitan la versión del protocolo. Los nombres comerciales definitivos de las filas los decide el catálogo del servidor.

La identidad de los eventos enviados es Biofresh / Puzzle. La presentación visual existente de Districo y su motor se conservan.

No usar como endpoint el enlace del editor, `/dev`, la planilla ni `URL_EXEC`. No hace falta compartir públicamente la planilla. El navegador solo usa el puente y el método público `recibirEvento`; no llama a las funciones administrativas terminadas en `_`. La clave del cliente es pública y no acredita la identidad ni la autenticidad del puntaje.

## Flujo

1. Portada con imagen local animada, Empezar juego y Ver ranking. Empezar juego abre el formulario: nombre y celular obligatorios, aviso sobre registro de datos y resultados, y consentimiento. Sin empresa, email ni suscripciones de marketing. Uruguay por defecto; admite `+` o `00` con otro prefijo. La validación de formato no verifica el celular por SMS.
2. El SDK crea `registration`. En producción se muestran las instrucciones únicamente después de recibir `ok:true` con el mismo `eventId`. Una respuesta opaca, un rechazo o una desconexión no habilitan jugar. Si falta configuración, el botón queda bloqueado y se muestran los campos pendientes.
3. Cada participación tiene un `sessionId`. Cada ronda tiene un `runId` nuevo, compartido por su inicio y su final. El juego envía `game_started`, seguido de `game_completed` (resuelto o tiempo agotado) o `game_abandoned` (salida, cambio de participante o inactividad).
4. **Jugar otra ronda** conserva la participación y crea una partida nueva. **Cambiar participante** limpia nombre, celular, consentimiento, IDs y tablero. La central identifica personas por teléfono normalizado; localmente también se reutiliza el participante por evento y teléfono.

El puzzle conserva su ranking por **menor tiempo**, luego **menos movimientos**. No se cambia el motor. Para el protocolo común, `score` contiene los movimientos; también se envían `moves`, `durationSeconds`, `finishReason`, `solved`, `gridSize` e `image`. `solved:false` y `finishReason:timeout` identifican los finales por tiempo agotado. No interpretar `score` como un ranking donde más es mejor.

## Desconexión y reintentos

Los envíos normales y sus confirmaciones son silenciosos. El aviso de envío pendiente y el botón de reintento aparecen solo después de 10 segundos, configurables en gameHub.syncFeedbackDelayMs. Se ocultan al confirmarse y cada nuevo envío vuelve a esperar su plazo. El modo de prueba, la configuración incompleta y los rechazos siguen indicándose; jugar continúa requiriendo un registro confirmado.

El SDK usa un iframe y `postMessage` con nonce y comprobación del origen y de la ventana del puente. Los datos personales viajan en el mensaje, nunca en la URL. Cada reintento conserva **eventId, fecha, sesión, ronda y todo el contenido**. Se reintenta al recuperar conexión, cada 20 segundos y mediante el botón de reintento.

La cola original del SDK vive en `sessionStorage`, con máximo de 80 eventos y descarte de registros de más de 6 horas al restaurar la cola. El formulario bloquea los datos de un registro ya enviado para reintentarlo sin cambiarlos; se puede cancelar y cambiar de participante. Las nuevas rondas pueden continuar sin conexión después de una inscripción confirmada. Los resultados locales siguen disponibles, pero la pantalla indica por separado si la central todavía tiene envíos pendientes o rechazados. Cerrar definitivamente la pestaña puede perder la cola; no se promete entrega posterior al cierre. El evento de salida se encola al recibir `pagehide`.

## Prueba local y compilación

Para una prueba local explícita, dejar `endpoint` y `gameKey` vacíos y poner `allowPreview:true`. Ejecutar:

```powershell
$env:VITE_BRAND = 'districo'
npm run dev
```

Se muestra **Modo de prueba: los datos no se envían ni se guardan en la central**. El almacenamiento del resultado local continúa funcionando. Una compilación de producción ignora `allowPreview`: sin configuración y confirmación real no permite jugar.

Para compilar con la conexión publicada:

```powershell
$env:VITE_BRAND = 'districo'
npm run build
```

El resultado web queda en `dist/`. Para regenerar el APK se utiliza el flujo Android existente `npm run brand:build -- districo`. La prueba en un navegador no sustituye una comprobación del puente dentro del WebView del dispositivo final.

## Verificación

```powershell
npm run typecheck
npm test
npm run gamehub:test-central -- 'C:\Users\CRISTIAN\Downloads\Central-Juegos-Integracion'
```

Las pruebas automáticas usan el SDK real con transporte controlado: datos incompletos, teléfonos inválidos, otro prefijo, rechazo y respuesta opaca, falta de configuración, confirmación previa al juego, desconexión y pérdida del ack, eventos duplicados, restauración de la cola, cambios de participante, varias rondas, inactividad, métricas y conservación del puntaje. La prueba del puente verifica URL sin datos personales, nonce, origen y ventana de respuesta.

`gamehub:test-central` ejecuta el **Code.gs original** de la carpeta indicada contra servicios de Sheets simulados en memoria. Comprueba dos juegos de prueba en una sola central, persona compartida, partidas separadas por juego, nombres comerciales tomados del catálogo, duplicados y entradas inválidas. No publica código ni accede a la planilla privada.

**Comprobación real del 22/10/2026:** el juego recibió confirmaciones de la central publicada para registro, inicio, resultado completo y abandono. Se resolvió el puzzle usando sus controles normales, se inició otra ronda con el mismo participante y se comprobó el formulario vacío al salir. Una prueba adicional con dos clientes del SDK reenvió el mismo registro: la central devolvió `ok:true`, `duplicate:true`, el mismo `eventId` y la misma fecha de recepción. La evidencia está en `artifacts/gamehub-live-result.png`, `artifacts/gamehub-live-duplicate.png` y `artifacts/gamehub-live-duplicate.json`.

Las pruebas reales dejaron datos ficticios identificados como **PRUEBA TECNICA Puzzle**, usando un número reservado para ejemplos del rango estadounidense 202-555-01xx. No se abrió ni se modificó la privacidad de la planilla ni se ejecutaron funciones administrativas.

**Alcance pendiente:** la desconexión y la convivencia de dos juegos se verificaron con transporte controlado y con el Code.gs original en memoria. La comprobación de dos juegos reales requiere la configuración autorizada del segundo juego. La inspección de filas de la planilla privada y la prueba en un WebView Android quedan para el administrador y el dispositivo de destino. No falta ningún valor de conexión de Puzzle.
