const pool = require('../config/mysql');
const bcrypt = require('bcryptjs');

// Obter todos os usuários
exports.getUsers = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    try {
      const [users] = await connection.execute(
        'SELECT id, nome, email, data_criacao, ultimo_acesso, admin FROM usuarios'
      );
      
      res.json(users);
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Erro ao buscar usuários:', err);
    res.status(500).json({ msg: 'Erro ao buscar usuários' });
  }
};

// Obter usuário por ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    
    try {
      const [user] = await connection.execute(
        'SELECT id, nome, email, data_criacao, ultimo_acesso, admin FROM usuarios WHERE id = ?',
        [id]
      );
      
      if (user.length === 0) {
        return res.status(404).json({ msg: 'Usuário não encontrado' });
      }
      
      res.json(user[0]);
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Erro ao buscar usuário:', err);
    res.status(500).json({ msg: 'Erro ao buscar usuário' });
  }
};

// Atualizar usuário
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, password, admin } = req.body;
    
    const connection = await pool.getConnection();
    
    try {
      // Verificar se o usuário existe
      const [userExists] = await connection.execute(
        'SELECT id FROM usuarios WHERE id = ?',
        [id]
      );
      
      if (userExists.length === 0) {
        return res.status(404).json({ msg: 'Usuário não encontrado' });
      }
      
      // Preparar os dados para atualização
      const updateData = [];
      const updateParams = [];
      
      if (nome) {
        updateData.push('nome = ?');
        updateParams.push(nome);
      }
      
      if (email) {
        updateData.push('email = ?');
        updateParams.push(email);
      }
      
      if (password) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        updateData.push('senha = ?');
        updateParams.push(hashedPassword);
      }
      
      if (admin !== undefined) {
        updateData.push('admin = ?');
        updateParams.push(admin ? 1 : 0);
      }
      
      if (updateData.length === 0) {
        return res.status(400).json({ msg: 'Nenhum dado fornecido para atualização' });
      }
      
      // Adicionar id para a query
      updateParams.push(id);
      
      await connection.execute(
        `UPDATE usuarios SET ${updateData.join(', ')} WHERE id = ?`,
        updateParams
      );
      
      res.json({ msg: 'Usuário atualizado com sucesso' });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err);
    res.status(500).json({ msg: 'Erro ao atualizar usuário' });
  }
};

// Excluir usuário
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    
    try {
      // Verificar se o usuário existe
      const [userExists] = await connection.execute(
        'SELECT id FROM usuarios WHERE id = ?',
        [id]
      );
      
      if (userExists.length === 0) {
        return res.status(404).json({ msg: 'Usuário não encontrado' });
      }
      
      // Impedir a exclusão de usuários administradores
      const [isAdmin] = await connection.execute(
        'SELECT admin FROM usuarios WHERE id = ?',
        [id]
      );
      
      if (isAdmin[0].admin === 1) {
        return res.status(403).json({ msg: 'Não é possível excluir um usuário administrador' });
      }
      
      // Excluir registros relacionados
      // É recomendável usar transações para garantir a integridade dos dados
      await connection.beginTransaction();
      
      try {
        // Excluir configurações do Arduino
        await connection.execute(
          'DELETE FROM arduino_config WHERE usuario_id = ?',
          [id]
        );
        
        // Excluir o usuário
        await connection.execute(
          'DELETE FROM usuarios WHERE id = ?',
          [id]
        );
        
        await connection.commit();
        
        res.json({ msg: 'Usuário excluído com sucesso' });
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Erro ao excluir usuário:', err);
    res.status(500).json({ msg: 'Erro ao excluir usuário' });
  }
}; 