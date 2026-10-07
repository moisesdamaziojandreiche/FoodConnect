# FoodAdmin - Supabase

Painel multiempresa usando HTML, CSS, JavaScript puro e Supabase.

```sql
insert into public.usuarios_empresa(user_id,empresa_id,nome,cargo)
values('UUID_DO_USUARIO','UUID_DA_EMPRESA','Administrador','admin');
```

8. Rode o projeto com Live Server no VS Code e abra `login.html`.

## Realtime
A tela `pedidos.html` carrega os pedidos da empresa e assina INSERT e UPDATE em `pedidos` com filtro por `empresa_id`.

## Importante para o app do cliente
Este SQL protege o painel administrativo. Para o aplicativo cliente inserir pedidos, crie policies específicas de INSERT conforme a autenticação usada no app, sem liberar permissões administrativas.

# FoodConnect: Pagamentos, Split e Acompanhamento do Pedido

Este guia explica como **configurar**, **testar** e **usar na prática** as funcionalidades:

1. **Pagamento com Asaas** (Pix, cartão e boleto) com confirmação automática por webhook
2. **Split de pagamento** (cada restaurante recebe na própria subconta, com comissão da plataforma)
3. **Acompanhamento do pedido** em tempo real no app e **notificação push** a cada mudança de status

> Nunca coloque chaves (`ASAAS_API_KEY`, tokens, `service_role`) em arquivos do repositório. Elas ficam só nos **secrets do Supabase**. Os repositórios são públicos.

---

## 1. Visão geral

```
App (cliente)                Supabase                          Asaas
─────────────                ────────                          ─────
Carrinho ──► create-payment ──► cria pedido (aguardando_pagamento)
                              └─► cria cobrança ───────────────► gera invoice_url
Cliente paga no invoice_url ◄────────────────────────────────────────┘
                              ◄── asaas-webhook (pagamento confirmado)
                              └─► pedido: status=pendente, payment_status=aprovado
Painel (restaurante) vê o pedido e muda o status
                              └─► histórico + notificar-pedido ──► push (Expo)
App (cliente) atualiza em tempo real + recebe a notificação
```

### Status do pedido

| status | Significado | Quem muda |
|---|---|---|
| `aguardando_pagamento` | criado, ainda não pago (a cozinha **não** vê) | sistema |
| `pendente` | pago, aguardando o restaurante aceitar | webhook do Asaas |
| `aceito` → `preparando` → `pronto` → `saiu_para_entrega` → `entregue` | andamento | restaurante, no painel |
| `cancelado` | recusado, cancelado ou pagamento vencido | restaurante / sistema |

`payment_status` é separado: `pendente`, `aprovado`, `cancelado`, `reembolsado`.

---

## 2. Arquivos e onde ficam

**Repositório do app (`FoodConnect_APP`)**

```
supabase/
├── migrations/
│   ├── 20261006000000_asaas_pagamento.sql
│   ├── 20261006000100_asaas_subconta.sql
│   └── 20261006000200_acompanhamento_push.sql
└── functions/
    ├── create-payment/index.ts      cria pedido + cobrança
    ├── asaas-webhook/index.ts       confirma pagamento
    ├── asaas-subconta/index.ts      cria/consulta subconta do restaurante
    └── notificar-pedido/index.ts    envia push ao cliente
src/
├── notificacoes.js                  token de push (ajuste a pasta ao seu padrão)
└── AcompanharPedido.js              tela de acompanhamento (idem)
```

**Repositório do site (`FoodConnect`)**

```
recebimentos.html                    restaurante cria a conta de recebimento
js/status-pedido.js                  fluxo de status e botões do painel
```

> A pasta antiga `supabase/functions/mp-webhook` (Mercado Pago) deve ser removida.

---

## 3. Configuração (faça nesta ordem)

### 3.1 Banco de dados

No **SQL Editor** do Supabase, rode **na ordem**, um arquivo por vez:

