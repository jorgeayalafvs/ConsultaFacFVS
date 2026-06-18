// app.js
// -----------------------------------------------------------------------
// Logica del frontend. Sin frameworks, para mantenerlo simple y
// facilmente desplegable en cualquier hosting estatico gratis.
// -----------------------------------------------------------------------

const API_BASE = ''; // si el frontend se sirve desde la misma API, dejar vacio.
// Si el frontend se despliega aparte (Vercel/Netlify), poner aqui la URL
// completa de la API, ej: const API_BASE = 'https://mi-api.onrender.com';

let tokenSesion = localStorage.getItem('token') || null;
let usuarioActual = null;
let paginaActual = 1;

// ---------- Referencias a elementos ----------
const pantallaLogin = document.getElementById('pantallaLogin');
const pantallaPrincipal = document.getElementById('pantallaPrincipal');

const formLogin = document.getElementById('formLogin');
const errorLogin = document.getElementById('errorLogin');

const nombreUsuarioEl = document.getElementById('nombreUsuario');
const btnSalir = document.getElementById('btnSalir');

const formFiltros = document.getElementById('formFiltros');
const fechaDesdeInput = document.getElementById('fechaDesde');
const fechaHastaInput = document.getElementById('fechaHasta');
const errorBusqueda = document.getElementById('errorBusqueda');
const cargandoEl = document.getElementById('cargando');
const sinResultadosEl = document.getElementById('sinResultados');
const envoltorioTabla = document.getElementById('envoltorioTabla');
const cuerpoTabla = document.getElementById('cuerpoTabla');

const paginadorEl = document.getElementById('paginador');
const btnAnterior = document.getElementById('btnAnterior');
const btnSiguiente = document.getElementById('btnSiguiente');
const textoPagina = document.getElementById('textoPagina');

const modalDetalle = document.getElementById('modalDetalle');
const btnCerrarModal = document.getElementById('btnCerrarModal');
const numeroFacturaModal = document.getElementById('numeroFacturaModal');
const cuerpoTablaDetalle = document.getElementById('cuerpoTablaDetalle');

// ---------- Utilidades ----------

function mostrarPantalla(pantalla) {
  [pantallaLogin, pantallaPrincipal].forEach((p) => p.classList.add('oculto'));
  pantalla.classList.remove('oculto');
}

function formatoMoneda(valor) {
  const numero = Number(valor || 0);
  return numero.toLocaleString('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatoFecha(valor) {
  if (!valor) return '';
  const partes = String(valor).slice(0, 10).split('-');
  if (partes.length !== 3) return valor;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

async function llamarApi(ruta, opciones = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opciones.headers || {});
  if (tokenSesion) headers.Authorization = `Bearer ${tokenSesion}`;

  const resp = await fetch(`${API_BASE}/api${ruta}`, Object.assign({}, opciones, { headers }));
  const datos = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const error = new Error(datos.error || 'Ocurrio un error inesperado.');
    error.status = resp.status;
    throw error;
  }
  return datos;
}

function valoresPorDefectoFechas() {
  const hoy = new Date();
  const haceUnMes = new Date();
  haceUnMes.setMonth(haceUnMes.getMonth() - 1);
  fechaHastaInput.value = hoy.toISOString().slice(0, 10);
  fechaDesdeInput.value = haceUnMes.toISOString().slice(0, 10);
}

// ---------- Login ----------

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorLogin.classList.remove('visible');

  const cedula = document.getElementById('cedula').value.trim();
  try {
    const datos = await llamarApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ cedula }),
    });

    tokenSesion = datos.token;
    usuarioActual = datos.user;
    localStorage.setItem('token', tokenSesion);

    iniciarPantallaPrincipal();
  } catch (err) {
    errorLogin.textContent = err.message;
    errorLogin.classList.add('visible');
  }
});

// ---------- Pantalla principal ----------

function iniciarPantallaPrincipal() {
  nombreUsuarioEl.textContent = usuarioActual.nombre ? `· ${usuarioActual.nombre}` : '';
  mostrarPantalla(pantallaPrincipal);
  valoresPorDefectoFechas();
  buscarFacturas(1);
}

btnSalir.addEventListener('click', () => {
  tokenSesion = null;
  usuarioActual = null;
  localStorage.removeItem('token');
  mostrarPantalla(pantallaLogin);
  formLogin.reset();
});

formFiltros.addEventListener('submit', (e) => {
  e.preventDefault();
  buscarFacturas(1);
});

btnAnterior.addEventListener('click', () => buscarFacturas(paginaActual - 1));
btnSiguiente.addEventListener('click', () => buscarFacturas(paginaActual + 1));

