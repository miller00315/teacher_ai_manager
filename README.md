# EduTest AI - Teacher Application

Aplicação exclusiva para Professores do sistema EduTest AI.

## Instalação

```bash
npm install
```

## Configuração

1. Configure as variáveis de ambiente (`.env`):
   ```
   REACT_APP_SUPABASE_URL=your_supabase_url
   REACT_APP_SUPABASE_ANON_KEY=your_supabase_key
   GEMINI_API_KEY=your_gemini_key
   ```

2. Configure o `.npmrc` para acessar o pacote compartilhado:
   ```
   @edutest:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
   ```

## Desenvolvimento

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:3003`

## Build

```bash
npm run build
```

## Deploy

Esta aplicação pode ser deployada independentemente das outras aplicações.

## Acesso

Apenas usuários com role `Teacher` podem acessar esta aplicação.
