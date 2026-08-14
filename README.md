# FoodAdmin - Supabase

Painel multiempresa usando HTML, CSS, JavaScript puro e Supabase.

## Como configurar
1. Crie um projeto no Supabase.
2. Abra o SQL Editor e execute `supabase.sql`.
3. Edite `js/config/supabase.js` com a URL e a chave pública/anon do projeto.
4. Não use `service_role` no frontend.
5. Em Authentication > Users, crie um usuário.
6. Pegue o UUID da empresa com `select id,nome from public.empresas;`.
7. Vincule o usuário à empresa:

```sql
insert into public.usuarios_empresa(user_id,empresa_id,nome,cargo)
values('UUID_DO_USUARIO','UUID_DA_EMPRESA','Administrador','admin');
```

8. Rode o projeto com Live Server no VS Code e abra `login.html`.

## Realtime
A tela `pedidos.html` carrega os pedidos da empresa e assina INSERT e UPDATE em `pedidos` com filtro por `empresa_id`.

## Importante para o app do cliente
Este SQL protege o painel administrativo. Para o aplicativo cliente inserir pedidos, crie policies específicas de INSERT conforme a autenticação usada no app, sem liberar permissões administrativas.
