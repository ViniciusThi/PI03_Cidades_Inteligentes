-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Tempo de geração: 25/11/2024 às 18:49
-- Versão do servidor: 10.4.32-MariaDB
-- Versão do PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `pi03`
--

-- --------------------------------------------------------

--
-- Estrutura para tabela `arduino_config`
--

CREATE TABLE `arduino_config` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `ip` varchar(15) DEFAULT NULL,
  `porta` int(11) DEFAULT NULL,
  `ultimo_status` varchar(20) DEFAULT NULL,
  `ultima_conexao` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `bairros`
--

CREATE TABLE `bairros` (
  `id` int(11) NOT NULL,
  `cidade_id` int(11) NOT NULL,
  `nome` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Despejando dados para a tabela `bairros`
--

INSERT INTO `bairros` (`id`, `cidade_id`, `nome`) VALUES
(4, 4, 'Parque Residencial Braz Cavenaghi'),
(5, 5, 'Centro'),
(6, 6, 'Centro');

-- --------------------------------------------------------

--
-- Estrutura para tabela `cidades`
--

CREATE TABLE `cidades` (
  `id` int(11) NOT NULL,
  `estado_id` char(2) NOT NULL,
  `nome` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Despejando dados para a tabela `cidades`
--

INSERT INTO `cidades` (`id`, `estado_id`, `nome`) VALUES
(4, 'SP', 'Itapira'),
(5, 'SP', 'São Paulo'),
(6, 'SP', 'São Paulo');

-- --------------------------------------------------------

--
-- Estrutura para tabela `enderecos`
--

CREATE TABLE `enderecos` (
  `id` int(11) NOT NULL,
  `cep` varchar(9) NOT NULL,
  `rua` varchar(100) NOT NULL,
  `numero` varchar(10) NOT NULL,
  `bairro_id` int(11) NOT NULL,
  `complemento` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Despejando dados para a tabela `enderecos`
--

INSERT INTO `enderecos` (`id`, `cep`, `rua`, `numero`, `bairro_id`, `complemento`) VALUES
(4, '13976513', 'Rua Romualdo Bisinelli', '380', 4, NULL),
(5, '01001000', 'Praça da Sé', 'S/N', 5, NULL),
(6, '01001000', 'Praça da Sé', 'S/N', 6, NULL);

-- --------------------------------------------------------

--
-- Estrutura para tabela `estados`
--

CREATE TABLE `estados` (
  `id` char(2) NOT NULL,
  `nome` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Despejando dados para a tabela `estados`
--

INSERT INTO `estados` (`id`, `nome`) VALUES
('SP', 'SP');

-- --------------------------------------------------------

--
-- Estrutura para tabela `tipos_telhado`
--

CREATE TABLE `tipos_telhado` (
  `id` int(11) NOT NULL,
  `nome` varchar(50) NOT NULL,
  `descricao` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Despejando dados para a tabela `tipos_telhado`
--

INSERT INTO `tipos_telhado` (`id`, `nome`, `descricao`) VALUES
(1, 'intensivo', 'Telhado verde com vegetação de grande porte'),
(2, 'semiintensivo', 'Telhado verde com vegetação de médio porte'),
(3, 'extensivo', 'Telhado verde com vegetação de pequeno porte');

-- --------------------------------------------------------

--
-- Estrutura para tabela `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL,
  `nome_completo` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `senha` varchar(255) NOT NULL,
  `telefone` varchar(15) DEFAULT NULL,
  `endereco_id` int(11) NOT NULL,
  `tipo_telhado_id` int(11) NOT NULL,
  `is_admin` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Despejando dados para a tabela `usuarios`
--

INSERT INTO `usuarios` (`id`, `nome_completo`, `email`, `senha`, `telefone`, `endereco_id`, `tipo_telhado_id`, `is_admin`, `created_at`, `updated_at`) VALUES
(1, 'Vinicius', 'vinicius.tiberio@micropack.com.br', '$2a$10$P3msshlaaJdCbAhFQSkTE.8LUkWpsxy3w2gxhZogaJFODroL5lIim', '19998107280', 4, 1, 0, '2024-11-25 17:01:46', '2024-11-25 17:01:46'),
(3, 'Administrador', 'admin@greensystem.com', '$2a$10$HxRl17fHtqfOgG4gA4hfwem2r.ZFSMGHJCLHMDpKkYBZ/Z48hxk5m', '11999999999', 6, 1, 1, '2024-11-25 17:24:38', '2024-11-25 17:24:38');

--
-- Índices para tabelas despejadas
--

--
-- Índices de tabela `arduino_config`
--
ALTER TABLE `arduino_config`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `usuario_id` (`usuario_id`);

--
-- Índices de tabela `bairros`
--
ALTER TABLE `bairros`
  ADD PRIMARY KEY (`id`),
  ADD KEY `cidade_id` (`cidade_id`);

--
-- Índices de tabela `cidades`
--
ALTER TABLE `cidades`
  ADD PRIMARY KEY (`id`),
  ADD KEY `estado_id` (`estado_id`);

--
-- Índices de tabela `enderecos`
--
ALTER TABLE `enderecos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bairro_id` (`bairro_id`);

--
-- Índices de tabela `estados`
--
ALTER TABLE `estados`
  ADD PRIMARY KEY (`id`);

--
-- Índices de tabela `tipos_telhado`
--
ALTER TABLE `tipos_telhado`
  ADD PRIMARY KEY (`id`);

--
-- Índices de tabela `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `endereco_id` (`endereco_id`),
  ADD KEY `tipo_telhado_id` (`tipo_telhado_id`);

--
-- AUTO_INCREMENT para tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `arduino_config`
--
ALTER TABLE `arduino_config`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `bairros`
--
ALTER TABLE `bairros`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de tabela `cidades`
--
ALTER TABLE `cidades`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de tabela `enderecos`
--
ALTER TABLE `enderecos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de tabela `tipos_telhado`
--
ALTER TABLE `tipos_telhado`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de tabela `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Restrições para tabelas despejadas
--

--
-- Restrições para tabelas `arduino_config`
--
ALTER TABLE `arduino_config`
  ADD CONSTRAINT `arduino_config_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Restrições para tabelas `bairros`
--
ALTER TABLE `bairros`
  ADD CONSTRAINT `bairros_ibfk_1` FOREIGN KEY (`cidade_id`) REFERENCES `cidades` (`id`);

--
-- Restrições para tabelas `cidades`
--
ALTER TABLE `cidades`
  ADD CONSTRAINT `cidades_ibfk_1` FOREIGN KEY (`estado_id`) REFERENCES `estados` (`id`);

--
-- Restrições para tabelas `enderecos`
--
ALTER TABLE `enderecos`
  ADD CONSTRAINT `enderecos_ibfk_1` FOREIGN KEY (`bairro_id`) REFERENCES `bairros` (`id`);

--
-- Restrições para tabelas `usuarios`
--
ALTER TABLE `usuarios`
  ADD CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`endereco_id`) REFERENCES `enderecos` (`id`),
  ADD CONSTRAINT `usuarios_ibfk_2` FOREIGN KEY (`tipo_telhado_id`) REFERENCES `tipos_telhado` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