async function buscarFacturas(pagina) {
  errorBusqueda.classList.remove('visible');
  sinResultadosEl.classList.add('oculto');
  envoltorioTabla.classList.add('oculto');
  paginadorEl.classList.add('oculto');
  cargandoEl.classList.remove('oculto');

  const fechaDesde = fechaDesdeInput.value;
  const fechaHasta = fechaHastaInput.value;

  try {
    const params = new URLSearchParams({
      fechaDesde, fechaHasta, pagina: String(pagina), porPagina: '50',
    });
    const datos = await llamarApi(`/facturas?${params.toString()}`);

    paginaActual = datos.pagina;
    renderizarTabla(datos.facturas);

    if (!datos.facturas.length) {
      sinResultadosEl.classList.remove('oculto');
    } else {
      envoltorioTabla.classList.remove('oculto');
    }

    if (datos.totalPaginas > 1) {
      paginadorEl.classList.remove('oculto');
      textoPagina.textContent = `Página ${datos.pagina} de ${datos.totalPaginas} (${datos.totalRegistros} facturas)`;
      btnAnterior.disabled = datos.pagina <= 1;
      btnSiguiente.disabled = datos.pagina >= datos.totalPaginas;
    } else {
      paginadorEl.classList.add('oculto');
    }
  } catch (err) {
    if (err.status === 401) {
      tokenSesion = null;
      localStorage.removeItem('token');
      mostrarPantalla(pantallaLogin);
      errorLogin.textContent = 'Su sesión expiró. Inicie sesión nuevamente.';
      errorLogin.classList.add('visible');
      return;
    }
    errorBusqueda.textContent = err.message;
    errorBusqueda.classList.add('visible');
  } finally {
    cargandoEl.classList.add('oculto');
  }
}

function renderizarTabla(facturas) {
  cuerpoTabla.innerHTML = '';
  facturas.forEach((f) => {
    const fila = document.createElement('tr');
    fila.classList.add('fila-clic');
    fila.innerHTML = `
      <td><button class="boton-ver-detalle" type="button">Ver</button></td>
      <td>${f.numero}</td>
      <td>${f.tipo}</td>
      <td>${formatoFecha(f.fecha)}</td>
      <td>${f.hora || ''}</td>
      <td>${f.codigoCliente || ''}</td>
      <td>${f.ruc || ''}</td>
      <td>${f.nombreCliente || ''}</td>
      <td class="num">${formatoMoneda(f.subTotal)}</td>
      <td class="num">${formatoMoneda(f.total)}</td>
      <td>${f.vendedor || ''}</td>
      <td>${f.sucursal || ''}</td>
    `;
    fila.querySelector('.boton-ver-detalle').addEventListener('click', () => abrirDetalle(f.numero));
    cuerpoTabla.appendChild(fila);
  });
}

// ---------- Modal de detalle de items ----------

async function abrirDetalle(numero) {
  numeroFacturaModal.textContent = numero;
  cuerpoTablaDetalle.innerHTML = '<tr><td colspan="6">Cargando…</td></tr>';
  modalDetalle.classList.remove('oculto');

  try {
    const datos = await llamarApi(`/facturas/${numero}/detalle`);
    cuerpoTablaDetalle.innerHTML = '';
    datos.items.forEach((item) => {
      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td>${item.codigo || ''}</td>
        <td>${item.descripcion || ''}</td>
        <td class="num">${formatoMoneda(item.cantidad)}</td>
        <td class="num">${formatoMoneda(item.precio)}</td>
        <td class="num">${formatoMoneda(item.descuento)}</td>
        <td class="num">${formatoMoneda(item.subTotal)}</td>
      `;
      cuerpoTablaDetalle.appendChild(fila);
    });
    if (!datos.items.length) {
      cuerpoTablaDetalle.innerHTML = '<tr><td colspan="6">Sin ítems para mostrar.</td></tr>';
    }
  } catch (err) {
    cuerpoTablaDetalle.innerHTML = `<tr><td colspan="6">${err.message}</td></tr>`;
  }
}

btnCerrarModal.addEventListener('click', () => modalDetalle.classList.add('oculto'));
modalDetalle.addEventListener('click', (e) => {
  if (e.target === modalDetalle) modalDetalle.classList.add('oculto');
});

// ---------- Arranque ----------

(function iniciar() {
  if (tokenSesion) {
    try {
      const payload = JSON.parse(atob(tokenSesion.split('.')[1]));
      usuarioActual = { nombre: payload.nombre, custCode: payload.custCode, mustChangePassword: false };
      iniciarPantallaPrincipal();
      return;
    } catch (e) {
      localStorage.removeItem('token');
    }
  }
  mostrarPantalla(pantallaLogin);
})();