1. `20261006000000_asaas_pagamento.sql`
2. `20261006000100_asaas_subconta.sql`
3. `20261006000200_acompanhamento_push.sql`

Confirme no **Table Editor**:
- `pedidos` tem `payment_status`, `asaas_payment_id`, `asaas_invoice_url`, `paid_at`
- `empresas` tem `asaas_wallet_id`, `asaas_split_ativo`, `comissao_percentual`
- existem as tabelas `empresa_asaas_segredos`, `pedido_status_historico` e `push_tokens`

> Se o painel atualiza outras colunas de `pedidos` ou `empresas` além das liberadas nas migrations, inclua-as no `GRANT UPDATE`, senão o painel dará erro de permissão.

### 3.2 Secrets (terminal, na raiz do app)

No PowerShell, use **aspas simples** na chave do Asaas, porque ela começa com `$`:

```powershell
npx supabase secrets set ASAAS_API_KEY='$aact_...' ASAAS_ENV=sandbox ASAAS_WEBHOOK_TOKEN=um-token-longo-e-aleatorio COMISSAO_PADRAO=10 NOTIFICAR_WEBHOOK_SECRET=outro-segredo-longo
```

| Secret | Para que serve |
|---|---|
| `ASAAS_API_KEY` | chave da conta Asaas (do **mesmo ambiente** que `ASAAS_ENV`) |
| `ASAAS_ENV` | `sandbox` (testes) ou `production` |
| `ASAAS_WEBHOOK_TOKEN` | token que o Asaas envia no webhook (igual ao cadastrado no painel do Asaas) |
| `COMISSAO_PADRAO` | % da plataforma em novas empresas (opcional, padrão 0) |
| `NOTIFICAR_WEBHOOK_SECRET` | segredo do aviso de mudança de status |
| `ASAAS_BILLING_TYPE` | opcional: `UNDEFINED` (cliente escolhe, padrão) ou `PIX` |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são fornecidos pelo Supabase às funções.

### 3.3 Deploy das funções

Rode na **raiz do app** (a pasta que contém `supabase/`):

```powershell
npx supabase functions deploy create-payment
npx supabase functions deploy asaas-subconta
npx supabase functions deploy asaas-webhook --no-verify-jwt
npx supabase functions deploy notificar-pedido --no-verify-jwt
```

`--no-verify-jwt` é necessário nas duas funções chamadas por sistemas externos (Asaas e o banco). A proteção delas é o token/segredo no header.

### 3.4 Webhook do Asaas

No painel do Asaas (sandbox: sandbox.asaas.com), em **Integrações → Webhooks**, cadastre:

- **URL:** `https://<REF_DO_PROJETO>.supabase.co/functions/v1/asaas-webhook`
- **Token de autenticação:** o mesmo valor de `ASAAS_WEBHOOK_TOKEN`
- **Eventos:** `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED`

> Sandbox e produção são contas independentes: a chave e o webhook precisam ser refeitos na produção.

### 3.5 Aviso de mudança de status (para o push)

Use **uma** das opções (nunca as duas, senão o cliente recebe a notificação em dobro).

**Opção A, Database Webhook (painel):** em **Database → Webhooks → Create**, tabela `pedidos`, evento **Update**, tipo *Supabase Edge Functions*, função `notificar-pedido`, e o header `x-webhook-secret` com o valor de `NOTIFICAR_WEBHOOK_SECRET`.

