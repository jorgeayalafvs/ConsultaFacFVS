// routes/invoices.js
// -----------------------------------------------------------------------
// Endpoints de consulta de facturas. Basado en la logica de
// InvoiceListFvs.py (Resume/Detailed) pero MUY simplificado: solo los
// filtros y columnas que la app necesita.
//
// REGLA DE ORO DE SEGURIDAD: el filtro por CustCode SIEMPRE viene del
// token del usuario logueado (req.user.custCode), nunca de lo que
// mande el cliente en la peticion. Asi, aunque alguien manipule la
// peticion HTTP, jamas puede ver facturas de otro cliente.
// -----------------------------------------------------------------------

const express = require('express');
const { pool } = require('../db/openOrangeDb');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Tipos de documento de Invoice.InvoiceType en Open Orange:
// 0 = Factura, 1 = Nota de Credito, 2 = Nota de Debito
const TIPO_INVOICE = {
  0: 'FAC',
  1: 'NC',
  2: 'ND',
};

function parseFecha(valor, nombreCampo) {
  if (!valor) return null;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    throw new Error(`El campo ${nombreCampo} no es una fecha valida.`);
  }
  return valor; // YYYY-MM-DD, mysql2 lo interpreta bien como parametro
}

function texto(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor);
}

function numero(valor) {
  if (valor === null || valor === undefined || valor === '') return 0;
  return Number(valor);
}

function fechaJson(valor) {
  if (!valor) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).slice(0, 10);
}

function detalleError(err) {
  return err?.sqlMessage || err?.message || err?.code || 'sin detalle tecnico';
}

// GET /api/facturas?fechaDesde=2026-01-01&fechaHasta=2026-06-18&pagina=1
router.get('/facturas', requireAuth, async (req, res) => {
  try {
    const { fechaDesde, fechaHasta } = req.query;
    const custCode = req.user.custCode; // SIEMPRE del token, nunca del query string

    if (!fechaDesde || !fechaHasta) {
      return res.status(400).json({ error: 'Debe indicar fechaDesde y fechaHasta.' });
    }

    parseFecha(fechaDesde, 'fechaDesde');
    parseFecha(fechaHasta, 'fechaHasta');

    const pagina = Math.max(parseInt(req.query.pagina, 10) || 1, 1);
    const porPagina = Math.min(Math.max(parseInt(req.query.porPagina, 10) || 50, 1), 200);
    const offset = (pagina - 1) * porPagina;

    const sql = `
      SELECT
        I.SerNr            AS numero,
        I.InvoiceType       AS tipoCodigo,
        I.TransDate         AS fecha,
        I.CustCode          AS codigoCliente,
        I.CustName          AS nombreCliente,
        I.SubTotal          AS subTotal,
        I.Total             AS total
      FROM Invoice I
      WHERE I.CustCode = ?
        AND I.TransDate BETWEEN ? AND ?
      ORDER BY I.TransDate DESC, I.SerNr DESC
      LIMIT ${porPagina} OFFSET ${offset}
    `;

    const [filas] = await pool.query(sql, [
      custCode, fechaDesde, fechaHasta,
    ]);

    const resultado = filas.map((f) => ({
      numero: texto(f.numero),
      tipo: TIPO_INVOICE[f.tipoCodigo] || 'FAC',
      numeroTimbrado: null,
      fecha: fechaJson(f.fecha),
      hora: '',
      codigoCliente: texto(f.codigoCliente),
      ruc: '',
      nombreCliente: texto(f.nombreCliente),
      subTotal: numero(f.subTotal),
      total: numero(f.total),
      vendedor: '',
      sucursal: '',
    }));

    const haySiguientePagina = resultado.length === porPagina;
    const totalRegistrosEstimado = offset + resultado.length + (haySiguientePagina ? 1 : 0);

    return res.json({
      pagina,
      porPagina,
      totalRegistros: totalRegistrosEstimado,
      totalPaginas: haySiguientePagina ? pagina + 1 : pagina,
      facturas: resultado,
    });
  } catch (err) {
    console.error('Error en /api/facturas:', detalleError(err));
    const detalle = process.env.SHOW_SQL_ERRORS === '1' ? ` Detalle: ${detalleError(err)}` : '';
    return res.status(500).json({ error: `Error al consultar las facturas. Intente nuevamente.${detalle}` });
  }
});

// GET /api/facturas/:numero/detalle  -> items de una factura puntual
router.get('/facturas/:numero/detalle', requireAuth, async (req, res) => {
  try {
    const { numero } = req.params;
    const custCode = req.user.custCode;

    // Primero verificamos que la factura pedida sea efectivamente
    // del cliente logueado, para que nadie pueda ver el detalle de
    // una factura ajena adivinando el numero.
    const [cabecera] = await pool.query(
      'SELECT SerNr, CustCode FROM Invoice WHERE SerNr = ? LIMIT 1',
      [numero]
    );

    if (!cabecera.length || String(cabecera[0].CustCode) !== String(custCode)) {
      return res.status(404).json({ error: 'Factura no encontrada.' });
    }

    const sql = `
      SELECT
        IT.ArtCode    AS codigo,
        IT.Name       AS descripcion,
        IT.Qty        AS cantidad,
        IT.Price      AS precio,
        IT.Discount   AS descuento,
        IT.RowTotal   AS subTotal
      FROM InvoiceItemRow IT
      INNER JOIN Invoice I ON I.internalId = IT.masterId
      WHERE I.SerNr = ?
      ORDER BY IT.RowNr ASC
    `;

    const [items] = await pool.query(sql, [numero]);

    return res.json({ numero, items });
  } catch (err) {
    console.error('Error en /api/facturas/:numero/detalle:', detalleError(err));
    const detalle = process.env.SHOW_SQL_ERRORS === '1' ? ` Detalle: ${detalleError(err)}` : '';
    return res.status(500).json({ error: `Error al consultar el detalle de la factura.${detalle}` });
  }
});

module.exports = router;
