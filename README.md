# Survival Store: landing page + pedidos manuales

**Sitio estático listo para GitHub Pages.** No requiere Node.js, hosting PHP ni servidor Minecraft conectado.

## Qué incluye

- `index.html`: landing page con filas de mochila y VIP / VIP+ en pesos argentinos.
- `admin.html`: acceso privado por email/contraseña para ver pedidos, verificarlos, marcarlos entregados o rechazarlos, anotar notas internas, copiar comandos de consola y descargar CSV.
- `config.js`: personalizá nombre, alias, Discord y los **dos datos públicos de Supabase**.
- `styles.css`, `shared.js`, `app.js`, `admin.js`: diseño y funcionamiento.
- `supabase.sql`: base de datos, precios calculados en SQL y permisos de acceso seguros (RLS).
- `.nojekyll`: sitio estático directo para GitHub Pages.

## Cómo funciona para el jugador

1. Entra a la landing, elige fila extra o rango.
2. Va a la sección de compra, copia el alias **`dev.cristianm.mp`** y transfiere el importe exacto desde Mercado Pago (u otra cuenta que pueda transferir al alias).
3. Informa su nick Minecraft, usuario de Discord (opcional) y número de operación (opcional), confirma que transfirió y envía el pedido.
4. Recibe un código `SV-XXXXXXXXXX` de referencia. El formulario **no verifica ni cobra nada**: el pago real se hace en la app de Mercado Pago.
5. Vos iniciás sesión en `admin.html`, revisás el pedido, comprobás en TU Mercado Pago que el dinero entró (importe, fecha, identificador) y recién ahí marcás "Pago verificado".
6. Le otorgás el rango o tamaño de mochila desde la consola de Minecraft. Marcás "Entregado". Si algo falla, dejá una nota.

**Los beneficios vencen según el permiso temporal aplicado manualmente en LuckPerms.** No hay cobros recurrentes ni renovación automática.

## Paso 1: configurar Supabase (plan gratuito puede ser suficiente para empezar)

1. Creá un proyecto en https://supabase.com/.
2. En **SQL Editor**, pegá y ejecutá el archivo completo `supabase.sql`.
3. En **Authentication > Users**, creá un usuario administrativo con tu email y contraseña segura (podés usar "Add user").
4. Copiá el `User UID` de ese usuario y ejecutá en SQL Editor:

   ```sql
   insert into public.shop_admins (user_id)
   values ('PEGAR-AQUI-UUID-REAL');
   ```

   **Usá el UUID real de tu usuario**, no una dirección de correo ni el texto del ejemplo.

5. En **Project Settings / Connect**, buscá **Project URL** y **Publishable key** (o la legacy `anon` key). En `config.js`:

   ```js
   supabaseUrl: 'https://TU-PROYECTO.supabase.co',
   supabasePublishableKey: 'sb_publishable_...',
   ```

   Estos dos valores se pueden publicar. **NUNCA** pegues claves `service_role`, `sb_secret_...`, tu contraseña de admin ni credenciales de Mercado Pago en el repo ni en `config.js`.

6. **Authentication > Providers > Email:** mantené un único usuario administrador y deshabilitá registros públicos si no los necesitás. Si tu proyecto requiere confirmar correos, confirmá el administrador en el Dashboard.

7. Probá con dos navegadores/dispositivos: en uno hacé un pedido de prueba; en el otro iniciá sesión en `admin.html`. El pedido debe aparecer. Rechazá luego el pedido de prueba.

**Seguridad:** los visitantes solo pueden insertar pedidos. No pueden leer pedidos ajenos, consultar datos de jugadores, validar pagos ni darse beneficios. La seguridad se aplica en Supabase, no por ocultar la URL de `admin.html`. La clave publicable y el acceso al HTML son públicos. La base de datos calcula los precios por sí misma para que nadie cambie el total editando el navegador.

**Limitación antispam:** el formulario público puede recibir pedidos falsos o repetidos. No entregues nada sin comprobar el pago. Si se vuelve un problema, añadí CAPTCHA o un endpoint con rate limiting.

## Paso 2: publicar GRATIS en GitHub Pages

1. Extraé el ZIP. Creá un repositorio de GitHub, por ejemplo `survival-store`.
2. **Subí los archivos que están dentro de esta carpeta a la raíz del repositorio**, no el ZIP ni la carpeta contenedora. `index.html` debe quedar en la raíz.
3. Confirmá que `config.js` tiene la URL y la clave publicable del proyecto de Supabase.
4. En GitHub: **Settings > Pages > Build and deployment > Deploy from a branch**. Seleccioná `main` y `/(root)` y guardá.
5. La tienda quedará en una URL como `https://USUARIO.github.io/survival-store/` y el panel en `https://USUARIO.github.io/survival-store/admin.html`.
6. Si usás un dominio propio, configurá el dominio personalizado desde Pages.

