import { supabase } from '../config/supabase.js';
import { contextoEmpresa, montarMenu } from '../utils/protecao.js';

montarMenu();

const contexto = await contextoEmpresa();

const box = document.getElementById('categories');
const newCategory = document.getElementById('newCategory');

// Carrega as categorias da empresa
async function carregarCategorias() {
    const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('empresa_id', contexto.empresa_id)
        .order('ordem');

    if (error) {
        box.innerHTML = `
            <p class="error">
                ${error.message}
            </p>
        `;
        return;
    }

    const categorias = data || [];

    if (categorias.length === 0) {
        box.innerHTML = `
            <p class="muted">
                Nenhuma categoria.
            </p>
        `;
        return;
    }

    box.innerHTML = categorias
        .map(
            (categoria) => `
                <article class="row">
                    <div>
                        <b>${categoria.nome}</b>

                        <p>
                            ${categoria.ativo ? 'Ativa' : 'Inativa'}
                        </p>
                    </div>

                    <button data-id="${categoria.id}">
                        Excluir
                    </button>
                </article>
            `
        )
        .join('');

    adicionarEventosExcluir();
}

// Adiciona evento aos botões de excluir
function adicionarEventosExcluir() {
    const botoesExcluir = box.querySelectorAll('button[data-id]');

    botoesExcluir.forEach((botao) => {
        botao.onclick = async () => {
            const confirmarExclusao = confirm('Excluir categoria?');

            if (!confirmarExclusao) {
                return;
            }

            const { error } = await supabase
                .from('categorias')
                .delete()
                .eq('id', botao.dataset.id)
                .eq('empresa_id', contexto.empresa_id);

            if (error) {
                alert(error.message);
                return;
            }

            await carregarCategorias();
        };
    });
}

// Cria uma nova categoria
newCategory.onclick = async () => {
    const nome = prompt('Nome da categoria');

    if (!nome) {
        return;
    }

    const { error } = await supabase
        .from('categorias')
        .insert({
            empresa_id: contexto.empresa_id,
            nome: nome.trim(),
            ativo: true
        });

    if (error) {
        alert(error.message);
        return;
    }

    await carregarCategorias();
};

// Carregamento inicial
carregarCategorias();