**Opção B, trigger no banco** (se o painel não tiver Webhooks): veja o [Apêndice A](#apêndice-a-trigger-sem-database-webhooks).

### 3.6 Site (painel)

- Em `recebimentos.html`, troque `COLE_AQUI_A_ANON_KEY` pela **anon key** do projeto (Project Settings → API). Use só a anon key, nunca a `service_role`.
- Adicione um link para `recebimentos.html` no menu do painel.
- Carregue `js/status-pedido.js` no `pedidos.html` e use `FoodStatus.acoes(status)` para montar os botões e `FoodStatus.atualizar(supabase, id, novoStatus)` para gravar. Filtre os pedidos `aguardando_pagamento` da lista e do realtime (`FoodStatus.visivelParaCozinha`).

### 3.7 App

```powershell
npx expo install expo-notifications expo-device expo-constants
npx eas init
```

- Em `app.json`, adicione `"expo-notifications"` em `plugins`.
- Depois do login: `registrarPushToken(supabase)`; no logout: `removerPushToken(supabase, token)`.
- Na tela do pedido: `<AcompanharPedido supabase={supabase} pedidoId={id} />`.
- Para abrir o pedido ao tocar na notificação: `aoTocarNotificacao(({ pedido_id }) => ...)`.
- No carrinho, chame a função de pagamento e abra o link:

```js
const { data, error } = await supabase.functions.invoke('create-payment', {
  body: { empresa_id, itens: [{ produto_id, quantidade }], nome, cpfCnpj, endereco_entrega },
});
if (data?.invoice_url) Linking.openURL(data.invoice_url);
```

> **Push remoto não funciona no Expo Go** (SDK 53+). Para testar push, use um *development build* (`eas build`) em aparelho físico. Android exige credenciais FCM e iOS exige chave APNs (conta paga de desenvolvedor Apple). A tela em tempo real funciona no Expo Go.

---

## 4. Como testar

Faça na ordem e só avance quando a etapa funcionar.

### 4.1 Preparação

- Uma empresa com produto `ativo` e `disponivel` marcados. Anote os `id` (UUID).
- Um usuário cliente em **Authentication → Users** (marque *Auto Confirm User*).
- Um CPF válido gerado em um gerador de CPF (o Asaas valida os dígitos verificadores).

### 4.2 Criar pedido e cobrança (PowerShell)

```powershell
$url  = "https://<REF_DO_PROJETO>.supabase.co"
$anon = "SUA_ANON_KEY"
$senha = 'SENHA_DO_CLIENTE'   # aspas simples por causa de símbolos

$login = Invoke-RestMethod -Method Post -Uri "$url/auth/v1/token?grant_type=password" `
  -Headers @{ apikey = $anon } -ContentType "application/json" `
  -Body (@{ email = "cliente@teste.com"; password = $senha } | ConvertTo-Json)
$jwt = $login.access_token
$jwt   # deve imprimir um texto longo começando com eyJ

$body = @{
  empresa_id = "ID_DA_EMPRESA"
  itens = @(@{ produto_id = "ID_DO_PRODUTO"; quantidade = 2 })
  nome = "Cliente Teste"
  cpfCnpj = "CPF_COM_11_DIGITOS"
  endereco_entrega = "Rua Teste, 123"
} | ConvertTo-Json -Depth 5

try {
  Invoke-RestMethod -Method Post -Uri "$url/functions/v1/create-payment" `
    -Headers @{ Authorization = "Bearer $jwt"; apikey = $anon } `
    -ContentType "application/json" -Body $body
} catch { $_.ErrorDetails.Message }
```

**Esperado:** `pedido_id`, `valor_total` e `invoice_url`.
**No banco:** `status = aguardando_pagamento`, `payment_status = pendente`, `asaas_payment_id` preenchido, e `valor_total` = preço × quantidade (calculado no servidor).

### 4.3 Pagar e conferir o webhook

1. Abra o `invoice_url` no navegador.
2. Pague no sandbox: com **cartão de teste** (lista na documentação do Asaas) ou, no Pix, simulando o recebimento no painel do sandbox.
3. Em alguns segundos, o pedido deve ficar com `payment_status = aprovado`, `status = pendente` e `paid_at` preenchido.
4. Confira o histórico de entregas do webhook no painel do Asaas (resposta `200`) e o log de **Edge Functions → asaas-webhook**.

### 4.4 Testes de segurança

| Teste | Esperado |
|---|---|
| Chamar `asaas-webhook` sem o header de token | `401` |
| Reenviar um evento já entregue (painel do Asaas) | pedido não muda de novo |
| Pedir produto com `disponivel` desmarcado | erro `400`, nenhum pedido criado |
| Chamar `create-payment` sem login | `401` |
| Restaurante tentar mudar `valor_total`/`payment_status` direto na API | erro de permissão |
| Mudar status de pedido `aguardando_pagamento` para `aceito` pelo painel | erro "Pedido ainda não foi pago" |

### 4.5 Subconta e split

1. Abra `recebimentos.html` logado como **admin** do restaurante e preencha o cadastro. Pelo Asaas, a conta principal precisa ser **CNPJ** para criar subcontas via API.
2. O restaurante conclui o cadastro pelo e-mail do Asaas. Clique em **Atualizar situação**. Quando estiver aprovada, `asaas_split_ativo` vira `true`.
3. Faça um pedido novo para essa empresa e pague. No painel do Asaas, a cobrança deve mostrar o split (por exemplo, 90% restaurante e 10% plataforma).

**Atalho para testar sem criar subconta:**

```sql
update empresas
set asaas_wallet_id = 'WALLET_ID_DA_CONTA_DE_TESTE',
    asaas_split_ativo = true,
    comissao_percentual = 10
where id = 'ID_DA_EMPRESA';
```

Sem `asaas_split_ativo = true`, todo o valor cai na conta da plataforma e o repasse é manual.

### 4.6 Acompanhamento e push

1. **Tempo real (Expo Go serve):** abra a tela do pedido no app. No Table Editor, mude o `status` do pedido (`aceito`, `preparando`…). A linha do tempo deve atualizar sozinha.
2. **Push (development build, aparelho físico):** faça login e confira que surgiu uma linha em `push_tokens`. Feche o app, mude o status e a notificação deve chegar.
3. **Histórico:** `pedido_status_historico` deve ter uma linha por mudança.
4. Se não chegar, confira o log de **Edge Functions → notificar-pedido**. Um `401` indica que o `x-webhook-secret` difere de `NOTIFICAR_WEBHOOK_SECRET`. Se usar a Opção B, consulte:
   ```sql
   select id, status_code, content, created from net._http_response order by created desc limit 5;
   ```

---

## 5. Uso na prática

**Cliente (app):** monta o carrinho, informa o CPF, é levado ao link de pagamento do Asaas, paga (Pix ou cartão) e volta ao app. A tela do pedido mostra "Aguardando pagamento" até o webhook confirmar, depois acompanha cada etapa e recebe um push a cada mudança.

**Restaurante (painel):** recebe o pedido só **depois de pago**. Usa os botões para aceitar, iniciar preparo, marcar pronto, saiu para entrega e entregue. Cada clique notifica o cliente. Em `recebimentos.html`, acompanha a aprovação da conta de recebimento.

**Dono da plataforma:** ajusta a comissão de cada empresa por SQL (`update empresas set comissao_percentual = 12 where id = '...'`). O restaurante não consegue alterar esse campo.

---

## 6. Ir para produção

- [ ] Conta Asaas de produção aprovada e chave nova em `ASAAS_API_KEY`
- [ ] `ASAAS_ENV=production` (chave e ambiente **juntos**)
- [ ] Webhook cadastrado na conta de produção, com o mesmo `ASAAS_WEBHOOK_TOKEN`
- [ ] Redeploy das funções após trocar os secrets
- [ ] Teste real de baixo valor, ponta a ponta
- [ ] Build de produção do app com credenciais FCM/APNs
- [ ] Política de privacidade (LGPD) e termos
- [ ] Confirmar que nenhuma chave real existiu no histórico do git (se existiu, gere novas)

---

## 7. Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| `invalid_credentials` no login de teste | e-mail/senha errados ou usuário não confirmado | conferir em Authentication → Users; usar aspas simples na senha |
| Resposta "carrinho vazio" | a função publicada ainda é a antiga | colar o código novo e refazer o deploy |
| Deploy: `Entrypoint path does not exist` | terminal na pasta errada ou arquivo fora do lugar | rodar na raiz do app; conferir `supabase\functions\<nome>\index.ts` |
| `Pedido inválido` / `Item inválido` | ids de exemplo não substituídos | usar os UUIDs reais |
| `CPF/CNPJ inválido` (da função) | campo vazio ou sem 11/14 dígitos | preencher com números |
| Log `Asaas 400 ... CPF/CNPJ inválido` | dígitos verificadores errados | usar CPF de gerador |
| Log `Asaas 401 invalid_access_token` | chave errada, de outro ambiente, ou `$` mal interpretado | gerar a chave no ambiente certo; salvar com aspas simples; refazer o deploy |
| `502` no `create-payment` | o Asaas recusou a chamada | ver a linha `Erro Asaas:` no log da função |
| Pedido pago continua `aguardando_pagamento` | webhook não chegou ou token diferente | ver histórico de webhooks no Asaas e o log do `asaas-webhook` |
| Log "Valor divergente" | valor pago ≠ `valor_total` | a função recusa liberar de propósito; investigar |
| Painel: erro de permissão ao atualizar | coluna não liberada no `GRANT` | incluir a coluna na migration |
| Sem push no Expo Go | push remoto removido do Expo Go (SDK 53+) | usar development build |
| Push em dobro | Webhook do painel **e** trigger ativos | manter só um |

---

## 8. Limitações conhecidas

- **Reembolso:** cancelar um pedido já pago avisa o cliente, mas **não devolve o dinheiro**. É preciso implementar o estorno pela API do Asaas.
- **Valor mínimo:** o Asaas pode ter valor mínimo por cobrança. Confirme na documentação.
- **CPF do cliente** é exigido para criar a cobrança, então a tela do carrinho precisa coletá-lo (e validar os dígitos).
- **Taxas no split:** confirme na documentação do Asaas como as taxas entram na divisão antes de prometer valores ao restaurante.
- **Subcontas** só podem ser criadas por contas de pessoa jurídica (CNPJ).

---

## Apêndice A: trigger sem Database Webhooks

Use se o painel do seu projeto não tiver a opção de Webhooks. Rode no **SQL Editor**, trocando `SEU_SEGREDO_AQUI` pelo valor de `NOTIFICAR_WEBHOOK_SECRET` e `<REF_DO_PROJETO>` pelo código do projeto. **Não salve este SQL com o segredo real em arquivo do repositório.**

```sql
create table if not exists public.config_privada (
  chave text primary key,
  valor text not null
);
alter table public.config_privada enable row level security;
revoke all on public.config_privada from anon, authenticated;

insert into public.config_privada (chave, valor) values
  ('notificar_webhook_secret', 'SEU_SEGREDO_AQUI'),
  ('notificar_url', 'https://<REF_DO_PROJETO>.supabase.co/functions/v1/notificar-pedido')
on conflict (chave) do update set valor = excluded.valor;

create extension if not exists pg_net;

create or replace function public.notificar_mudanca_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select valor into v_url from public.config_privada where chave = 'notificar_url';
  select valor into v_secret from public.config_privada where chave = 'notificar_webhook_secret';
  if v_url is null or v_secret is null then
    return new;
  end if;

  begin
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_secret
      ),
      body := jsonb_build_object(
        'type', 'UPDATE',
        'record', to_jsonb(new),
        'old_record', to_jsonb(old)
      )
    );
  exception when others then
    raise warning 'Falha ao chamar notificar-pedido: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_notificar_mudanca_status on public.pedidos;
create trigger trg_notificar_mudanca_status
  after update of status on public.pedidos
  for each row
  execute function public.notificar_mudanca_status();
```

