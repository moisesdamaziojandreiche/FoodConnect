import { supabase } from '../config/supabase.js';
import { contextoEmpresa, montarMenu } from '../utils/protecao.js';
import { moeda, esc } from '../utils/formatacao.js';

montarMenu();

const contexto = await contextoEmpresa();
const produtosContainer = document.getElementById('products');

async function carregarProdutos() {
    // A tabela produtos não tem coluna "ordem" (só categorias têm): ordena por nome.
    const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('empresa_id', contexto.empresa_id)
        .order('nome');

    if (error) {
        produtosContainer.innerHTML = `<p class="error">${esc(error.message)}</p>`;
        return;
    }

    const produtos = data || [];

    if (!produtos.length) {
        produtosContainer.innerHTML = '<p class="muted">Nenhum produto.</p>';
        return;
    }

    produtosContainer.innerHTML = produtos
        .map((produto) => `
            <article class="row">
                <div class="product-main">
                    ${produto.imagem_url
                        ? `<img src="${esc(produto.imagem_url)}" alt="${esc(produto.nome)}">`
                        : ''}

                    <div>
                        <b>${esc(produto.nome)}</b>

                        <p>
                            ${moeda(produto.preco)}
                            ·
                            ${produto.ativo ? 'No cardápio' : 'Oculto'}
                            ·
                            ${produto.disponivel ? 'Disponível' : 'Em falta'}
                        </p>
                    </div>
                </div>

                <div>
                    <button data-acao="disponivel" data-id="${produto.id}"
                            data-valor="${produto.disponivel}">
                        ${produto.disponivel ? 'Marcar em falta' : 'Marcar disponível'}
                    </button>

                    <button data-acao="excluir" data-id="${produto.id}">
                        Excluir
                    </button>
                </div>
            </article>
        `)
        .join('');

    produtosContainer
        .querySelectorAll('button[data-acao="excluir"]')
        .forEach((botao) => {
            botao.onclick = async () => {
                if (!confirm('Excluir produto?')) {
                    return;
                }

                const { error } = await supabase
                    .from('produtos')
                    .delete()
                    .eq('id', botao.dataset.id)
                    .eq('empresa_id', contexto.empresa_id);

                if (error) {
                    alert(error.message);
                    return;
                }

                carregarProdutos();
            };
        });

    produtosContainer
        .querySelectorAll('button[data-acao="disponivel"]')
        .forEach((botao) => {
            botao.onclick = async () => {
                const novoValor = botao.dataset.valor !== 'true';

                const { error } = await supabase
                    .from('produtos')
                    .update({ disponivel: novoValor })
                    .eq('id', botao.dataset.id)
                    .eq('empresa_id', contexto.empresa_id);

                if (error) {
                    alert(error.message);
                    return;
                }

                carregarProdutos();
            };
        });
}

document.getElementById('newProduct').onclick = async () => {
    const nome = (prompt('Nome do produto') || '').trim();

    if (!nome) {
        return;
    }

    // Aceita "12,50" e "12.50"
    const preco = Number(
        (prompt('Preço') || '0').replace(',', '.')
    );

    if (!Number.isFinite(preco) || preco < 0) {
        alert('Preço inválido.');
        return;
    }

    const { error } = await supabase
        .from('produtos')
        .insert({
            empresa_id: contexto.empresa_id,
            nome,
            preco: Math.round(preco * 100) / 100,
            ativo: true,
            disponivel: true
        });

    if (error) {
        alert(error.message);
        return;
    }

    carregarProdutos();
};

carregarProdutos();