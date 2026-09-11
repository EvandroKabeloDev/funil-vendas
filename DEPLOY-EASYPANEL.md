# Deploy do Funil de Vendas — GitHub + EasyPanel (tudo pela web)

Este guia substitui o **Passo 6** do `PASSO-A-PASSO.md` original (que usava FTP na Hostinger compartilhada).
Você não precisa de Git instalado, Node instalado, nem terminal. Tudo é feito pelo navegador.

Pré-requisitos já concluídos: passos 1, 2 e 3 do `PASSO-A-PASSO.md` (projeto Supabase criado,
`0001_schema.sql` executado, autenticação por e-mail habilitada).

---

## Passo A — Criar o repositório no GitHub

1. Acesse github.com → botão **+** (canto superior direito) → **New repository**.
2. Nome: `funil-vendas`. Visibilidade: **Private**. **Não** marque "Add a README".
3. **Create repository**.
4. Na tela seguinte, clique em **uploading an existing file**.
5. Descompacte o `funil-vendas.zip` no seu computador e **arraste todo o conteúdo da pasta**
   (não a pasta em si) para a área de upload. O GitHub preserva a estrutura de subpastas.
6. Em *Commit changes*, escreva `etapa 1: login + schema + deploy easypanel` → **Commit changes**.

Confira se a estrutura ficou assim no repositório:

```
Dockerfile
index.html
package.json
tsconfig.json
vite.config.ts
.env.example
.gitignore
.dockerignore
docker/entrypoint.sh
docker/nginx.conf
public/icon-192.png
public/icon-512.png
src/App.tsx
src/main.tsx
src/components/ProtectedRoute.tsx
src/lib/AuthContext.tsx
src/lib/supabase.ts
src/pages/Home.tsx
src/pages/Login.tsx
src/styles/global.css
supabase/migrations/0001_schema.sql
```

> **Atenção:** se o upload achatar as pastas (alguns navegadores fazem isso), use
> **Add file → Create new file** e digite o caminho completo no nome, ex.: `src/lib/supabase.ts`.
> A barra `/` cria a pasta automaticamente.

---

## Passo B — Criar o App no EasyPanel

1. Entre no seu EasyPanel (`https://SEU-IP-OU-DOMINIO:3000`).
2. **Project** → selecione ou crie um projeto (ex.: `funil`).
3. **+ Service** → **App**. Nome: `funil-vendas` → **Create**.

### B.1 — Conectar o GitHub (aba *Source*)

1. Aba **Source** → escolha **GitHub**.
2. Se ainda não conectou: **Connect GitHub Account** → autorize o EasyPanel → selecione o
   repositório `funil-vendas`.
   - Alternativa sem OAuth: escolha **Git** e informe
     `https://github.com/SEU-USUARIO/funil-vendas.git`. Para repositório privado, gere um
     *Personal Access Token* (GitHub → Settings → Developer settings → Tokens) e use como senha.
3. **Branch:** `main`. **Build Path:** `/`.
4. **Save**.

### B.2 — Definir o método de build (aba *Build*)

1. **Build Method:** `Dockerfile`.
2. **Dockerfile Path:** `Dockerfile`.
3. **Save**.

### B.3 — Variáveis de ambiente (aba *Environment*)

Cole exatamente isto, trocando pelos valores reais (Supabase → **Settings → API**):

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-publica
```

**Save**.

> Por que isso funciona sem rebuild: normalmente o Vite congela as variáveis no momento do build.
> Aqui o `docker/entrypoint.sh` gera um `/env.js` a cada boot do contêiner, e o
> `src/lib/supabase.ts` lê `window.__ENV` antes de cair no `import.meta.env`.
> Trocar a chave = só reiniciar o serviço, sem rebuildar.

### B.4 — Domínio e HTTPS (aba *Domains*)

1. **Add Domain** → informe o subdomínio, ex.: `funil.seudominio.com.br`.
2. **Port:** `80` (é a porta que o Nginx expõe no contêiner).
3. Ative **HTTPS** (Let's Encrypt).
4. No painel DNS do seu domínio (Hostinger → **Domínios → Zona DNS**), crie um registro:

   | Tipo | Nome  | Aponta para        | TTL   |
   |------|-------|--------------------|-------|
   | A    | funil | IP da sua VPS      | 14400 |

   Espere a propagação (5–30 min) antes de emitir o certificado.

> **O HTTPS não é opcional.** Sem ele o PWA não instala no celular e o service worker não registra.

### B.5 — Deploy

1. Aba **Deployments** → **Deploy**.
2. Acompanhe o log. O build roda em 2 estágios (Node 20 → Nginx) e leva ~2–4 minutos na primeira vez.
3. Terminando em `Deployment successful`, acesse `https://funil.seudominio.com.br`.

