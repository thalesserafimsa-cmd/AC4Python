# 🎯 Show do Milhão — Python + Supabase

Jogo de perguntas e respostas estilo *Show do Milhão*, com banco de dados em nuvem via **Supabase**.

---

## 📁 Estrutura do projeto

```
AC4Python/
├── show_do_milhao.py   # Código principal do jogo
├── schema.sql          # Script SQL para criar as tabelas + dados de exemplo
├── requirements.txt    # Dependências Python
├── .env.example        # Modelo do arquivo de variáveis de ambiente
└── README.md
```

---

## ⚙️ Configuração inicial

### 1. Banco de dados (Supabase)

1. Acesse [supabase.com](https://supabase.com) e crie um projeto gratuito.
2. No painel SQL Editor, execute o conteúdo de **`schema.sql`** para criar as tabelas `perguntas` e `partidas` e inserir os dados de exemplo.

### 2. Credenciais

```bash
# Copie o modelo e preencha com suas credenciais
cp .env.example .env
```

Edite `.env`:

```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=sua-anon-key-aqui
```

> As credenciais ficam **apenas no `.env`**, que nunca deve ser versionado.

### 3. Dependências Python

```bash
pip install -r requirements.txt
```

---

## ▶️ Como jogar

```bash
python show_do_milhao.py
```

---

## 🎮 Regras do jogo

| # Pergunta | Dificuldade | Prêmio em jogo |
|:----------:|:-----------:|---------------:|
| 1 | Fácil | R$ 1.000 |
| 2 | Fácil | R$ 5.000 |
| 3 | Fácil | R$ 10.000 |
| 4 | Média | R$ 25.000 |
| 5 | Média | R$ 50.000 |
| 6 | Média | R$ 100.000 |
| 7 | Difícil | R$ 200.000 |
| 8 | Difícil | R$ 500.000 |
| 9 | Difícil | R$ 1.000.000 |

- **Acerto**: avança para a próxima pergunta e acumula o prêmio.
- **Erro na 1ª pergunta**: vai para casa com **R$ 0,00**.
- **Erro a partir da 2ª**: mantém o último prêmio conquistado.
- **Desistir**: mantém o prêmio atual e encerra a partida.
- **9 acertos**: leva **R$ 1.000.000**! 🏆

---

## 🗄️ Estrutura das tabelas

### `perguntas`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK gerada automaticamente |
| `enunciado` | TEXT | Texto da pergunta |
| `alternativa_a` … `alternativa_d` | TEXT | Quatro alternativas |
| `resposta` | CHAR(1) | Letra correta (A/B/C/D) |
| `dificuldade` | TEXT | `'Fácil'`, `'Média'` ou `'Difícil'` |

### `partidas`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | BIGSERIAL | PK interna |
| `jogo_id` | UUID | ID único gerado pelo cliente (evita duplicatas) |
| `apelido` | TEXT | Apelido do jogador |
| `valor_ganho` | BIGINT | Prêmio final em reais |
| `tempo_segundos` | NUMERIC | Tempo de resposta (3 casas decimais) |
| `acertos` | INT | Número de perguntas corretas |
| `motivo_encerramento` | TEXT | `acerto_total`, `erro` ou `desistencia` |

---

## 🔒 Segurança

- Credenciais carregadas via `python-dotenv` (nunca *hardcoded*).
- Adicione `.env` ao `.gitignore`:

```
echo ".env" >> .gitignore
```
