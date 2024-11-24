-- Inserir usuário administrador
INSERT INTO users (
    nomeCompleto,
    email,
    senha,
    telefone,
    tipoTelhado,
    cep,
    rua,
    numero,
    bairro,
    cidade,
    estado,
    isAdmin
) VALUES (
    'Administrador',
    'admin@greensystem.com',
    '$2a$10$YourHashedPasswordHere', -- Vamos gerar isso com bcrypt
    '11999999999',
    'intensivo',
    '01001000',
    'Praça da Sé',
    'S/N',
    'Sé',
    'São Paulo',
    'SP',
    TRUE
); 