Teste rápido de saúde: `https://funil.seudominio.com.br/healthz` deve responder `ok`.

---

## Passo C — Apontar o Supabase para o domínio de produção

No Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://funil.seudominio.com.br`
- **Redirect URLs:** adicione as duas linhas:
  ```
  https://funil.seudominio.com.br/**
  http://localhost:5173/**
  ```

Sem isso, o link de confirmação de e-mail e o de redefinição de senha voltam para o lugar errado.

---

## Passo D — Testar (equivale ao Passo 5 do roteiro original)

1. Abra o domínio → deve cair na tela de **login**.
2. **Criar uma conta**: nome, empresa, e-mail, senha (mín. 8 caracteres).
3. Ao entrar, a tela mostra seu nome e o papel **Gestor**.
4. No Supabase → **Table Editor → profiles**: o registro existe com `role = gestor`.
5. Em **organizations** existe a empresa; em **teams**, a `Equipe Principal`.
6. Crie uma **2ª conta com o mesmo nome de empresa** (aba anônima): ela deve nascer como
   `corretor` no mesmo `org_id`.
7. Digite direto na barra de endereços `https://SEU-DOMINIO/login` e recarregue (F5).
   Se carregar normalmente, o fallback SPA do Nginx está correto.

### Teste do PWA

- **Android (Chrome):** menu ⋮ → *Instalar app* / *Adicionar à tela inicial*.
- **iPhone (Safari):** botão Compartilhar → *Adicionar à Tela de Início*.
  No iOS só funciona no **Safari** — Chrome/Firefox no iPhone não instalam PWA.
- Depois de instalado, o app abre em tela cheia (`display: standalone`) e mantém o login
  (`persistSession: true`).

---

## Passo E — Fluxo do dia a dia

A partir daqui, qualquer alteração é: editar o arquivo no GitHub pela web
(**botão do lápis → Commit changes**) → EasyPanel → **Deploy**.

Para deploy automático a cada push, em **Deployments** copie a **Webhook URL** e cadastre no
GitHub em **Settings → Webhooks → Add webhook** (Content type: `application/json`, evento: `push`).

---

## Problemas comuns

| Sintoma | Causa provável | Correção |
|---|---|---|
| Tela branca e erro `Configuracao ausente` no console | `VITE_SUPABASE_URL` / `ANON_KEY` não definidas | Aba **Environment** no EasyPanel → salvar → **Restart** |
| `/login` dá 404 ao recarregar | fallback SPA ausente | Confirme que `docker/nginx.conf` foi enviado ao repositório |
| Build falha em `npm run build` | erro de TypeScript | Leia o log; o `tsc --noEmit` aponta arquivo e linha |
| "Instalar app" não aparece | site em HTTP | Ative HTTPS na aba **Domains** |
| App abre versão antiga | cache do service worker | Feche e reabra o app; o `registerType: 'autoUpdate'` atualiza no próximo boot |
| Confirmação de e-mail leva a `localhost` | Site URL desatualizada | Passo C |

---

## Próxima etapa

Concluída a Etapa 1, o roadmap segue: **Etapa 2 — tela de Cadastros** (equipes e corretores
lendo/gravando no Supabase), substituindo o placeholder atual de `src/pages/Home.tsx`.
