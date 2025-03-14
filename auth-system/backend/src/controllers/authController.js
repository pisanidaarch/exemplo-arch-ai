// authController.js - Implementação do backend com Node.js e Express
// Este seria o controlador que gerencia as rotas de autenticação

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const db = require('../database'); // Conexão com o banco de dados
const { sendEmail } = require('../services/emailService');

// Configuração de Rate Limiting para proteger contra ataques de força bruta
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // limite de 5 tentativas
  message: {
    error: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware para validação de entrada
const loginValidation = [
  body('username').trim().notEmpty().withMessage('Usuário ou e-mail é obrigatório'),
  body('password').trim().notEmpty().withMessage('Senha é obrigatória'),
];

/**
 * Rota de login
 * POST /api/auth/login
 */
router.post('/login', loginLimiter, loginValidation, async (req, res) => {
  // Validar entrada
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { username, password } = req.body;

  try {
    // Buscar usuário pelo nome de usuário ou e-mail
    const user = await db.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
      [username]
    );

    if (user.rows.length === 0) {
      // Não revelamos se o usuário existe ou não por segurança
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const userData = user.rows[0];

    // Verificar se a conta está ativa
    if (!userData.is_active) {
      return res.status(401).json({ error: 'Conta desativada. Entre em contato com o suporte.' });
    }

    // Verificar senha
    const validPassword = await bcrypt.compare(password, userData.password_hash);
    if (!validPassword) {
      // Registrar tentativa falha para possível bloqueio
      await recordFailedAttempt(userData.id);
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    // Verificar se o usuário está bloqueado por muitas tentativas
    const isBlocked = await checkUserBlocked(userData.id);
    if (isBlocked) {
      return res.status(401).json({
        error: 'Conta bloqueada. Tente novamente em 30 minutos.'
      });
    }

    // Verificar se MFA está ativado
    const mfaEnabled = await checkMfaEnabled(userData.id);
    if (mfaEnabled) {
      // Gerar e enviar código MFA
      const mfaCode = generateMfaCode();
      await storeMfaCode(userData.id, mfaCode);
      await sendMfaCode(userData.email, mfaCode);

      // Retornar indicação de que MFA é necessário
      return res.status(200).json({
        requireMfa: true,
        message: 'Código de verificação enviado'
      });
    }

    // Se não precisar de MFA, gerar tokens JWT
    const tokens = generateTokens(userData);

    // Armazenar tokens no banco de dados
    await storeTokens(userData.id, tokens);

    // Retornar tokens para o cliente
    return res.status(200).json(tokens);

  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Verificação de código MFA
 * POST /api/auth/mfa/verify
 */
router.post('/mfa/verify', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Código de verificação é obrigatório' });
  }

  try {
    // Verificar o código MFA
    const mfaResult = await verifyMfaCode(code);

    if (!mfaResult.valid) {
      return res.status(401).json({ error: 'Código inválido ou expirado' });
    }

    // Buscar dados do usuário
    const user = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [mfaResult.userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userData = user.rows[0];

    // Gerar tokens JWT
    const tokens = generateTokens(userData);

    // Armazenar tokens no banco de dados
    await storeTokens(userData.id, tokens);

    // Marcar código como usado
    await markMfaCodeAsUsed(code);

    // Retornar tokens para o cliente
    return res.status(200).json(tokens);

  } catch (error) {
    console.error('Erro na verificação MFA:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Solicitar redefinição de senha
 * POST /api/auth/password/reset-request
 */
router.post('/password/reset-request',
  body('email').isEmail().withMessage('E-mail inválido'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email } = req.body;

    try {
      // Verificar se o e-mail existe
      const user = await db.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      // Sempre retornamos sucesso mesmo se o e-mail não existir (segurança)
      if (user.rows.length === 0) {
        return res.status(200).json({
          message: 'Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.'
        });
      }

      const userData = user.rows[0];

      // Gerar token único para redefinição de senha
      const resetToken = uuidv4();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Expira em 1 hora

      // Salvar token no banco de dados
      await db.query(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [userData.id, resetToken, expiresAt]
      );

      // Enviar e-mail com link para redefinição
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      await sendEmail(
        email,
        'Redefinição de senha',
        `Clique no link abaixo para redefinir sua senha: ${resetLink}`
      );

      return res.status(200).json({
        message: 'Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.'
      });

    } catch (error) {
      console.error('Erro na solicitação de redefinição de senha:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

/**
 * Logout - Invalidar tokens
 * POST /api/auth/logout
 */
router.post('/logout', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Invalidar o token no banco de dados
    await db.query(
      'UPDATE auth_tokens SET revoked = TRUE WHERE token = $1',
      [token]
    );

    return res.status(200).json({ message: 'Logout realizado com sucesso' });

  } catch (error) {
    console.error('Erro ao realizar logout:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * Atualização de token
 * POST /api/auth/refresh-token
 */
router.post('/refresh-token', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Refresh token não fornecido' });
  }

  try {
    // Verificar se o refresh token existe e não está revogado
    const tokenResult = await db.query(
      'SELECT * FROM auth_tokens WHERE refresh_token = $1 AND revoked = FALSE AND expires_at > NOW()',
      [refresh_token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ error: 'Refresh token inválido ou expirado' });
    }

    const tokenData = tokenResult.rows[0];

    // Buscar dados do usuário
    const user = await db.query(
      'SELECT * FROM users WHERE id = $1 AND is_active = TRUE',
      [tokenData.user_id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado ou desativado' });
    }

    const userData = user.rows[0];

    // Revogar o token antigo
    await db.query(
      'UPDATE auth_tokens SET revoked = TRUE WHERE refresh_token = $1',
      [refresh_token]
    );

    // Gerar novos tokens
    const tokens = generateTokens(userData);

    // Armazenar novos tokens
    await storeTokens(userData.id, tokens);

    // Retornar novos tokens
    return res.status(200).json(tokens);

  } catch (error) {
    console.error('Erro ao atualizar token:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Funções auxiliares

/**
 * Gera tokens JWT para autenticação
 * @param {Object} user - Dados do usuário
 * @returns {Object} Tokens gerados
 */
function generateTokens(user) {
  // Payload do token
  const payload = {
    userId: user.id,
    username: user.username,
    email: user.email
  };

  // Gerar token JWT com expiração
  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: '1h' } // Token expira em 1 hora
  );

  // Gerar refresh token com expiração mais longa
  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' } // Refresh token expira em 7 dias
  );

  return {
    token,
    refresh_token: refreshToken
  };
}

/**
 * Armazena tokens no banco de dados
 * @param {string} userId - ID do usuário
 * @param {Object} tokens - Tokens gerados
 */
async function storeTokens(userId, tokens) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Define expiração para 7 dias

  await db.query(
    'INSERT INTO auth_tokens (user_id, token, refresh_token, expires_at) VALUES ($1, $2, $3, $4)',
    [userId, tokens.token, tokens.refresh_token, expiresAt]
  );
}

/**
 * Registra tentativa de login falha
 * @param {string} userId - ID do usuário
 */
async function recordFailedAttempt(userId) {
  await db.query(
    'INSERT INTO login_attempts (user_id, success) VALUES ($1, FALSE)',
    [userId]
  );
}

/**
 * Verifica se o usuário está bloqueado por muitas tentativas
 * @param {string} userId - ID do usuário
 * @returns {boolean} Verdadeiro se o usuário estiver bloqueado
 */
async function checkUserBlocked(userId) {
  const result = await db.query(
    `SELECT COUNT(*) as count FROM login_attempts 
     WHERE user_id = $1 AND success = FALSE AND created_at > NOW() - INTERVAL '30 minutes'`,
    [userId]
  );

  // Bloquear após 5 tentativas falhas em 30 minutos
  return result.rows[0].count >= 5;
}

/**
 * Verifica se o MFA está habilitado para o usuário
 * @param {string} userId - ID do usuário
 * @returns {boolean} Verdadeiro se MFA estiver habilitado
 */
async function checkMfaEnabled(userId) {
  const result = await db.query(
    'SELECT mfa_enabled FROM users WHERE id = $1',
    [userId]
  );

  return result.rows[0].mfa_enabled;
}

/**
 * Gera código MFA de 6 dígitos
 * @returns {string} Código MFA
 */
function generateMfaCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Armazena código MFA no banco de dados
 * @param {string} userId - ID do usuário
 * @param {string} code - Código MFA
 */
async function storeMfaCode(userId, code) {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Expira em 10 minutos

  await db.query(
    'INSERT INTO mfa_codes (user_id, code, expires_at) VALUES ($1, $2, $3)',
    [userId, code, expiresAt]
  );
}

/**
 * Envia código MFA por e-mail
 * @param {string} email - E-mail do usuário
 * @param {string} code - Código MFA
 */
async function sendMfaCode(email, code) {
  await sendEmail(
    email,
    'Código de Verificação',
    `Seu código de verificação é: ${code}. Válido por 10 minutos.`
  );
}

/**
 * Verifica se o código MFA é válido
 * @param {string} code - Código MFA
 * @returns {Object} Resultado da verificação
 */
async function verifyMfaCode(code) {
  const result = await db.query(
    `SELECT * FROM mfa_codes 
     WHERE code = $1 AND used = FALSE AND expires_at > NOW()`,
    [code]
  );

  if (result.rows.length === 0) {
    return { valid: false };
  }

  return {
    valid: true,
    userId: result.rows[0].user_id
  };
}

/**
 * Marca código MFA como usado
 * @param {string} code - Código MFA
 */
async function markMfaCodeAsUsed(code) {
  await db.query(
    'UPDATE mfa_codes SET used = TRUE WHERE code = $1',
    [code]
  );
}

module.exports = router;