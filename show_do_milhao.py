"""
Show do Milhão — Jogo de perguntas e respostas integrado ao Supabase.

Estrutura das tabelas esperadas no Supabase:
  perguntas (id, enunciado, alternativa_a, alternativa_b, alternativa_c,
             alternativa_d, resposta, dificuldade)
  partidas  (id, jogo_id, apelido, valor_ganho, tempo_segundos,
             acertos, motivo_encerramento)

Veja schema.sql para o script completo de criação.
"""

import os
import random
import time
import uuid

from dotenv import load_dotenv
from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

load_dotenv()

SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY: str = os.environ.get("SUPABASE_KEY", "")

# Tabela de prêmios (índice 0 = 0 acertos = R$ 0)
PREMIOS: list[int] = [
    0,           # 0 acertos
    1_000,       # 1
    5_000,       # 2
    10_000,      # 3
    25_000,      # 4
    50_000,      # 5
    100_000,     # 6
    200_000,     # 7
    500_000,     # 8
    1_000_000,   # 9
]

DIFICULDADES_ORDEM: list[str] = ["Fácil", "Média", "Difícil"]
PERGUNTAS_POR_DIFICULDADE: int = 3
TOTAL_PERGUNTAS: int = PERGUNTAS_POR_DIFICULDADE * len(DIFICULDADES_ORDEM)  # 9

ALTERNATIVAS_VALIDAS: set[str] = {"A", "B", "C", "D"}

# ---------------------------------------------------------------------------
# Utilitários de formatação
# ---------------------------------------------------------------------------


def formatar_premio(valor: int) -> str:
    """Formata um valor inteiro como moeda brasileira."""
    return f"R$ {valor:,.0f}".replace(",", ".")


def linha_separadora(char: str = "─", largura: int = 60) -> str:
    return char * largura


def cabecalho(titulo: str) -> None:
    print("\n" + linha_separadora("═"))
    print(f"  {titulo}")
    print(linha_separadora("═"))


# ---------------------------------------------------------------------------
# Conexão com o Supabase
# ---------------------------------------------------------------------------


