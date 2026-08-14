import { supabase } from '../config/supabase.js';

export async function contextoEmpresa() {
    const {
        data: { user },
        error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
        location.href = 'login.html';
        throw new Error('Não autenticado');
    }

    const { data, error } = await supabase
        .from('usuarios_empresa')
        .select('empresa_id, nome, cargo, empresas(*)')
        .eq('user_id', user.id)
        .single();

    if (error || !data) {
        await supabase.auth.signOut();

        location.href = 'login.html';

        throw new Error('Empresa não encontrada');
    }

    return {
        ...data,
        user
    };
}

export function montarMenu() {
    const sidebar = document.getElementById('sidebar');

    if (!sidebar) {
        return;
    }

    sidebar.innerHTML = `
        <h2>FoodAdmin</h2>

        <a href="dashboard.html">Dashboard</a>
        <a href="pedidos.html">Pedidos</a>
        <a href="produtos.html">Produtos</a>
        <a href="categorias.html">Categorias</a>
        <a href="empresa.html">Empresa</a>
        <a href="configuracoes.html">Configurações</a>

        <button id="menuLogout">
            Sair
        </button>
    `;

    const logoutButton = document.getElementById('menuLogout');

    logoutButton.onclick = async () => {
        await supabase.auth.signOut();

        location.href = 'login.html';
    };
}