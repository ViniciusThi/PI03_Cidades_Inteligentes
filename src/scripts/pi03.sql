-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Tempo de geração: 25/11/2024 às 17:08
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
-- Estrutura para tabela `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `nomeCompleto` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `senha` varchar(255) NOT NULL,
  `telefone` varchar(20) DEFAULT NULL,
  `tipoTelhado` enum('intensivo','semiintensivo','extensivo') NOT NULL,
  `cep` varchar(9) NOT NULL,
  `rua` varchar(255) NOT NULL,
  `numero` varchar(10) NOT NULL,
  `bairro` varchar(255) NOT NULL,
  `cidade` varchar(255) NOT NULL,
  `estado` varchar(2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `isAdmin` tinyint(1) DEFAULT 0,
  `arduinoIp` varchar(15) DEFAULT NULL,
  `arduinoPort` varchar(5) DEFAULT NULL,
  `arduino_id` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Despejando dados para a tabela `users`
--

INSERT INTO `users` (`id`, `nomeCompleto`, `email`, `senha`, `telefone`, `tipoTelhado`, `cep`, `rua`, `numero`, `bairro`, `cidade`, `estado`, `created_at`, `isAdmin`, `arduinoIp`, `arduinoPort`, `arduino_id`) VALUES
(2, 'Administrador', 'admin@greensystem.com', '$2a$10$FCsYJHYXFVHFe9WWarGLmebFtlFLWkJrvqWZPhJiamzgZLbF4E7tq', '11999999999', 'intensivo', '01001000', 'Praça da Sé', 'S/N', 'Sé', 'São Paulo', 'SP', '2024-11-08 22:47:34', 1, NULL, NULL, NULL),
(4, 'vinicius santos tiberio', 'tiberiovinicius@hotmail.com', '$2a$10$T3hMdqmpkZOE4H5fx3Hy5er.F5//4sKLkDQtJgM4YhnVEyr3Ph0.u', '19998107280', 'intensivo', '13976513', 'Rua Romualdo Bisinelli', '380', 'Parque Residencial Braz Cavenaghi', 'Itapira', 'SP', '2024-11-25 16:00:35', 0, NULL, NULL, NULL);

--
-- Índices para tabelas despejadas
--

--
-- Índices de tabela `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `arduino_id` (`arduino_id`);

--
-- AUTO_INCREMENT para tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