def obter_cliente() -> Client:
    """Cria e retorna o cliente Supabase. Lança ValueError se as variáveis
    de ambiente não estiverem configuradas."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(
            "Variáveis de ambiente SUPABASE_URL e SUPABASE_KEY não configuradas.\n"
            "Copie .env.example para .env e preencha com suas credenciais."
        )
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# ---------------------------------------------------------------------------
# Lógica de perguntas
# ---------------------------------------------------------------------------


def buscar_perguntas(cliente: Client) -> list[dict]:
    """Busca todas as perguntas do banco e sorteia 3 de cada dificuldade,
    retornando-as na ordem Fácil → Média → Difícil.

    Lança RuntimeError se não houver perguntas suficientes.
    """
    selecionadas: list[dict] = []

    for dificuldade in DIFICULDADES_ORDEM:
        resposta = (
            cliente.table("perguntas")
            .select("*")
            .eq("dificuldade", dificuldade)
            .execute()
        )

        disponiveis: list[dict] = resposta.data or []

        if len(disponiveis) < PERGUNTAS_POR_DIFICULDADE:
            raise RuntimeError(
                f"Perguntas insuficientes para a dificuldade '{dificuldade}'. "
                f"Necessário: {PERGUNTAS_POR_DIFICULDADE}, "
                f"disponível: {len(disponiveis)}."
            )

        selecionadas.extend(random.sample(disponiveis, PERGUNTAS_POR_DIFICULDADE))

    return selecionadas


def exibir_pergunta(numero: int, pergunta: dict, acertos: int) -> None:
    """Exibe a pergunta formatada com o prêmio atual em jogo."""
    dificuldade = pergunta.get("dificuldade", "")
    premio_atual = formatar_premio(PREMIOS[acertos])
    proximo_premio = formatar_premio(PREMIOS[acertos + 1])

    print(f"\n{linha_separadora()}")
    print(f"  Pergunta {numero}/{TOTAL_PERGUNTAS}  |  Dificuldade: {dificuldade}")
    print(f"  Prêmio atual: {premio_atual}  →  Próximo: {proximo_premio}")
    print(linha_separadora())
    print(f"\n  {pergunta['enunciado']}\n")
    print(f"  A) {pergunta['alternativa_a']}")
    print(f"  B) {pergunta['alternativa_b']}")
    print(f"  C) {pergunta['alternativa_c']}")
    print(f"  D) {pergunta['alternativa_d']}")
    print()


def ler_resposta() -> str:
    """Lê e valida a resposta do usuário em loop.
    Aceita A–D (maiúsculas ou minúsculas) ou 'desistir'.
    Retorna a resposta em maiúsculas ou 'DESISTIR'.
    """
    while True:
        entrada = input("  Sua resposta (A/B/C/D) ou 'desistir': ").strip().upper()
        if entrada in ALTERNATIVAS_VALIDAS or entrada == "DESISTIR":
            return entrada
        print("  ⚠  Opção inválida! Digite A, B, C, D ou 'desistir'.")


# ---------------------------------------------------------------------------
# Persistência de dados
# ---------------------------------------------------------------------------


def salvar_partida(
    cliente: Client,
    jogo_id: str,
    apelido: str,
    valor_ganho: int,
    tempo_segundos: float,
    acertos: int,
    motivo_encerramento: str,
) -> None:
    """Tenta salvar a partida no Supabase.
    Em caso de falha, pergunta ao usuário se deseja tentar novamente,
    reutilizando o mesmo jogo_id para evitar duplicações.
    Nunca exibe mensagem de sucesso se o envio não for confirmado.
    """
    dados = {
        "jogo_id": jogo_id,
        "apelido": apelido,
        "valor_ganho": valor_ganho,
        "tempo_segundos": round(tempo_segundos, 3),
        "acertos": acertos,
        "motivo_encerramento": motivo_encerramento,
    }

    while True:
        try:
            cliente.table("partidas").insert(dados).execute()
            print("\n  ✔  Resultado salvo no banco de dados com sucesso!")
            return
        except Exception as erro:
            print(f"\n  ✘  Falha ao salvar no banco de dados: {erro}")
            print("     O jogo_id desta partida é:", jogo_id)
            tentativa = (
                input("  Deseja tentar enviar novamente? (s/n): ").strip().lower()
            )
            if tentativa != "s":
                print(
                    "  ⚠  Resultado NÃO salvo. "
                    "Guarde o jogo_id acima caso queira registrá-lo manualmente."
                )
                return


# ---------------------------------------------------------------------------
# Telas do jogo
# ---------------------------------------------------------------------------


def tela_ranking(cliente: Client) -> None:
    """Exibe o ranking das 10 melhores partidas."""
    cabecalho("🏆  RANKING — TOP 10")
    try:
        resposta = (
            cliente.table("partidas")
            .select("apelido, valor_ganho, acertos, tempo_segundos, motivo_encerramento")
            .order("valor_ganho", desc=True)
            .order("acertos", desc=True)
            .order("tempo_segundos", desc=False)
            .limit(10)
            .execute()
        )
        registros: list[dict] = resposta.data or []

        if not registros:
            print("\n  Nenhuma partida registrada ainda. Seja o primeiro!\n")
            return

        print(
            f"\n  {'#':<4} {'Apelido':<20} {'Prêmio':>14} {'Acertos':>8} "
            f"{'Tempo(s)':>10}  Encerramento"
        )
        print(linha_separadora())

        for pos, rec in enumerate(registros, start=1):
            print(
                f"  {pos:<4} {rec['apelido']:<20} "
                f"{formatar_premio(rec['valor_ganho']):>14} "
                f"{rec['acertos']:>8} "
                f"{rec['tempo_segundos']:>10.3f}  "
                f"{rec['motivo_encerramento']}"
            )
        print()
    except Exception as erro:
        print(f"\n  ✘  Não foi possível carregar o ranking: {erro}\n")


def iniciar_partida(cliente: Client) -> None:
    """Conduz uma partida completa do Show do Milhão."""
    cabecalho("🎮  SHOW DO MILHÃO")

    # --- Apelido ---
    while True:
        apelido = input("\n  Digite seu apelido: ").strip()
        if apelido:
            break
        print("  ⚠  O apelido não pode ser vazio. Tente novamente.")

    # --- Busca de perguntas ---
    print("\n  Carregando perguntas...")
    try:
        perguntas = buscar_perguntas(cliente)
    except RuntimeError as erro:
        print(f"\n  ✘  {erro}")
        print("  Partida abortada.\n")
        return
    except Exception as erro:
        print(f"\n  ✘  Erro ao buscar perguntas: {erro}")
        print("  Partida abortada.\n")
        return

    # --- Identificador único da partida ---
    jogo_id = str(uuid.uuid4())

    # --- Variáveis de controle ---
    acertos: int = 0
    motivo_encerramento: str = ""
    tempo_inicio: float = 0.0
    tempo_total: float = 0.0

    print(f"\n  Bem-vindo(a), {apelido}! Boa sorte! 🍀")
    print("  A qualquer momento, digite 'desistir' para encerrar e garantir o prêmio atual.")
    input("\n  Pressione ENTER para começar...\n")

    # -----------------------------------------------------------------------
    # Loop principal — o cronômetro inicia aqui (antes de exibir a 1ª pergunta)
    # -----------------------------------------------------------------------
    tempo_inicio = time.perf_counter()

    for numero_pergunta, pergunta in enumerate(perguntas, start=1):
        exibir_pergunta(numero_pergunta, pergunta, acertos)
        resposta_jogador = ler_resposta()

        if resposta_jogador == "DESISTIR":
            motivo_encerramento = "desistencia"
            break

        resposta_correta = pergunta["resposta"].strip().upper()

        if resposta_jogador == resposta_correta:
            acertos += 1
            print(f"\n  ✔  Correto! Você ganhou {formatar_premio(PREMIOS[acertos])}! 🎉")
            if acertos == TOTAL_PERGUNTAS:
                motivo_encerramento = "acerto_total"
                break
        else:
            print(
                f"\n  ✘  Errou! A resposta correta era: {resposta_correta}. "
                f"Você vai para casa com {formatar_premio(PREMIOS[acertos])}."
            )
            motivo_encerramento = "erro"
            # Ao errar a 1ª pergunta, acertos=0 → prêmio = R$ 0
            break

    # -----------------------------------------------------------------------
    # Para o cronômetro imediatamente após o encerramento da partida
    # -----------------------------------------------------------------------
    tempo_total = time.perf_counter() - tempo_inicio

    valor_ganho = PREMIOS[acertos]

    # --- Resumo ---
    print(f"\n{linha_separadora('═')}")
    print("  FIM DE JOGO")
    print(linha_separadora("═"))
    print(f"  Apelido          : {apelido}")
    print(f"  Acertos          : {acertos}/{TOTAL_PERGUNTAS}")
    print(f"  Prêmio           : {formatar_premio(valor_ganho)}")
    print(f"  Tempo de jogo    : {tempo_total:.3f} segundos")
    print(
        f"  Motivo           : "
        + {
            "acerto_total": "Respondeu todas as 9 perguntas! 🏆",
            "erro": "Resposta incorreta.",
            "desistencia": "Desistiu.",
        }.get(motivo_encerramento, motivo_encerramento)
    )
    print(linha_separadora("═"))

    # --- Persistência (fora do cronômetro) ---
    print("\n  Salvando resultado...")
    salvar_partida(
        cliente,
        jogo_id,
        apelido,
        valor_ganho,
        tempo_total,
        acertos,
        motivo_encerramento,
    )


# ---------------------------------------------------------------------------
# Menu principal
# ---------------------------------------------------------------------------


def menu_principal() -> None:
    """Loop do menu principal."""
    print("\n" + linha_separadora("═"))
    print("  🎯  SHOW DO MILHÃO — Python + Supabase")
    print(linha_separadora("═"))

    # Conexão antecipada para falhar cedo com mensagem clara
    try:
        cliente = obter_cliente()
    except ValueError as erro:
        print(f"\n  ✘  {erro}\n")
        return

    while True:
        print("\n  ┌─────────────────────────────┐")
        print("  │       MENU PRINCIPAL        │")
        print("  ├─────────────────────────────┤")
        print("  │  1 - Iniciar partida        │")
        print("  │  2 - Consultar ranking      │")
        print("  │  3 - Sair                   │")
        print("  └─────────────────────────────┘")

        escolha = input("\n  Escolha uma opção: ").strip()

        if escolha == "1":
            iniciar_partida(cliente)
        elif escolha == "2":
            tela_ranking(cliente)
        elif escolha == "3":
            print("\n  Até logo! 👋\n")
            break
        else:
            print("  ⚠  Opção inválida. Digite 1, 2 ou 3.")


# ---------------------------------------------------------------------------
# Ponto de entrada
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    menu_principal()