La landing funciona sin compilación, sin `npm install` y sin configurar IP del servidor. Para una vista previa local podés usar VS Code + Live Server. **Sin Supabase configurado, se ve la landing pero el formulario queda deshabilitado** para evitar pedidos que nunca lleguen.

## Paso 3: preparar Minecraft (ejemplos orientativos)

**Importante:** los comandos NO se ejecutan desde la web. Copialos y ejecutalos VOS en la consola de Minehost/Pterodactyl. Confirma los nodos según la versión exacta de cada plugin.

### Mochila: 2 filas gratis, hasta 6 en total

Suponiendo Minepacks y LuckPerms:

```text
lp group default permission set backpack.use true
lp group default permission set backpack.size.2 true
```

Cuando un jugador paga una fila adicional semanal y no tiene otras filas compradas:

```text
lp user Steve123 permission settemp backpack.size.3 true 7d replace
```

Si paga 2 filas mensuales y parte de 2:

```text
lp user Steve123 permission settemp backpack.size.4 true 30d replace
```

En el panel elegís **el tamaño total** (de 3 a 6 filas) antes de copiar el comando sugerido. Esto NO detecta por sí solo las filas activas ni renueva su duración: revisá permisos y vencimientos si el mismo jugador compra filas con distintos plazos o renueva antes de que expiren. No prometas que el plugin conservará accesibles los objetos de filas que vencen: probalo con una cuenta de prueba, y avisá a los jugadores antes del vencimiento para que liberen espacio.

### Rangos VIP y VIP+

```text
lp creategroup vip
lp creategroup vipplus
lp group vipplus parent add vip
```

**VIP** por 30 días:

```text
lp user Steve123 parent addtemp vip 30d
```

**VIP+** por 30 días:

```text
lp user Steve123 parent addtemp vipplus 30d
```

Beneficios sugeridos (adaptar permisos exactos a tus plugins):

| Beneficio | VIP | VIP+ |
| --- | --- | --- |
| Prefijo y color en chat | Sí | Sí |
| Homes | 3 | 5 |
| `/craft`, `/hat` | Sí | Sí |
| Kit cada 7 días | Hierro básico | Hierro + consumibles |
| Ender Chest y yunque remotos | — | Sí |
| Vuelo | — | Solo áreas habilitadas, sin PvP |

Kits sugeridos: **VIP:** espada y pico de hierro, 16 filetes, 32 antorchas, escudo. **VIP+:** herramientas de hierro, 32 filetes, 64 antorchas, escudo, 16 botellas de experiencia.

Para implementar prefijos, sets de home, kits de 7 días y los comandos portátiles, configurá LuckPerms, EssentialsX y sus archivos `kits.yml`/permisos compatibles con tus versiones. **No habilites permiso global de `/fly` para VIP+**: requiere una configuración adicional por regiones y combate, o podría dar ventajas injustas. Mientras tanto, activá ese perk solo cuando tengas reglas técnicas que lo limiten.

**Cuidado al renovar**: LuckPerms permite permisos temporales con distintas opciones de acumulación. Comprobá cómo se comporta `replace` antes de usarlo en una renovación; el panel no prorroga automáticamente vencimientos.

## Cambiar precios

`shared.js` contiene los precios visuales. `supabase.sql` contiene los precios **obligatorios** de la base de datos. Si cambiás los precios, actualizá ambos: modificar solo HTML/JavaScript haría que lo mostrado al comprador difiera de lo guardado. En Supabase, cambiar la expresión de una columna `GENERATED ALWAYS` puede requerir recrear la columna o migración SQL, y los cambios deberán probarse antes de publicar.

## Problemas frecuentes

- **La landing se ve pero no deja enviar**: faltan `supabaseUrl` o `supabasePublishableKey` en `config.js`.
- **No aparece un pedido**: revisá `supabase.sql`, la URL/clave y los errores de Network/Console del navegador. No copies claves privadas.
- **No puedo ingresar al admin**: revisá credenciales de Supabase Auth y si el UID figura en `shop_admins`.
- **Error 42501 al insertar**: faltan los GRANT o políticas del SQL, o no se ejecutó el SQL completo.
- **Le doy "Entregado" y no hace nada en MC**: correcto; la entrega siempre es manual desde la consola de Minecraft.
- **Parece un pago aprobado porque enviaron formulario**: NO. Todos los pedidos entran como `pendiente` y nadie obtiene perks hasta que vos verifiques el pago real.

## Nota sobre comisiones y privacidad

No usás Tebex, pero Mercado Pago podría cobrar sus propias comisiones según el tipo de operación/cuenta. Validá las condiciones de tu cuenta. Los datos de nick, Discord y número de operación se almacenan en Supabase y se muestran únicamente a administradores habilitados. Publicá una política de privacidad adecuada si la comunidad crece; evitá pedir imágenes de DNI, contraseñas o códigos de seguridad.
