# UIspa

Extensión para **Chrome**, **Firefox** y **Safari** (experimental) que da a [Hispashare](https://www.hispashare.org) un diseño más limpio y moderno, facilita copiar los enlaces ed2k o enviarlos a Synology Download Station, te deja guardar tus favoritos y, si quieres, te dice qué tienes ya en tu servidor Plex o Jellyfin.

> Proyecto no oficial. No tiene relación con Hispashare: solo cambia cómo se ve la web en tu navegador y no aloja ni distribuye ningún contenido.

## Qué hace

**Rediseño**
- Tema oscuro, claro o automático (como el sistema), con una barra superior compacta: buscador, géneros, «Popular» y tu cuenta.
- Portada y búsquedas en cuadrícula de carátulas, con el título, la nota, el año y los géneros sobre la propia carátula. El borde y la etiqueta de cada tarjeta indican el tipo con su color e icono (película, serie, documental o música), y las temporadas salen como etiqueta aparte («Temp. 1 a 4»). Las carátulas y el texto pueden ser pequeños, medianos o grandes.
- Cuatro diseños para el listado: **Rejilla** de carátulas, **Streaming** (un título destacado arriba y una fila deslizable por tipo), **Lista** compacta (una línea por título) y **Revista** (carátula con la sinopsis al lado).
- Filtro rápido encima del listado: **Todo · Películas · Series · Documentales · Música**, con cuántos hay de cada tipo.
- Scroll infinito: al llegar al final se cargan más títulos sin cambiar de página (se puede desactivar y volver a la paginación).
- Ficha de cada título con la carátula grande, notas de IMDb y usuarios, ficha técnica, sinopsis (con los premios aparte, si los hay) y reparto, y los comentarios justo debajo.
- Descargas ordenadas: cada versión aparece con un resumen (archivos, tamaño total, calidad, ripeador y fecha) y se puede plegar o desplegar con un clic; al entrar salen desplegadas. En series con varias temporadas, pestañas para ver solo una.
- Los botones de cada versión van en filas: los de la web, 📋 Copiar, ▶ eMule y 📥 NAS. Si la versión tiene muchos capítulos, salen también encima de la lista.
- Diseño adaptable a pantallas pequeñas y texto ampliado.
- Botón ◐ de la barra: tema, diseño, tamaño de carátulas, scroll infinito y volver al diseño original.

**Copiar enlaces**
- Para copiar un solo capítulo: márcalo y pulsa «Seleccionados», o haz Alt+clic en su nombre.
- «Seleccionados» y «Todos» en cada versión de una serie; «Copiar enlace» en las películas.
- Botón «Copiar» en la ventana de enlaces de la propia web.
- Atajos: `Alt+Shift+C` copia todos los enlaces de la página y `Alt+Shift+S` los capítulos marcados. También desde el menú del botón derecho.
- Los atajos se pueden cambiar en `chrome://extensions/shortcuts` (Chrome) o en `about:addons` → rueda dentada ⚙ → **Gestionar atajos de teclado de extensiones** (Firefox).

**Abrir en eMule o aMule (en este ordenador)**
- «Seleccionados» / «Todos» en cada versión («Abrir en eMule» en las películas). Se mandan todos de un solo clic.
- Con aMule, el sistema tiene que saber abrir los enlaces ed2k con él: en las versiones actuales de aMule se activa en **Preferencias → General** (en Mac, imprescindible).
- También funciona en Chrome, Brave, Edge y demás navegadores basados en Chromium, incluido el botón «Ejecutar enlaces» de la propia web, que en ellos no hacía nada.
- Se pueden ocultar en los ajustes (**Descargas → En este ordenador**).

**Descarga remota (opcional)**
- Para aMule en Docker, en un NAS o en otro ordenador, aMuTorrent o Rucio: fila 🐳 con «Seleccionados» / «Todos» en cada versión. Se mandan todos de golpe, desde cualquier navegador.
- Se conecta directamente con **aMule 3.1 o posterior** (su interfaz web nueva, amuleapi), a través de **aMuTorrent** o con **Rucio**. Puedes elegir la categoría.

**Enviar a Synology Download Station (opcional)**
- «Seleccionados» / «Todos» en cada versión.
- La carpeta que elijas se **recuerda para cada serie** (también para sus otras temporadas): la próxima vez el recuadro se abre directamente en ella y basta con pulsar Intro. Las carpetas guardadas se ven y se olvidan en Ajustes → Descargas → NAS.
- Al enviar eliges la carpeta navegando por las carpetas del NAS, o escribiéndola. Se abre en la última que usaste, tienes atajos a la carpeta por defecto y a las recientes, y puedes crear carpetas nuevas.

**Favoritos**
- Botón **☆ Añadir a favoritos** en cada ficha (pasa a **★ En favoritos**, en dorado) y una estrella ☆ en las carátulas de la portada al pasar el ratón.
- Arriba de la portada, un panel destacado **«Tus favoritos»** con las mismas tarjetas que el listado (siguen el tamaño de carátulas que elijas) y flechas para recorrerlos si hay muchos. Se ordenan por su **última actualización** (la fecha de su enlace más reciente), que sale en cada tarjeta.
- Una vez al día, al abrir la portada, UIspa mira si tus favoritos tienen versiones o capítulos nuevos y los marca como **nuevo** («nueva versión», «+2 archivos») hasta que abres su ficha.
- Tú eliges dónde se guardan: **en tu cuenta del navegador** (Firefox o Google), para verlos en todos tus ordenadores, o **solo en este navegador**. Al cambiar de opción se mueven solos. En los ajustes también puedes verlos, quitarlos, exportarlos e importarlos.

**Plex o Jellyfin (opcional)**
- En cada ficha marca qué episodios o películas tienes ya en tu servidor Plex, en Jellyfin o en los dos a la vez (una marca por servidor, en su color).
- Distingue qué versión tienes comparando el tamaño exacto de tus archivos:
  - **✓ En Plex** / **✓ En Jellyfin**: tienes exactamente ese archivo.
  - **≈ En Plex (1080p)**: lo tienes en la misma calidad, en otro archivo.
  - **En Plex en 4K**: lo tienes en otra calidad.
  - **Falta**: no lo tienes.
- Busca cada título por su código de IMDb y, si no, por título y año.
- **Lo que te falta:** en cada versión de una serie, «Los que faltan (N)», en Copiar y en NAS, copian o envían solo los capítulos que no tienes en ningún servidor. El resumen de cada versión indica si tienes esa misma versión, la misma calidad (misma resolución y códec, x264 / x265), otra calidad o cuántos capítulos te faltan, y las pestañas de temporada marcan con un punto las incompletas.

## Instalación

Descarga la última versión desde **[Releases](https://github.com/ahhhv/UIspa/releases/latest)**.

### Firefox

1. Descarga `UIspa-firefox.xpi`.
2. Arrástralo a una ventana de Firefox, o abre `about:addons` → rueda dentada ⚙ → **Instalar complemento desde archivo** y elígelo.
3. Pulsa **Añadir**.

La extensión está firmada por Mozilla y **se actualiza sola** cuando se publica una versión nueva. Requiere Firefox 140 o posterior.

### Chrome y navegadores basados en Chromium

1. Descarga `UIspa-chrome.zip` y descomprímelo. Obtendrás una carpeta `UIspa`.
2. Abre `chrome://extensions`.
3. Activa el **Modo de desarrollador** (arriba a la derecha).
4. Pulsa **Cargar descomprimida** y elige la carpeta `UIspa`, la que contiene `manifest.json`.

Chrome carga la extensión desde esa carpeta, así que no la borres ni la muevas. Para actualizar, descarga la nueva versión, sustituye el contenido de la carpeta y pulsa ↻ en `chrome://extensions`. Funciona en Chrome 116 o posterior, Edge, Brave, Opera y Vivaldi.

> **¿Tenías la versión 1.x de Chrome?** Antes la extensión estaba en la raíz del repositorio y ahora está en la carpeta `chrome/`. Quita la antigua en `chrome://extensions` y carga la nueva como se indica arriba. Tendrás que volver a configurar Plex o Jellyfin.

### Safari (experimental)

Safari solo permite instalar de forma permanente extensiones firmadas con una cuenta de pago de Apple, así que esta versión se compila en tu propio Mac. Necesitas macOS con **Xcode** (gratis en la App Store) y tu Apple ID.

1. Descarga el repositorio (**Code → Download ZIP**) y descomprímelo.
2. En Terminal, dentro de esa carpeta:
   ```
   ./build-safari.sh
   open xcode/UIspa/UIspa.xcodeproj
   ```
3. En Xcode, en **Signing & Capabilities** de los dos targets (**UIspa** y **UIspa Extension**), elige el mismo **Team** (tu Apple ID, *Personal Team*) y el mismo **Signing Certificate**.
4. Elige el esquema **UIspa** y **My Mac**, y pulsa ▶. Se abrirá una ventanita de UIspa: ciérrala.
5. En Safari:
   - **Ajustes → Avanzado** → marca **Mostrar funciones para desarrolladores web**.
   - **Ajustes → Desarrollador** → marca **Permitir extensiones sin firmar**.
   - **Ajustes → Extensiones** → activa **UIspa**.
   - Abre Hispashare, pulsa el icono **UI** de la barra y elige **Permitir siempre en este sitio web**. Recarga la página.

«Permitir extensiones sin firmar» se desactiva cada vez que cierras Safari: si UIspa desaparece, vuelve a marcarlo.

Limitaciones en Safari: los botones de copiar funcionan igual que en los otros navegadores, pero los atajos de teclado y el menú del botón derecho pueden no copiar.

## Apariencia

Pulsa el botón ◐ de la barra superior de Hispashare (o ve a la pestaña **Apariencia** de los ajustes de UIspa) para elegir:

- **Tema:** oscuro, claro o automático (sigue el de tu sistema).
- **Diseño:** Rejilla, Streaming, Lista o Revista.
- **Carátulas:** pequeñas, medianas o grandes.
- **Título y datos:** tamaño del texto de las tarjetas (pequeño, mediano o grande).
- **Cargar más títulos al bajar:** scroll infinito en la portada y las búsquedas; si lo desactivas, vuelve la paginación.
Encima del listado tienes el **filtro rápido** para ver solo películas, series, documentales o música. Se mantiene mientras navegas por la web y, si con el filtro quedan pocos títulos, carga más páginas solo.

- **Volver al diseño original:** quita el rediseño; para recuperarlo, pulsa «✨ Vista moderna» abajo a la derecha.

## Conectar con Plex o Jellyfin

Lo más fácil es el **asistente de configuración**: se abre solo al instalar UIspa y, después, desde el botón **Asistente de configuración** al principio de los ajustes. Te guía paso a paso por la apariencia, Plex o Jellyfin, el NAS y la descarga remota, y en cada paso puedes probar la conexión u omitirlo.

Si prefieres hacerlo a mano:

1. Abre los ajustes de UIspa de cualquiera de estas formas:
   - En Hispashare, menú **Más → ⚙ Ajustes de la extensión**.
   - Clic en el icono de UIspa en la barra del navegador (Chrome, Firefox y Safari).
   - **Firefox:** `about:addons` → UIspa → pestaña **Opciones**.
2. En la pestaña **Plex / Jellyfin**, elige **Plex** o **Jellyfin** (puedes configurar los dos; un punto verde indica los conectados) y escribe la dirección de tu servidor, por ejemplo `http://192.168.1.50:32400` (Plex) o `http://192.168.1.50:8096` (Jellyfin).
3. Pega la credencial:
   - **Plex:** tu token. En Plex Web abre cualquier película o episodio → **⋯ → Obtener información → Ver XML** y copia lo que va después de `X-Plex-Token=` en la dirección.
   - **Jellyfin:** una clave de API. Con una cuenta de administrador ve a **Panel de control → Claves de API**, pulsa **+** y copia la clave.
4. Pulsa **Guardar**. El navegador te pedirá permiso para acceder solo a esa dirección.

En Safari, abre los ajustes desde el menú **Más** de Hispashare o en **Safari → Ajustes → Extensiones → UIspa → Ajustes**.

## Enviar a Synology Download Station

Requiere DSM 7 con Download Station.

1. **En el NAS:**
   - Crea un usuario solo para esto (**Panel de control → Usuario y grupo**). En los permisos de aplicaciones marca **Permitir** solo en **Download Station** y **File Station** (esta última sirve para explorar las carpetas) y **Denegar** en todo lo demás. Sin File Station también funciona, pero tendrás que escribir la carpeta a mano.
   - Dale **lectura/escritura** en las carpetas donde quieras guardar las descargas. Al explorar solo verás esas carpetas.
   - No le actives la verificación en dos pasos.
   - En Download Station, con tu administrador: **⚙ Configuración → General → Habilitar descargas eMule**.
   - **Importante:** inicia sesión en DSM una vez con el usuario que has creado, abre Download Station y elige una carpeta de destino por defecto. Si no lo haces, las descargas pueden quedarse en «Finalizando» o dar error.
2. **En UIspa:** en los ajustes, pestaña **Descargas → NAS Synology**:
   - **Dirección:** por ejemplo `http://192.168.1.10:5000`. Con HTTPS solo funciona si el NAS tiene un certificado válido; el autofirmado de fábrica lo rechaza el navegador.
   - **Usuario y contraseña** del usuario que has creado.
   - **Carpeta por defecto:** opcional, por ejemplo `docker/data`.
3. Pulsa **Guardar** y recarga Hispashare: aparecerán los botones 📥.

## Descarga remota

Para un programa de descargas que no está en el ordenador donde navegas, o que UIspa no puede abrir directamente. En los ajustes, pestaña **Descargas → Descarga remota**, elige cómo conectar:

- **aMule 3.1 o posterior** (directo):
  - **Docker (`ngosang/amule`):** pon una contraseña con `WEBUI_PWD` y publica el puerto `4711`. En UIspa: dirección `http://IP:4711` y esa contraseña.
  - **aMule normal en otro ordenador:** en **Preferencias → Controles remotos**, marca **«Run amuleapi (REST API) on startup»** y pon la interfaz de escucha (no `127.0.0.1` si es desde otro equipo), el puerto (por defecto `4713`) y la contraseña de administrador.
  - Con aMule 2.3.x (la interfaz web antigua, amuleweb) no funciona: actualízalo o usa aMuTorrent.
- **aMuTorrent:** dirección `http://IP:4000` y, si tiene usuarios activados, la **clave de API** de tu usuario (en aMuTorrent, **Ajustes → Gestión de usuarios**).
- **Rucio:** dirección de su panel, por defecto `http://127.0.0.1:3003`. Desde otro equipo o en Docker, su API tiene que escuchar en la red (`RUCIOD_API_LISTEN=0.0.0.0:3003`). Rucio no tiene contraseña propia; si está detrás de un proxy con usuario y contraseña, ponlos.

Pulsa **Probar conexión** para cargar las categorías, elige una si quieres y pulsa **Guardar**. Recarga Hispashare: aparecerá la fila 🐳 **Descarga remota**.

## Favoritos

1. Marca una película o serie con **☆ Añadir a favoritos** en su ficha, o con la ☆ que aparece al pasar el ratón por su carátula en la portada.
2. En la portada (primera página de Novedades) verás el panel **«Tus favoritos»**, ordenado por la última actualización de cada uno. Para quitar uno, pulsa su ★.
3. En los ajustes, pestaña **Favoritos**, puedes:
   - elegir **dónde se guardan**: en tu cuenta del navegador (sincronizados entre ordenadores) o solo en este navegador. Al cambiar, se mueven solos;
   - activar o desactivar el **aviso de novedades** (se comprueba una vez al día al abrir la portada);
   - ver la lista, quitar favoritos, **exportarlos** a un archivo o **importarlos**.

En Firefox, para que se sincronicen entre ordenadores tienes que tener activada la sincronización de complementos en tu cuenta de Firefox.

## Privacidad

- UIspa no recoge ni envía datos a ningún servidor propio ni de terceros. En Firefox lo declara así en su instalación (`data_collection_permissions: none`).
- Solo se comunica con Hispashare, para obtener los enlaces que ya ofrece la web, con tu servidor Plex o Jellyfin, tu NAS Synology y tu descarga remota (aMule, aMuTorrent o Rucio) si los configuras.
- Los favoritos se guardan donde elijas: en el almacenamiento sincronizado del navegador (viajan con tu cuenta de Firefox o de Google) o solo en tu navegador. Nunca van a ningún servidor de UIspa.
- Las direcciones, credenciales y contraseñas se guardan únicamente en tu navegador; la contraseña del NAS viaja en el cuerpo de la petición, nunca en la dirección. Las consultas salen de la extensión, no de la página, así que la web nunca las ve. Del servidor solo se usan el tamaño y la resolución de los archivos, nunca sus rutas.

## Permisos

| Permiso | Para qué |
|---|---|
| Acceso a `hispashare.org` / `hispashare.com` | Aplicar el rediseño y añadir los botones |
| `clipboardWrite` (y `offscreen` en Chrome) | Copiar enlaces al portapapeles, también desde atajos y menús |
| `contextMenus` | Opciones del menú del botón derecho |
| `storage` | Guardar la configuración, la apariencia y los favoritos (en tu navegador o sincronizados con tu cuenta, según elijas) |
| Acceso opcional a la dirección de tu servidor o NAS | Solo se pide si configuras Plex, Jellyfin, Synology o una descarga remota, y únicamente para esa dirección |

## Estructura

```
chrome/           Extensión para Chrome (Manifest V3)
firefox/          Extensión para Firefox (Manifest V2, firmada por Mozilla)
safari/           Extensión para Safari (experimental)
build-safari.sh   Genera el proyecto de Xcode de la versión de Safari
updates.json      Aviso de actualizaciones para Firefox
```

Las tres versiones comparten el mismo código; solo cambian el manifiesto y el segundo plano:

| Archivo | Función |
|---|---|
| `manifest.json` | Definición de la extensión |
| `theme-early.js`, `theme.js`, `theme.css` | Rediseño de la web: apariencia, scroll infinito, versiones plegables y temporadas |
| `content.js`, `content.css` | Botones de copiar, eMule, descarga remota y NAS (también «los que faltan») y avisos |
| `media.js` | Marcas de Plex o Jellyfin en las fichas |
| `background.js` | Segundo plano: atajos y menús |
| `media-bg.js`, `plex-bg.js`, `jellyfin-bg.js` | Consultas al servidor multimedia |
| `synology-bg.js` | Envío de enlaces a Download Station y exploración de carpetas |
| `amule-bg.js` | Envío de enlaces a la descarga remota (aMule, aMuTorrent o Rucio) |
| `favorites.js` | Favoritos: estrellas, fila de la portada y aviso de novedades |
| `setup-bg.js` | Abre el asistente de configuración al instalar |
| `offscreen.html`, `offscreen.js` | Solo Chrome: copia al portapapeles desde segundo plano |
| `options.html`, `options.js`, `options.css` | Página de ajustes y asistente de configuración |

## Limitaciones

- Depende del HTML de Hispashare: si la web cambia su estructura, el rediseño o los botones pueden dejar de funcionar.
- La coincidencia exacta con el servidor se basa en el tamaño que muestra la web, redondeado a dos decimales. Si renombras o recomprimes un archivo, aparecerá como «≈» u «otra calidad».

## Novedades

**4.3.2**
- Arreglado: «Nueva carpeta» en el recuadro del NAS fallaba siempre con «El NAS respondió con el error 101». Ahora crea la carpeta (los nombres no pueden llevar comas).

**4.3.1**
- **Carpeta del NAS por serie:** la carpeta que eliges al enviar a Download Station se recuerda para esa serie (y sus otras temporadas); la próxima vez el recuadro se abre directamente ahí. Se pueden ver y olvidar en Ajustes → Descargas → NAS.
- Si al NAS, a Plex/Jellyfin o a la descarga remota les falta el permiso del navegador, ahora se dice claramente y cómo arreglarlo.
- Arreglado: desconectar un servicio (aMule, Plex, Jellyfin o el NAS) quitaba el permiso a los demás que estuvieran en el mismo equipo.

**4.3.0**
- **Diseños del listado:** además de la rejilla, **Streaming**, **Lista** compacta y **Revista**. Se eligen en el botón ◐ o en Ajustes → Apariencia.
- **Filtro rápido** por tipo encima del listado (películas, series, documentales, música), con contador y carga automática de más páginas si hace falta.
- **Favoritos por última actualización:** cada favorito muestra cuándo se publicó su último enlace y el panel se ordena por eso. Las novedades se detectan mejor, también sin entrar en cada ficha.
- Las tarjetas de favoritos son las mismas que las del listado y siguen el tamaño de carátulas y de texto.
- **Botones también arriba:** en versiones con muchos capítulos, las filas de Copiar, eMule / aMule, descarga remota y NAS (y «Seleccionar todos») salen también encima de la lista, para no tener que bajar hasta el final.
- Se quitan los botones pequeños de cada capítulo (📋 ▶ 🐳 📥): ahora se marcan los capítulos y se usa «Seleccionados». Alt+clic en el nombre sigue copiando su enlace.
- Streaming con tema claro: la cabecera destacada es clara y se lee bien.
- El icono de UIspa en la barra del navegador abre ahora los **ajustes de la extensión** (antes copiaba todos los enlaces de la página; eso sigue en el menú del botón derecho y con `Alt+Shift+C`).
- Arreglado: con algunos diseños el scroll infinito podía quedarse parado.

**4.2.0**
- **Rucio:** la descarga remota (antes «aMule remoto») admite también Rucio, el cliente P2P con acceso a la red Kad de eMule, con usuario y contraseña opcionales si está detrás de un proxy. La fila 🐳 pasa a llamarse **Descarga remota**.
- **Ajustes en pestañas:** Apariencia, Plex / Jellyfin, Descargas (en este ordenador, NAS Synology y descarga remota) y Favoritos, con un punto verde en lo que está conectado.
- Si te equivocas de opción o de puerto (aMule, aMuTorrent o Rucio), los ajustes te dicen cuál elegir.

**4.1.0**
- **aMule remoto:** nueva fila 🐳 para mandar los enlaces a un aMule en Docker, en un NAS o en otro ordenador, todos de golpe. Funciona con aMule 3.1 o posterior directamente (amuleapi) o a través de aMuTorrent, con elección de categoría. Nuevo paso en el asistente.
- La fila ▶ pasa a llamarse **eMule / aMule**: también sirve con aMule en el mismo ordenador.

**4.0.0**
- **Enviar a eMule:** botones ▶ en cada capítulo y «Seleccionados» / «Todos» en cada versión, que mandan todos los enlaces de un clic. Funciona también en Chrome y demás navegadores Chromium, incluido el botón «Ejecutar enlaces» de la web. Se pueden ocultar en los ajustes.
- Los botones de cada versión se ordenan en filas: los de la web, 📋 Copiar, ▶ eMule y 📥 NAS, cada uno con su color.
- En la ficha, los premios salen aparte de la sinopsis, como en la web original.
- Arreglado: en series con una temporada en emisión con un solo capítulo no salían las pestañas de temporada.

**3.6.1**
- Las versiones de la temporada que se muestra salen desplegadas al entrar en la ficha (si pliegas una, se queda plegada).

**3.6.0**
- Al abrir la ficha de una serie con varias temporadas, se muestra directamente la última.
- Las listas de capítulos se ajustan mejor: las columnas extra (por ejemplo, las de administración) ya no separan los botones y casillas del nombre.
- Se quita el calendario de próximos capítulos (TVmaze / TMDb). Al actualizar se borran sus ajustes, incluida la clave de TMDb si la habías puesto.

**3.5.1**
- Arreglado: en Firefox no aparecía la fila de favoritos en la portada.

**3.5.0**
- **Favoritos:** marca películas y series con ☆ en su ficha o en las carátulas; aparecen en un panel destacado arriba de la portada, con aviso de versiones o capítulos nuevos. Eliges si guardarlos en tu cuenta del navegador (sincronizados) o solo en este navegador, y se pueden exportar e importar.

**3.4.0**
- **Calendario de capítulos:** en las fichas de series, los próximos capítulos en gris con su fecha de emisión, y junto al título cuándo sale el siguiente. Usa TVmaze sin configurar nada, o TMDb (con títulos en castellano) si pones tu clave en los ajustes.
- **Asistente de configuración:** se abre al instalar y desde los ajustes; guía paso a paso por la apariencia, Plex o Jellyfin, el NAS y el calendario.

**3.3.0**
- Nuevas tarjetas en la portada, idea y diseño de MrUriosXD: datos sobre la carátula, color e icono por tipo, etiqueta de temporada y géneros en chips. Con el tema claro, el degradado es blanco y el texto oscuro.
- Nuevo ajuste «Título y datos» para el tamaño del texto de las tarjetas.
- Plex y Jellyfin distinguen también el códec (x264 / x265): el resumen de cada versión indica si tienes esa misma versión, la misma calidad u otra calidad.
- Mejor adaptación de la cuadrícula y de los ajustes al móvil.

La versión 3.2.0 no se llegó a publicar: sus cambios están incluidos aquí.

**3.1.0**
- **Lo que te falta:** en cada versión de una serie, «📋 Copiar los que faltan» y «📥 Al NAS (faltan N)» copian o envían solo los capítulos que no tienes en Plex ni en Jellyfin.
- **Descargas ordenadas:** cada versión aparece plegada con un resumen (archivos, tamaño total, calidad, ripeador, fecha y si la tienes entera) y se abre con un clic. En series con varias temporadas, pestañas para ver solo una; las incompletas llevan un punto rojo.
- **Scroll infinito** en la portada y las búsquedas (se puede desactivar).
- **Tema claro y automático**, y carátulas pequeñas, medianas o grandes. Se elige en el nuevo menú ◐ de la barra o en la sección **Apariencia** de los ajustes.
- **Crear carpetas en el NAS** desde el explorador al enviar (＋ Nueva carpeta).
- Instrucciones del NAS: hay que iniciar sesión una vez en DSM con el usuario creado y elegir una carpeta por defecto en Download Station; si no, las descargas pueden quedarse en «Finalizando» o dar error.
- Arreglado el botón «✨ Vista moderna» del diseño original, que se veía transparente.

Las versiones 2.2.2 y 3.0.0 no se llegaron a publicar: sus cambios están incluidos aquí.

**2.2.1**
- Portada más limpia: al pasar el ratón por una carátula ya no aparecen la sinopsis ni las calidades.
- Las notas de cada versión (temporada, montaje, reescalado…) se ven en un recuadro en lugar del globo ovalado.
- En la ficha, los comentarios vuelven a estar justo debajo de la información principal, como en la web original.

**2.2.0**
- Al enviar al NAS puedes explorar sus carpetas y elegir el destino (requiere permiso de File Station para el usuario).

**2.1.0**
- Envío de enlaces a Synology Download Station, eligiendo la carpeta en cada envío.
- Si hay dos copias de UIspa instaladas a la vez, ya no se estorban: solo trabaja una.
- El permiso para acceder a tu servidor se pide sin puerto (necesario en Safari).

**Safari (experimental)**
- Nueva versión para Safari que se compila en tu Mac con Xcode (`build-safari.sh`).

**2.0.0**
- Primera versión pública para Firefox, firmada por Mozilla y con actualizaciones automáticas.
- Chrome y Firefox en el mismo repositorio (`chrome/` y `firefox/`).
- Plex y Jellyfin a la vez, con una marca por servidor.

**1.x** (solo Chrome)
- Rediseño de Hispashare y botones para copiar enlaces ed2k.
- Integración con Plex y Jellyfin, distinguiendo qué versión tienes.
- Soporte para fichas de películas.

## Desarrollo

Para probar cambios sin empaquetar:

- **Chrome:** `chrome://extensions` → **Modo de desarrollador** → **Cargar descomprimida** → carpeta `chrome/`. Tras cada cambio, pulsa ↻.
- **Firefox:** `about:debugging` → **Este Firefox** → **Cargar complemento temporal** → archivo `firefox/manifest.json`. Se quita al cerrar Firefox.

El código común (rediseño, botones y marcas) es idéntico en las tres carpetas: si cambias algo, cópialo a todas.

- **Safari:** con Safari 26 o posterior puedes probar sin Xcode en **Ajustes → Desarrollador → Añadir extensión temporal** → carpeta `safari/`. Se quita al cerrar Safari.

### Publicar una versión nueva

1. Sube el número de versión en `chrome/manifest.json`, `firefox/manifest.json` y `safari/manifest.json`.
2. Empaqueta Firefox: comprime el **contenido** de `firefox/` (no la carpeta) en un `.xpi`. Súbelo a firmar en [addons.mozilla.org](https://addons.mozilla.org/developers/) → UIspa → **Upload a New Version**, y descarga el firmado.
3. Empaqueta Chrome: comprime la carpeta `chrome/` renombrada a `UIspa` como `UIspa-chrome.zip`.
4. Crea una Release con la etiqueta `X.Y.Z` (sin «v», por ejemplo `4.3.1`) y adjunta `UIspa-chrome.zip` y el firmado renombrado a `UIspa-firefox.xpi`.
5. Añade la versión a `updates.json`, con el enlace a esa Release. Hasta que no lo hagas, Firefox no la instalará automáticamente.

## Licencia

[MIT](LICENSE): puedes usar, modificar y redistribuir el código citando la autoría.
