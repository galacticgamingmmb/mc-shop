# Survival Store — minimal dark / GitHub Pages

Tienda estática para Minecraft Survival. Pagos por transferencia al alias `dev.cristianm.mp` y **entrega manual** desde la consola Minecraft. Sin Tebex, sin Node.js, sin servidor web propio.

## Contenido

| Archivo | Uso |
| --- | --- |
| `index.html` | Landing minimalista: catálogo, filtros y formulario de compra |
| `admin.html` | Panel privado: pedidos, precios y productos editables |
| `styles.css`, `app.js`, `admin.js`, `shared.js` | Diseño y código de la tienda |
| `config.js` | Nombre, alias, Supabase, Discord opcional |
| `supabase.sql` | **Instalación nueva** de la base de datos |
| `MIGRAR-V2-A-V3.sql` | Actualiza una tienda V2 existente: amplía beneficios y crea datos de pago editables |
| `MIGRAR-DESDE-V1.sql` | Actualización desde el esquema antiguo V1 (conserva pedidos) |
| `.nojekyll` | GitHub Pages sin procesamiento Jekyll |

## Instalación (tienda nueva)

1. Entrá a https://supabase.com y creá un proyecto.
2. Abrí **SQL Editor** y ejecutá `supabase.sql` entero **una sola vez**.
3. En **Authentication → Users**, creá un usuario administrador con correo y contraseña segura. Copiá su UUID y ejecutá por separado:

   ```sql
   insert into public.shop_admins (user_id)
   values ('PEGAR-UUID-REAL');
   ```

4. En `config.js` completá `supabaseUrl` y `supabasePublishableKey` con la URL y la **publishable key** de ese proyecto. Podés editar `brand`, `paymentAlias` y `supportUrl`.
5. Abrí la página y probá hacer un pedido. Abrí `admin.html` con tu cuenta autorizada para verlo, verificarlo o rechazarlo.
6. Creá un repositorio de GitHub, subí **los archivos que están dentro de esta carpeta a la raíz del repositorio**. `index.html` tiene que quedar en la raíz.
7. En **Settings → Pages → Build and deployment**, elegí **Deploy from a branch**, rama `main`, carpeta `/(root)`.

Links: `https://TUUSUARIO.github.io/TUREPO/` y `https://TUUSUARIO.github.io/TUREPO/admin.html`.

> **Si ya usás la tienda V2:** hacé un backup y ejecutá `MIGRAR-V2-A-V3.sql` una sola vez antes de publicar estos archivos. Conserva productos, pedidos y administradores; agrega datos de transferencia editables y permite hasta 30 beneficios por producto. No ejecutes `supabase.sql` sobre una base existente. Si venís de la antigua V1, usá `MIGRAR-DESDE-V1.sql`.

## Editar o añadir productos

1. Entrá en `admin.html` e iniciá sesión.
2. Abrí la pestaña **Productos**.
3. Tocá **Editar** para cambiar el precio, los días, texto, beneficios, orden, disponibilidad y demás datos, o **+ Nuevo producto** para crear uno.
4. Tocá **Guardar producto**. Los cambios se reflejan al recargar la tienda pública (no tenés que volver a subir los archivos a GitHub).
5. Tocá **Ocultar** cuando no quieras vender un ítem. No se borran los pedidos viejos.

El **código interno** (por ejemplo, `vip` o `kit_inicial`) identifica al producto y no se puede cambiar después de crearlo. Las categorías son Rangos, Mochilas y Otros. Cada producto permite hasta 30 líneas de beneficios (máximo 110 caracteres por línea), precio, cantidad máxima por pedido y tipo de entrega. En la tienda se muestran seis inicialmente y se puede desplegar el resto. La duración en días es obligatoria para rangos y mochilas y opcional para artículos de entrega única:

- **Rango LuckPerms:** campo `grupo LuckPerms` (`vip`, `vipplus`…). El panel sugiere `lp user JUGADOR parent addtemp GRUPO DIASd`.
- **Fila de mochila:** el panel sugiere `lp user JUGADOR permission settemp backpack.size.N true DIASd replace`. Elegí el tamaño total correcto al entregar; el panel **no conoce** los permisos activos de Minecraft.
- **Manual / otro:** podés vender kits, cosméticos y otros productos; el panel registra pedidos pero no genera un comando universal. Indicá qué entregar en la descripción/beneficios y hacelo manualmente en la consola.

