-- =============================================================
--  Show do Milhão — Script de criação das tabelas no Supabase
-- =============================================================

-- Tabela de perguntas
CREATE TABLE IF NOT EXISTS perguntas (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    enunciado   TEXT        NOT NULL,
    alternativa_a TEXT      NOT NULL,
    alternativa_b TEXT      NOT NULL,
    alternativa_c TEXT      NOT NULL,
    alternativa_d TEXT      NOT NULL,
    resposta    CHAR(1)     NOT NULL CHECK (resposta IN ('A','B','C','D')),
    dificuldade TEXT        NOT NULL CHECK (dificuldade IN ('Fácil','Média','Difícil')),
    criado_em   TIMESTAMPTZ DEFAULT now()
);

-- Tabela de partidas
CREATE TABLE IF NOT EXISTS partidas (
    id                  BIGSERIAL   PRIMARY KEY,
    jogo_id             UUID        NOT NULL UNIQUE,
    apelido             TEXT        NOT NULL,
    valor_ganho         BIGINT      NOT NULL DEFAULT 0,
    tempo_segundos      NUMERIC(10,3) NOT NULL,
    acertos             INT         NOT NULL DEFAULT 0,
    motivo_encerramento TEXT        NOT NULL,
    criado_em           TIMESTAMPTZ DEFAULT now()
);

-- =============================================================
--  ROW LEVEL SECURITY (RLS) — OBRIGATÓRIO para acesso público
-- =============================================================

-- Ativa RLS nas tabelas
ALTER TABLE perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE partidas  ENABLE ROW LEVEL SECURITY;

-- Permite que qualquer pessoa LEIA as perguntas
CREATE POLICY "perguntas_leitura_publica"
  ON perguntas FOR SELECT
  USING (true);

-- Permite que qualquer pessoa INSIRA uma partida
CREATE POLICY "partidas_insercao_publica"
  ON partidas FOR INSERT
  WITH CHECK (true);

-- Permite que qualquer pessoa LEIA o ranking
CREATE POLICY "partidas_leitura_publica"
  ON partidas FOR SELECT
  USING (true);

-- -----------------------------------------------------------------
-- Dados de exemplo (mínimo de 3 por dificuldade para rodar o jogo)
-- -----------------------------------------------------------------

INSERT INTO perguntas (enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, resposta, dificuldade) VALUES
-- Fácil
('Qual é a capital do Brasil?', 'São Paulo', 'Brasília', 'Rio de Janeiro', 'Salvador', 'B', 'Fácil'),
('Quantos lados tem um triângulo?', 'Dois', 'Quatro', 'Três', 'Cinco', 'C', 'Fácil'),
('Qual planeta é conhecido como Planeta Vermelho?', 'Vênus', 'Júpiter', 'Saturno', 'Marte', 'D', 'Fácil'),
('Quem escreveu "Dom Casmurro"?', 'José de Alencar', 'Machado de Assis', 'Clarice Lispector', 'Lima Barreto', 'B', 'Fácil'),
('Qual é o maior oceano do mundo?', 'Atlântico', 'Índico', 'Ártico', 'Pacífico', 'D', 'Fácil'),

-- Média
('Em que ano o Brasil foi descoberto?', '1492', '1500', '1498', '1510', 'B', 'Média'),
('Qual é o símbolo químico do ouro?', 'Ag', 'Fe', 'Au', 'Or', 'C', 'Média'),
('Quem pintou a Mona Lisa?', 'Michelangelo', 'Rafael', 'Caravaggio', 'Leonardo da Vinci', 'D', 'Média'),
('Quantos ossos tem o corpo humano adulto?', '206', '213', '198', '220', 'A', 'Média'),
('Qual é a fórmula da água?', 'CO2', 'NaCl', 'H2O', 'O2', 'C', 'Média'),

-- Difícil
('Qual é o menor país do mundo em área?', 'Mônaco', 'Nauru', 'San Marino', 'Vaticano', 'D', 'Difícil'),
('Quantos bits compõem 1 byte?', '4', '16', '8', '32', 'C', 'Difícil'),
('Quem desenvolveu a teoria da relatividade?', 'Isaac Newton', 'Niels Bohr', 'Max Planck', 'Albert Einstein', 'D', 'Difícil'),
('Qual é o número atômico do carbono?', '8', '6', '12', '4', 'B', 'Difícil'),
('Em qual continente fica o Suriname?', 'África', 'Ásia', 'América do Norte', 'América do Sul', 'D', 'Difícil');
