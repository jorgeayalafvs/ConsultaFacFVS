// routes/auth.js
// -----------------------------------------------------------------------
// Login de clientes externos. El "usuario" es la cedula y la
// "contrasena" se valida contra el hash guardado en nuestra base
// propia (app_users.db), NUNCA contra Open Orange.
// -----------------------------------------------------------------------

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db/usersDb');

const router = express.Router();

// Limite de intentos de login para frenar ataques de fuerza bruta.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 8, // 8 intentos por IP en esa ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesion. Intente de nuevo en unos minutos.' },
});

function logAttempt(cedula, success, ip) {
  db.prepare(
    'INSERT INTO login_attempts (cedula, success, ip) VALUES (?, ?, ?)'
  ).run(cedula, success ? 1 : 0, ip || null);
}

router.post('/login', loginLimiter, (req, res) => {
  const { cedula, password } = req.body || {};

  if (!cedula || !password) {
    return res.status(400).json({ error: 'Debe indicar cedula y contrasena.' });
  }

  const cedulaLimpia = String(cedula).trim();

  const user = db
    .prepare('SELECT * FROM app_users WHERE cedula = ? AND activo = 1')
    .get(cedulaLimpia);

  if (!user) {
    logAttempt(cedulaLimpia, false, req.ip);
    return res.status(401).json({ error: 'Cedula o contrasena incorrecta.' });
  }

  const passwordOk = bcrypt.compareSync(password, user.password_hash);

  if (!passwordOk) {
    logAttempt(cedulaLimpia, false, req.ip);
    return res.status(401).json({ error: 'Cedula o contrasena incorrecta.' });
  }

  logAttempt(cedulaLimpia, true, req.ip);

  const token = jwt.sign(
    {
      id: user.id,
      cedula: user.cedula,
      custCode: user.cust_code,
      nombre: user.nombre,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  return res.json({
    token,
    user: {
      cedula: user.cedula,
      nombre: user.nombre,
      custCode: user.cust_code,
      mustChangePassword: !!user.must_change_password,
    },
  });
});

// Cambio de contrasena (requiere estar logueado).
const { requireAuth } = require('../middleware/auth');

router.post('/cambiar-password', requireAuth, (req, res) => {
  const { passwordActual, passwordNueva } = req.body || {};

  if (!passwordActual || !passwordNueva) {
    return res.status(400).json({ error: 'Debe indicar la contrasena actual y la nueva.' });
  }
  if (passwordNueva.length < 6) {
    return res.status(400).json({ error: 'La nueva contrasena debe tener al menos 6 caracteres.' });
  }

  const user = db.prepare('SELECT * FROM app_users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  const ok = bcrypt.compareSync(passwordActual, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'La contrasena actual no es correcta.' });
  }

  const nuevoHash = bcrypt.hashSync(passwordNueva, 10);
  db.prepare(
    "UPDATE app_users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?"
  ).run(nuevoHash, user.id);

  return res.json({ ok: true, mensaje: 'Contrasena actualizada correctamente.' });
});

module.exports = router;
