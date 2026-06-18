# Consulta de Facturas — Open Orange (acceso externo)

Sistema para que los clientes consulten sus propias facturas de Open Orange
desde internet (celular o PC), sin necesidad de tener usuario en la base
de datos del ERP. Se loguean con su número de cédula y una contraseña que
vos les asignás.

## Cómo funciona (arquitectura)

```
Cliente (celular/PC) → Frontend web → API intermedia → Túnel → MySQL de Open Orange (local, en tu oficina)
```

- La base de datos del ERP **nunca se expone a internet**. Sigue
  funcionando solo dentro de tu red local.
- La API intermedia (este proyecto) corre en un servicio en la nube
  gratuito y es la única que se conecta a tu MySQL, a través de un túnel.
- Los usuarios externos (cédula + contraseña) se guardan en una base de
  datos propia de esta app (SQLite), separada completamente de Open Orange.
- Cada usuario está vinculado a un `CustCode` de Open Orange. La API
  **siempre** filtra las facturas por ese código — un cliente nunca puede
  ver las facturas de otro, ni manipulando la página.

---

## Paso 1 — Preparar un usuario MySQL de solo lectura en Open Orange

Por seguridad, no uses el usuario administrador del ERP para esta API.
Conectate a tu MySQL local y creá un usuario que solo pueda leer:

```sql
CREATE USER 'consulta_web'@'%' IDENTIFIED BY 'una_clave_segura_aqui';
GRANT SELECT ON nombre_base_openorange.Invoice TO 'consulta_web'@'%';
GRANT SELECT ON nombre_base_openorange.InvoiceItemRow TO 'consulta_web'@'%';
GRANT SELECT ON nombre_base_openorange.Customer TO 'consulta_web'@'%';
GRANT SELECT ON nombre_base_openorange.Office TO 'consulta_web'@'%';
FLUSH PRIVILEGES;
```

Ajustá `nombre_base_openorange` al nombre real de tu base.

---

## Paso 2 — Exponer el MySQL local de forma segura (túnel)

**Nunca abras el puerto 3306 directamente a internet.** Usamos
Cloudflare Tunnel, que es gratis y no requiere abrir puertos en tu router.

En la PC de la empresa que está siempre encendida:

1. Crear una cuenta gratis en Cloudflare y agregar (o no) un dominio
   propio — también funciona sin dominio propio usando un subdominio
   `*.trycloudflare.com` para pruebas, aunque para algo permanente
   conviene tener un dominio propio (puede ser barato, ej. .com.py).
2. Instalar `cloudflared` en esa PC (Windows/Linux):
   https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
3. Autenticar y crear un túnel:
   ```
   cloudflared tunnel login
   cloudflared tunnel create openorange-db
   ```
4. Configurar el túnel para exponer el puerto 3306 como un servicio TCP
   privado (Cloudflare Tunnel soporta "private network routing" o bien
   `cloudflared access tcp`). La idea es que la API en la nube se
   conecte mediante `cloudflared` como cliente también, usando
   `cloudflared access tcp --hostname mi-tunel.midominio.com --url 127.0.0.1:3306`
   corriendo como un sidecar en el servicio de Render.

   **Alternativa más simple para empezar:** usar **ngrok** (también
   tiene plan gratis) con `ngrok tcp 3306`, que te da una URL tipo
   `tcp://0.tcp.ngrok.io:12345` para usar como host/puerto en el `.env`
   de la API. Es más rápido de configurar al principio, aunque la URL
   cambia cada vez que reiniciás ngrok en el plan gratis (para una URL
   fija hay que pagar un plan pequeño o usar Cloudflare Tunnel con
   dominio propio, que sí permite una dirección fija gratis).

Decime si querés que profundice en la configuración de Cloudflare Tunnel
o de ngrok paso a paso una vez que decidas cuál usar — son configuraciones
algo más largas y conviene hacerlas con calma, viendo tu caso puntual
(versión de Windows/Linux del servidor, si tenés dominio propio, etc.).

---

## Paso 3 — Configurar y probar la API localmente

