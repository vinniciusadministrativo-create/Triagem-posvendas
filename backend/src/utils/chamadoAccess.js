const pool = require("../db");

/**
 * Verifica se um chamado foi compartilhado com um usuário.
 *
 * @param {number|string} chamadoId ID do chamado.
 * @param {number} userId ID do usuário.
 * @returns {Promise<boolean>}
 */
async function isShared(chamadoId, userId) {
  const { rows } = await pool.query(
    "SELECT 1 FROM chamado_shares WHERE chamado_id = $1 AND user_id = $2 LIMIT 1",
    [chamadoId, userId]
  );
  return rows.length > 0;
}

/**
 * Regra única de autorização de leitura/participação em um chamado.
 *
 * - `pos_vendas`, `admin` e `operacional` têm acesso a qualquer chamado (gerem o kanban).
 * - `vendedor` só acessa chamados próprios **ou** compartilhados com ele.
 *
 * Use {@link canAccessChamadoRow} quando já tiver o registro do chamado em mãos
 * (evita uma query); use {@link canAccessChamadoById} quando tiver apenas o ID.
 *
 * @param {{id:number, role:string}} user Usuário autenticado (de `req.user`).
 * @param {{id:number|string, vendedor_id:number}|null} chamado Registro do chamado.
 * @returns {Promise<boolean>}
 */
async function canAccessChamadoRow(user, chamado) {
  if (!chamado) return false;
  if (user.role !== "vendedor") return true;
  if (chamado.vendedor_id === user.id) return true;
  return isShared(chamado.id, user.id);
}

/**
 * Igual a {@link canAccessChamadoRow}, mas busca o chamado pelo ID.
 * Retorna `false` também quando o chamado não existe.
 *
 * @param {{id:number, role:string}} user Usuário autenticado.
 * @param {number|string} chamadoId ID do chamado.
 * @returns {Promise<boolean>}
 */
async function canAccessChamadoById(user, chamadoId) {
  if (user.role !== "vendedor") {
    const { rows } = await pool.query("SELECT 1 FROM chamados WHERE id = $1 LIMIT 1", [chamadoId]);
    return rows.length > 0;
  }
  const { rows } = await pool.query(
    `SELECT 1 FROM chamados c
       LEFT JOIN chamado_shares s ON s.chamado_id = c.id AND s.user_id = $2
      WHERE c.id = $1 AND (c.vendedor_id = $2 OR s.user_id = $2)
      LIMIT 1`,
    [chamadoId, user.id]
  );
  return rows.length > 0;
}

module.exports = { isShared, canAccessChamadoRow, canAccessChamadoById };
