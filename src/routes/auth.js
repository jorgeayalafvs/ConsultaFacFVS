// routes/auth.js
// -----------------------------------------------------------------------
// Login de clientes externos. El "usuario" es la cedula y se valida
// contra nuestra base propia (app_users.db), NUNCA contra Open Orange.
// -----------------------------------------------------------------------

const express = require('express');
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
  const { cedula } = req.body || {};

  if (!cedula) {
    return res.status(400).json({ error: 'Debe indicar cedula.' });
  }

  const cedulaLimpia = String(cedula).trim();

  const user = db
    .prepare('SELECT * FROM app_users WHERE cedula = ? AND activo = 1')
    .get(cedulaLimpia);

  if (!user) {
    logAttempt(cedulaLimpia, false, req.ip);
    return res.status(401).json({ error: 'Cedula no habilitada.' });
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
      mustChangePassword: false,
    },
  });
});

module.exports = router;