1. Instalar Node.js (v18 o superior) en tu PC.
2. Dentro de esta carpeta:
   ```
   npm install
   cp .env.example .env
   ```
3. Editar `.env` con los datos reales:
   - `OO_DB_HOST` / `OO_DB_PORT`: los que te dé el túnel (paso 2).
   - `OO_DB_USER` / `OO_DB_PASSWORD`: el usuario de solo lectura (paso 1).
   - `OO_DB_NAME`: el nombre de tu base de Open Orange.
   - `JWT_SECRET`: generar uno con:
     ```
     node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
     ```
4. Probar localmente:
   ```
   npm start
   ```
5. Verificar que la conexión a Open Orange funciona, abriendo en el
   navegador: `http://localhost:3000/api/salud` → debería responder
   `{"ok":true,"baseDeDatos":"conectada"}`.

---

## Paso 4 — Crear los usuarios (clientes) que podrán ingresar

Por cada cliente que deba acceder, ejecutar:

```
node src/scripts/createUser.js <cedula> <CustCode> "<Nombre del cliente>"
```

Ejemplo:
```
node src/scripts/createUser.js 4123456 CLI0001 "Juan Pérez"
```

El script genera una contraseña temporal y la muestra en pantalla.
Compartila con el cliente por un canal seguro (no por este chat ni por
email sin cifrar si podés evitarlo). En su primer ingreso, la
aplicación le va a pedir cambiarla.

Para resetear la contraseña de alguien que la olvidó, volvé a correr el
mismo comando con la misma cédula: se genera una nueva temporal.

---

## Paso 5 — Desplegar la API gratis en la nube

Con **Render.com** (plan free):

1. Subir este proyecto a un repositorio de GitHub (privado, recomendado).
2. En Render: "New Web Service" → conectar el repositorio.
3. Build command: `npm install`
4. Start command: `npm start`
5. Agregar las variables de entorno del `.env` en la sección
   "Environment" del servicio (las mismas que configuraste localmente).
6. **Importante**: el disco de Render en el plan free es efímero —para
   que la base SQLite de usuarios (`data/app_users.db`) no se borre en
   cada despliegue, hay que agregar un "Persistent Disk" (Render lo
   ofrece, con algunos GB gratis en planes pagos; en el plan 100% free
   sin disco persistente, considerar migrar esa tabla a una base
   Postgres gratuita de Render o Supabase para no perder usuarios al
   reiniciar el servicio). Si querés, te ayudo a adaptar el código para
   usar Postgres en vez de SQLite — es un cambio chico.
7. Una vez desplegado, Render te da una URL pública como
   `https://tu-api.onrender.com`.

---

## Paso 6 — Desplegar el frontend

**Opción simple (recomendada para empezar):** el frontend ya se sirve
desde la misma API (carpeta `public/`), así que con el paso 5 ya está
todo funcionando en la misma URL, por ejemplo
`https://tu-api.onrender.com`.

**Opción separada (si preferís un dominio propio para el frontend):**
desplegar la carpeta `public/` en Vercel o Netlify (gratis), y en
`public/app.js` cambiar la constante `API_BASE` para que apunte a la URL
de la API de Render.

---

## Seguridad — resumen de lo que ya está cubierto

- Contraseñas de usuarios guardadas con hash (bcrypt), nunca en texto plano.
- Token de sesión (JWT) con expiración (8 horas por defecto).
- Límite de intentos de login (8 cada 15 minutos por IP) contra fuerza bruta.
- El filtro de cliente (`CustCode`) siempre viene del token, nunca de lo
  que el navegador envíe en la consulta — así nadie puede ver facturas
  ajenas modificando la URL o el request.
- El detalle de una factura verifica que pertenezca al cliente logueado
  antes de mostrarlo.
- La base de Open Orange se conecta con un usuario de **solo lectura**.

## Pendiente / a decidir con vos

- Elegir entre Cloudflare Tunnel o ngrok para el túnel (paso 2).
- Decidir si migrar la base de usuarios a Postgres para persistencia
  garantizada en el plan free de Render.
- Definir si querés exportar a PDF o Excel desde la web (no incluido
  todavía, se puede agregar).
