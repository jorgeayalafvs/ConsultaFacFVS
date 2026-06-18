// server.js
// -----------------------------------------------------------------------
// Punto de entrada de la API intermedia.
// -----------------------------------------------------------------------

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const invoiceRoutes = require('./routes/invoices');
const { testConnection } = require('./db/openOrangeDb');

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  })
);
app.use(express.json());

// Sirve el frontend simple (si decides usar este mismo servicio para
// alojar tambien la pagina, en vez de Vercel/Netlify por separado).
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', invoiceRoutes);

app.get('/api/salud', async (req, res) => {
  try {
    await testConnection();
    res.json({ ok: true, baseDeDatos: 'conectada' });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'No se pudo conectar a la base de Open Orange.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API de facturas escuchando en el puerto ${PORT}`);
});
