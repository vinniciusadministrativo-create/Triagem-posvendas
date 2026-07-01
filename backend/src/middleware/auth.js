const jwt = require("jsonwebtoken");

/**
 * Middleware de autenticação/autorização via JWT.
 *
 * Valida o header `Authorization: Bearer <token>`, decodifica o JWT e injeta o
 * payload em `req.user`. Se `roles` for informado, restringe o acesso aos perfis
 * listados (responde 403 caso o `role` do usuário não esteja na lista).
 *
 * @param {Array<'vendedor'|'pos_vendas'|'operacional'|'admin'>} [roles=[]]
 *        Perfis autorizados. Lista vazia = qualquer usuário autenticado.
 * @returns {import('express').RequestHandler} Middleware do Express.
 *          Responde 401 (token ausente/inválido/expirado) ou 403 (perfil sem permissão).
 */
function authMiddleware(roles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token não fornecido" });
    }
    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload;
      if (roles.length && !roles.includes(payload.role)) {
        return res.status(403).json({ error: "Acesso negado para este perfil" });
      }
      next();
    } catch {
      return res.status(401).json({ error: "Token inválido ou expirado" });
    }
  };
}

module.exports = authMiddleware;
