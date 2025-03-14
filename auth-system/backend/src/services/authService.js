// authService.js - Serviço para gerenciar a autenticação

class AuthService {
  constructor() {
    this.apiUrl = process.env.REACT_APP_API_URL || 'https://api.example.com';
    this.tokenKey = 'token';
    this.refreshTokenKey = 'refresh_token';
  }

  /**
   * Realiza o login do usuário
   * @param {string} username - E-mail ou nome de usuário
   * @param {string} password - Senha do usuário
   * @returns {Promise} Promise com o resultado da autenticação
   */
  async login(username, password) {
    try {
      const response = await fetch(`${this.apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include', // Necessário para cookies
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao realizar login');
      }

      return data;
    } catch (error) {
      console.error('Erro no login:', error);
      throw error;
    }
  }

  /**
   * Verifica o código MFA
   * @param {string} code - Código de verificação MFA
   * @returns {Promise} Promise com o resultado da verificação MFA
   */
  async verifyMfa(code) {
    try {
      const response = await fetch(`${this.apiUrl}/api/auth/mfa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Código MFA inválido');
      }

      return data;
    } catch (error) {
      console.error('Erro na verificação MFA:', error);
      throw error;
    }
  }

  /**
   * Solicita redefinição de senha
   * @param {string} email - E-mail do usuário
   * @returns {Promise} Promise com o resultado da solicitação
   */
  async requestPasswordReset(email) {
    try {
      const response = await fetch(`${this.apiUrl}/api/auth/password/reset-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao solicitar redefinição de senha');
      }

      return data;
    } catch (error) {
      console.error('Erro na solicitação de redefinição de senha:', error);
      throw error;
    }
  }

  /**
   * Realiza o logout do usuário
   * @returns {Promise} Promise indicando sucesso do logout
   */
  async logout() {
    try {
      // Chamar API para invalidar tokens no servidor
      await fetch(`${this.apiUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`,
        },
        credentials: 'include',
      });
    } catch (error) {
      console.error('Erro ao realizar logout no servidor:', error);
    } finally {
      // Remover tokens localmente independentemente da resposta do servidor
      this.removeTokens();
    }
  }

  /**
   * Armazena tokens de autenticação
   * @param {Object} data - Objeto contendo token e refresh_token
   * @param {boolean} remember - Se deve persistir os tokens
   */
  saveTokens(data, remember = false) {
    const storage = remember ? localStorage : sessionStorage;

    if (data.token) {
      storage.setItem(this.tokenKey, data.token);
    }

    if (data.refresh_token) {
      storage.setItem(this.refreshTokenKey, data.refresh_token);
    }
  }

  /**
   * Remove tokens de autenticação
   */
  removeTokens() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.refreshTokenKey);
  }

  /**
   * Obtém o token JWT atual
   * @returns {string|null} Token JWT ou null
   */
  getToken() {
    return localStorage.getItem(this.tokenKey) ||
           sessionStorage.getItem(this.tokenKey);
  }

  /**
   * Obtém o token de atualização
   * @returns {string|null} Refresh token ou null
   */
  getRefreshToken() {
    return localStorage.getItem(this.refreshTokenKey) ||
           sessionStorage.getItem(this.refreshTokenKey);
  }

  /**
   * Verifica se o usuário está autenticado
   * @returns {boolean} Verdadeiro se autenticado
   */
  isAuthenticated() {
    return !!this.getToken();
  }

  /**
   * Atualiza o token utilizando o refresh token
   * @returns {Promise} Promise com o novo token
   */
  async refreshAccessToken() {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      throw new Error('Refresh token não disponível');
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        this.removeTokens(); // Limpar tokens inválidos
        throw new Error(data.error || 'Falha ao atualizar token');
      }

      // Salvar novos tokens
      this.saveTokens(data, true);
      return data.token;
    } catch (error) {
      console.error('Erro ao atualizar token:', error);
      throw error;
    }
  }
}

export default new AuthService();