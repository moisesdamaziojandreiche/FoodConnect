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


