// routes/admin.js
// -----------------------------------------------------------------------
// Operaciones administrativas simples para cuando no hay acceso a Shell
// en el hosting. Todas requieren ADMIN_SECRET.
// -----------------------------------------------------------------------

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/usersDb');

const router = express.Router();

function requireAdmin(req, res, next) {
  const configuredSecret = process.env.ADMIN_SECRET;
  const providedSecret = req.get('x-admin-secret') || req.body?.adminSecret;

  if (!configuredSecret) {
    return res.status(503).json({ error: 'ADMIN_SECRET no esta configurado en el servidor.' });
  }

  if (!providedSecret || providedSecret !== configuredSecret) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  next();
}

function habilitarUsuario({ cedula, custCode, nombre }) {
  const cedulaLimpia = String(cedula || '').trim();
  const custCodeLimpio = String(custCode || '').trim();
  const nombreLimpio = nombre ? String(nombre).trim() : null;

  if (!cedulaLimpia || !custCodeLimpio) {
    const err = new Error('Debe indicar cedula y custCode.');
    err.status = 400;
    throw err;
  }

  const hash = bcrypt.hashSync(`cedula-login-disabled-${Date.now()}`, 10);
  const existente = db.prepare('SELECT id FROM app_users WHERE cedula = ?').get(cedulaLimpia);

  if (existente) {
    db.prepare(
      `UPDATE app_users
       SET cust_code = ?, nombre = ?, password_hash = ?, activo = 1,
           must_change_password = 0, updated_at = datetime('now')
       WHERE cedula = ?`
    ).run(custCodeLimpio, nombreLimpio, hash, cedulaLimpia);
    return { accion: 'actualizado', cedula: cedulaLimpia, custCode: custCodeLimpio, nombre: nombreLimpio };
  }

  db.prepare(
    `INSERT INTO app_users (cedula, cust_code, nombre, password_hash, must_change_password)
     VALUES (?, ?, ?, ?, 0)`
  ).run(cedulaLimpia, custCodeLimpio, nombreLimpio, hash);

  return { accion: 'creado', cedula: cedulaLimpia, custCode: custCodeLimpio, nombre: nombreLimpio };
}

router.post('/users', requireAdmin, (req, res) => {
  try {
    const resultado = habilitarUsuario(req.body || {});
    res.json({ ok: true, usuario: resultado });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'No se pudo habilitar la cedula.' });
  }
});

router.get('/users/:cedula', requireAdmin, (req, res) => {
  const user = db
    .prepare('SELECT cedula, cust_code AS custCode, nombre, activo FROM app_users WHERE cedula = ?')
    .get(String(req.params.cedula || '').trim());

  res.json({ ok: true, usuario: user || null });
});

module.exports = router;