## Editar los datos de transferencia

1. Entrá a `admin.html` e iniciá sesión con tu usuario administrador.
2. Abrí la pestaña **Pagos**.
3. Editá nombre completo del titular, alias, CBU/CVU, banco y/o billetera virtual.
4. Guardá. La tarjeta del checkout mostrará `Click para revelar datos` y girará para mostrar los datos cargados.

La información de transferencia se guarda en `shop_payment_settings`. Es pública para que los compradores puedan leerla; solo los usuarios de `shop_admins` pueden modificarla. La animación de giro es visual, no una medida de privacidad.

**Importante:** el comando sugerido **no se ejecuta** al pulsar ningún botón; tenés que copiarlo y ejecutarlo vos. Los productos nuevos no crean automáticamente grupos, kits ni permisos en Minecraft. El vuelo VIP+ debe limitarse a las regiones permitidas y no a PvP.

## Flujo de pago

1. Jugador elige un producto y presiona **Comprar**.
2. Ve el precio y el alias `dev.cristianm.mp`.
3. Transfiere desde Mercado Pago y completa nick/operación.
4. El pedido entra como **Pendiente**.
5. Comprobás **en tu propia cuenta Mercado Pago** que el dinero llegó y coincide con el pedido. Lo marcás **Pago verificado**.
6. Le das el beneficio desde la consola del servidor y lo marcás **Entregado**.

No hay comprobación automática de transferencias. Un número de operación escrito por el jugador **no prueba el pago**. No hay cobro recurrente; los permisos temporales vencen por LuckPerms.

### Seguridad de datos y precios

- El navegador utiliza una clave **pública** de Supabase. **Nunca** publiques claves `service_role`, `sb_secret_...`, claves de Mercado Pago, contraseñas o tokens privados.
- Supabase tiene **RLS**: solo los administradores autorizados pueden cambiar productos, ver pedidos y modificar sus estados. Los visitantes pueden leer únicamente productos activos y **crear** pedidos.
- Un trigger de Supabase calcula y guarda el precio por unidad, total, nombre, duración y tipo de entrega **en el momento del pedido**. Nadie puede autoaprobar un pago modificando HTML o JavaScript.
- Al editar un producto, los pedidos antiguos **conservan** el importe original. Tené en cuenta que un comprador que dejó abierta la página puede ver un precio anterior; si cambiás precios, pedile que recargue antes de transferir.
- El formulario sin Supabase configurado solo muestra la **vista previa** del catálogo; las compras quedan deshabilitadas. No promete guardar pedidos cuando no hay base de datos.
- Recomendación: deshabilitá registros públicos en Supabase Auth si solo necesitás tu cuenta admin. Si aparecen pedidos falsos, agregá CAPTCHA/rate limiting mediante una función Edge.

## Configuración básica de Minecraft

```
lp group default permission set backpack.use true
lp group default permission set backpack.size.2 true
lp creategroup vip
lp creategroup vipplus
lp group vipplus parent add vip
```

Ejemplos de entrega temporal para una cuenta llamada `Steve123`:

```
lp user Steve123 permission settemp backpack.size.3 true 7d replace
lp user Steve123 parent addtemp vip 30d
```

**Cuidado con las renovaciones:** `replace` no acumula por sí solo días restantes. Para agregar días a un permiso existente comprobado, LuckPerms ofrece `accumulate`. Si el jugador tiene varias filas compradas y plazos distintos, revisá manualmente sus permisos y fechas antes de entregar. Comprobá asimismo el comportamiento de objetos de la mochila cuando vence el tamaño extra.

## Personalización visual

La tienda usa CSS local, sin compilación, con modo oscuro fijo. Podés cambiar `--primary` y otras variables en `styles.css`. El catálogo (textos, precios, badges, orden, productos nuevos y visibilidad) se administra desde `admin.html`.
