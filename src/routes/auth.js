// routes/auth.js
// -----------------------------------------------------------------------
// Login de clientes externos. Como la cedula y el CustCode son iguales,
// se usa la cedula ingresada como custCode para filtrar facturas.
// -----------------------------------------------------------------------

const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Limite de intentos de login para frenar ataques de fuerza bruta.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 8, // 8 intentos por IP en esa ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesion. Intente de nuevo en unos minutos.' },
});

router.post('/login', loginLimiter, (req, res) => {
  const { cedula } = req.body || {};

  if (!cedula) {
    return res.status(400).json({ error: 'Debe indicar cedula.' });
  }

  const cedulaLimpia = String(cedula).trim();

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'JWT_SECRET no esta configurado en el servidor.' });
  }

  const token = jwt.sign(
    {
      id: cedulaLimpia,
      cedula: cedulaLimpia,
      custCode: cedulaLimpia,
      nombre: null,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  return res.json({
    token,
    user: {
      cedula: cedulaLimpia,
      nombre: null,
      custCode: cedulaLimpia,
      mustChangePassword: false,
    },
  });
});

module.exports = router;
