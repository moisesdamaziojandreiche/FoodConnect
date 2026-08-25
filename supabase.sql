-- =========================================================
-- EXTENSÕES
-- =========================================================

create extension if not exists pgcrypto;


-- =========================================================
-- TABELA: EMPRESAS
-- =========================================================

create table if not exists public.empresas (
    id uuid primary key default gen_random_uuid(),

    nome text not null,
    descricao text,

    logo_url text,
    imagem_capa_url text,

    telefone text,
    endereco text,

    horario_abertura time,
    horario_fechamento time,

    ativo boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- =========================================================
-- TABELA: USUÁRIOS DA EMPRESA
-- =========================================================

create table if not exists public.usuarios_empresa (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    empresa_id uuid not null
        references public.empresas(id)
        on delete cascade,

    nome text,

    cargo text default 'admin',

    created_at timestamptz not null default now(),

    unique (user_id)
);


-- =========================================================
-- TABELA: CATEGORIAS
-- =========================================================

create table if not exists public.categorias (
    id uuid primary key default gen_random_uuid(),

    empresa_id uuid not null
        references public.empresas(id)
        on delete cascade,

    nome text not null,
    descricao text,

    ordem integer not null default 0,

    ativo boolean not null default true,

    created_at timestamptz not null default now()
);


-- =========================================================
-- TABELA: PRODUTOS
-- =========================================================

create table if not exists public.produtos (
    id uuid primary key default gen_random_uuid(),

    empresa_id uuid not null
        references public.empresas(id)
        on delete cascade,

    categoria_id uuid
        references public.categorias(id)
        on delete set null,

    nome text not null,
    descricao text,

    preco numeric(12, 2)
        not null
        default 0
        check (preco >= 0),

    imagem_url text,

    ativo boolean not null default true,
    disponivel boolean not null default true,

    ordem integer not null default 0,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- =========================================================
-- TABELA: PEDIDOS
-- =========================================================

create table if not exists public.pedidos (
    id uuid primary key default gen_random_uuid(),

    empresa_id uuid not null
        references public.empresas(id)
        on delete cascade,

    cliente_id uuid,

    status text
        not null
        default 'pendente'
        check (
            status in (
                'pendente',
                'aceito',
                'preparando',
                'pronto',
                'saiu_para_entrega',
                'entregue',
                'cancelado'
            )
        ),

    valor_total numeric(12, 2)
        not null
        default 0
        check (valor_total >= 0),

    forma_pagamento text,
    observacao text,
    endereco_entrega text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- =========================================================
-- TABELA: ITENS DO PEDIDO
-- =========================================================

create table if not exists public.itens_pedido (
    id uuid primary key default gen_random_uuid(),

    pedido_id uuid not null
        references public.pedidos(id)
        on delete cascade,

    produto_id uuid
        references public.produtos(id)
        on delete set null,

    nome_produto text not null,

    preco_unitario numeric(12, 2) not null,

    quantidade integer
        not null
        check (quantidade > 0),

    subtotal numeric(12, 2) not null,

    observacao text,

    created_at timestamptz not null default now()
);


-- =========================================================
-- ÍNDICES
-- =========================================================

create index if not exists idx_ue_user
    on public.usuarios_empresa(user_id);

create index if not exists idx_cat_emp
    on public.categorias(empresa_id);

create index if not exists idx_prod_emp
    on public.produtos(empresa_id);

create index if not exists idx_ped_emp
    on public.pedidos(empresa_id);

create index if not exists idx_item_pedido
    on public.itens_pedido(pedido_id);


-- =========================================================
-- CADASTRO AUTOMÁTICO DA EMPRESA
-- =========================================================

create or replace function public.criar_empresa_do_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    nova_empresa_id uuid;
begin
    if coalesce(new.raw_user_meta_data ->> 'tipo_cadastro', '') <> 'empresa' then
        return new;
    end if;

    insert into public.empresas (
        nome,
        descricao,
        telefone,
        endereco
    )
    values (
        nullif(new.raw_user_meta_data ->> 'empresa_nome', ''),
        nullif(new.raw_user_meta_data ->> 'empresa_descricao', ''),
        nullif(new.raw_user_meta_data ->> 'empresa_telefone', ''),
        nullif(new.raw_user_meta_data ->> 'empresa_endereco', '')
    )
    returning id into nova_empresa_id;

    insert into public.usuarios_empresa (
        user_id,
        empresa_id,
        nome,
        cargo
    )
    values (
        new.id,
        nova_empresa_id,
        nullif(new.raw_user_meta_data ->> 'responsavel_nome', ''),
        coalesce(nullif(new.raw_user_meta_data ->> 'cargo', ''), 'admin')
    );

    return new;
end;
$$;

drop trigger if exists ao_criar_usuario_criar_empresa
on auth.users;

create trigger ao_criar_usuario_criar_empresa
after insert on auth.users
for each row
execute function public.criar_empresa_do_usuario();


-- =========================================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================================

alter table public.empresas
enable row level security;

alter table public.usuarios_empresa
enable row level security;

alter table public.categorias
enable row level security;

alter table public.produtos
enable row level security;

alter table public.pedidos
enable row level security;

alter table public.itens_pedido
enable row level security;


-- =========================================================
-- FUNÇÃO: EMPRESAS DO USUÁRIO LOGADO
-- =========================================================

create or replace function public.usuario_empresa_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
    select empresa_id
    from public.usuarios_empresa
    where user_id = auth.uid()
$$;

grant execute
on function public.usuario_empresa_ids()
to authenticated;


-- =========================================================
-- POLÍTICAS RLS: EMPRESAS
-- =========================================================

drop policy if exists empresa_select
on public.empresas;

create policy empresa_select
on public.empresas
for select
to authenticated
using (
    id in (
        select public.usuario_empresa_ids()
    )
);


drop policy if exists empresa_update
on public.empresas;

create policy empresa_update
on public.empresas
for update
to authenticated
using (
    id in (
        select public.usuario_empresa_ids()
    )
)
with check (
    id in (
        select public.usuario_empresa_ids()
    )
);


-- =========================================================
-- POLÍTICAS RLS: USUÁRIOS DA EMPRESA
-- =========================================================

drop policy if exists usuarios_empresa_select
on public.usuarios_empresa;

create policy usuarios_empresa_select
on public.usuarios_empresa
for select
to authenticated
using (
    user_id = auth.uid()
);


-- =========================================================
-- POLÍTICAS RLS: CATEGORIAS
-- =========================================================

drop policy if exists categorias_select
on public.categorias;

create policy categorias_select
on public.categorias
for select
to authenticated
using (
    empresa_id in (
        select public.usuario_empresa_ids()
    )
);


drop policy if exists categorias_insert
on public.categorias;

create policy categorias_insert
on public.categorias
for insert
to authenticated
with check (
    empresa_id in (
        select public.usuario_empresa_ids()
    )
);


drop policy if exists categorias_update
on public.categorias;

create policy categorias_update
on public.categorias
for update
to authenticated
using (
    empresa_id in (
        select public.usuario_empresa_ids()
    )
)
with check (
    empresa_id in (
        select public.usuario_empresa_ids()
    )
);


drop policy if exists categorias_delete
on public.categorias;

create policy categorias_delete
on public.categorias
for delete
to authenticated
using (
    empresa_id in (
        select public.usuario_empresa_ids()
    )
);


-- =========================================================
-- POLÍTICAS RLS: PRODUTOS
-- =========================================================

drop policy if exists produtos_select
on public.produtos;

create policy produtos_select
on public.produtos
for select
to authenticated
using (
    empresa_id in (
        select public.usuario_empresa_ids()
    )
);


drop policy if exists produtos_insert
on public.produtos;

create policy produtos_insert
on public.produtos
for insert
to authenticated
with check (
    empresa_id in (
        select public.usuario_empresa_ids()
    )
);


drop policy if exists produtos_update
on public.produtos;

create policy produtos_update
on public.produtos
for update
to authenticated
using (
    empresa_id in (
        select public.usuario_empresa_ids()
    )
)
with check (
    empresa_id in (
        select public.usuario_empresa_ids()
    )
);


drop policy if exists produtos_delete
on public.produtos;

create policy produtos_delete
on public.produtos
for delete
to authenticated
using (
    empresa_id in (
        select public.usuario_empresa_ids()
    )
);


-- =========================================================
-- POLÍTICAS RLS: PEDIDOS
-- =========================================================

drop policy if exists pedidos_select
on public.pedidos;

create policy pedidos_select
on public.pedidos
for select
to authenticated
using (
    empresa_id in (
        select public.usuario_empresa_ids()
    )
);


drop policy if exists pedidos_update
on public.pedidos;

create policy pedidos_update
on public.pedidos
for update
to authenticated
using (
    empresa_id in (
        select public.usuario_empresa_ids()
    )
)
with check (
    empresa_id in (
        select public.usuario_empresa_ids()
    )
);


-- =========================================================
-- POLÍTICAS RLS: ITENS DO PEDIDO
-- =========================================================

drop policy if exists itens_select
on public.itens_pedido;

create policy itens_select
on public.itens_pedido
for select
to authenticated
using (
    pedido_id in (
        select id
        from public.pedidos
        where empresa_id in (
            select public.usuario_empresa_ids()
        )
    )
);


drop policy if exists itens_update
on public.itens_pedido;

create policy itens_update
on public.itens_pedido
for update
to authenticated
using (
    pedido_id in (
        select id
        from public.pedidos
        where empresa_id in (
            select public.usuario_empresa_ids()
        )
    )
);


drop policy if exists itens_delete
on public.itens_pedido;

create policy itens_delete
on public.itens_pedido
for delete
to authenticated
using (
    pedido_id in (
        select id
        from public.pedidos
        where empresa_id in (
            select public.usuario_empresa_ids()
        )
    )
);


-- =========================================================
-- SUPABASE STORAGE
-- Bucket para logos, capas e imagens de produtos
-- =========================================================

insert into storage.buckets (
    id,
    name,
    public
)
values (
    'empresa-media',
    'empresa-media',
    true
)
on conflict (id) do nothing;


-- =========================================================
-- STORAGE: LEITURA
-- =========================================================

drop policy if exists empresa_media_select
on storage.objects;

create policy empresa_media_select
on storage.objects
for select
using (
    bucket_id = 'empresa-media'
);


-- =========================================================
-- STORAGE: UPLOAD
-- =========================================================

drop policy if exists empresa_media_insert
on storage.objects;

create policy empresa_media_insert
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'empresa-media'
    and split_part(name, '/', 1)::uuid in (
        select public.usuario_empresa_ids()
    )
);


-- =========================================================
-- STORAGE: ATUALIZAÇÃO
-- =========================================================

drop policy if exists empresa_media_update
on storage.objects;

create policy empresa_media_update
on storage.objects
for update
to authenticated
using (
    bucket_id = 'empresa-media'
    and split_part(name, '/', 1)::uuid in (
        select public.usuario_empresa_ids()
    )
)
with check (
    bucket_id = 'empresa-media'
    and split_part(name, '/', 1)::uuid in (
        select public.usuario_empresa_ids()
    )
);


-- =========================================================
-- SUPABASE REALTIME
-- Habilita atualizações em tempo real para pedidos
-- =========================================================

do $$
begin

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'pedidos'
    ) then

        alter publication supabase_realtime
        add table public.pedidos;

    end if;

end
$$;


-- =========================================================
-- EMPRESA PARA TESTES
-- =========================================================

insert into public.empresas (
    nome,
    descricao
)
select
    'Empresa Teste',
    'Empresa criada para testes'
where not exists (
    select 1
    from public.empresas
    where nome = 'Empresa Teste'
);