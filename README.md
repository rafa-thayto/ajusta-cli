# ajusta

CLI oficial do **AjustaCV** — otimização ATS, criação de currículos, foto profissional com IA e muito mais, direto do terminal.

> 🇧🇷 Pacote npm: `ajusta` · Site: [ajustacv.com](https://ajustacv.com)

## Instalação

### npm

```sh
npm install -g ajusta
```

Ou execute sem instalar:

```sh
npx ajusta <comando>
```

Requer **Node.js 18+**.

## Uso rápido

```sh
# Pontuação ATS gratuita
ajusta ats meu-curriculo.pdf

# Otimização ATS com IA (modo interativo)
ajusta improve meu-curriculo.pdf -i

# Criar currículo do zero a partir do LinkedIn
ajusta create --linkedin https://linkedin.com/in/fulano -i

# Foto profissional
ajusta photo minha-foto.jpg --style linkedin --profession "Engenheira de Software"
```

## Comandos principais

### `ajusta ats` — Pontuação ATS gratuita

Endpoint gratuito, determinístico e rate-limited (10 req/min/IP). Sem pedido, sem pagamento.

```sh
ajusta ats curriculo.pdf
ajusta ats curriculo.pdf --job "Vaga de Engenheiro Backend..."
ajusta ats curriculo.pdf --job-file vaga.txt
cat curriculo.txt | ajusta ats
ajusta ats curriculo.pdf --json | jq .score
```

Sem descrição da vaga, a categoria `keywords` é omitida e os pesos das demais são redistribuídos.

### `ajusta improve` — Otimização ATS com IA

Envia o currículo para reescrita com foco em ATS e devolve um PDF pronto para envio.

```sh
ajusta improve curriculo.pdf -i
ajusta improve curriculo.pdf --name "João" --email "joao@email.com" --language pt-BR
ajusta improve curriculo.pdf -o resultado.pdf --force --timeout 60
ajusta improve curriculo.pdf --coupon DESCONTO10
```

Idiomas suportados: `pt-BR`, `en`, `es`, `fr`, `de`, `it`.

### `ajusta create` — Currículo do zero

Cria um currículo completo via wizard, JSON ou perfil do LinkedIn.

```sh
ajusta create -i
ajusta create --from resume.json --json
ajusta create --linkedin https://linkedin.com/in/fulano -i
```

### `ajusta photo` — Foto profissional com IA

Gera uma versão profissional da sua foto (PNG, máx. 10MB de entrada).

```sh
ajusta photo minha-foto.jpg --style linkedin --profession "Designer de Produto"
ajusta photo minha-foto.jpg -i
```

Estilos: `linkedin`, `corporate`, `creative`, `casual`.

### `ajusta order` — Operações sobre pedidos

```sh
ajusta order get <orderId>            # detalhes do pedido
ajusta order list-files <orderId>     # arquivos disponíveis
ajusta order download <orderId>       # baixar resultado
ajusta order edit <orderId>           # editar texto melhorado (máx. 5)
ajusta order resend <orderId>         # reenviar por email (máx. 2)
ajusta order retry <orderId>          # reprocessar pedido que falhou
ajusta order readjust <orderId>       # criar reajuste (R$ 3,40)
ajusta order regenerate-photo <orderId>
```

Atalho: `ajusta status <orderId>` equivale a `ajusta order get`.

### `ajusta linkedin` — Extrair perfil público

```sh
ajusta linkedin https://linkedin.com/in/fulano
ajusta linkedin https://linkedin.com/in/fulano -o perfil.txt
ajusta linkedin https://linkedin.com/in/fulano --json | jq .profileText
```

Rate limit: 5 req/min/IP. Útil para alimentar `ajusta create --linkedin=<url>`.

### `ajusta coupon` & `ajusta gift`

```sh
ajusta coupon validate DESCONTO10
ajusta gift validate <token>
ajusta gift redeem <token> -i
```

### `ajusta support` — Abrir ticket de suporte

```sh
ajusta support -i
ajusta support --name "Ana" --email "a@x.com" --message-file mensagem.txt
```

### `ajusta update`

```sh
ajusta update
```

## Modos de saída

Todos os comandos suportam dois modos:

- **Humano** (padrão): UI interativa com cores e spinners.
- **JSON** (`--json` ou stdout sem TTY): saída estruturada para scripts e pipelines.

```sh
ajusta ats curriculo.pdf --json | jq .
ajusta improve curriculo.pdf --json > resultado.json
```

`--verbose` ativa logs de debug.

## Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `AJUSTA_API_URL` | URL da API (padrão: `https://api.ajustacv.com`) |
| `AJUSTA_NO_UPDATE_CHECK=1` | Desabilita verificação automática de atualizações |

## Usa Claude Code? Instale a skill oficial

A skill `ajusta-cv` ensina o Claude Code a operar o CLI de ponta a ponta — improve, ats, create, photo, pedidos e cupons.

```sh
ajusta install-skill
```

Reinicie o Claude Code. A skill fica em `~/.claude/skills/ajusta-cv/` e é sugerida automaticamente em tarefas relacionadas a currículos.

## Licença

MIT © [AjustaCV](https://ajustacv.com)
