import { supabase } from '../config/supabase.js';

import {
    contextoEmpresa,
    montarMenu
} from '../utils/protecao.js';

import {
    moeda
} from '../utils/formatacao.js';

montarMenu();

const contexto = await contextoEmpresa();
const produtosContainer = document.getElementById('products');

async function carregarProdutos() {
    const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('empresa_id', contexto.empresa_id)
        .order('ordem');

    if (error) {
        produtosContainer.innerHTML = `
            <p class="error">
                ${error.message}
            </p>
        `;

        return;
    }

    const produtos = data || [];

    if (!produtos.length) {
        produtosContainer.innerHTML = `
            <p class="muted">
                Nenhum produto.
            </p>
        `;

        return;
    }

    produtosContainer.innerHTML = produtos
        .map(
            produto => `
                <article class="row">

                    <div class="product-main">

                        ${
                            produto.imagem_url
                                ? `
                                    <img
                                        src="${produto.imagem_url}"
                                        alt="${produto.nome}"
                                    >
                                `
                                : ''
                        }

                        <div>
                            <b>
                                ${produto.nome}
                            </b>

                            <p>
                                ${moeda(produto.preco)}
                                ·
                                ${
                                    produto.ativo
                                        ? 'Ativo'
                                        : 'Inativo'
                                }
                            </p>
                        </div>

                    </div>

                    <button
                        data-id="${produto.id}"
                    >
                        Excluir
                    </button>

                </article>
            `
        )
        .join('');

    const botoesExcluir =
        produtosContainer.querySelectorAll(
            'button[data-id]'
        );

    botoesExcluir.forEach(botao => {
        botao.onclick = async () => {
            const confirmar = confirm(
                'Excluir produto?'
            );

            if (!confirmar) {
                return;
            }

            const { error } = await supabase
                .from('produtos')
                .delete()
                .eq(
                    'id',
                    botao.dataset.id
                )
                .eq(
                    'empresa_id',
                    contexto.empresa_id
                );

            if (error) {
                alert(error.message);
                return;
            }

            carregarProdutos();
        };
    });
}

const botaoNovoProduto =
    document.getElementById('newProduct');

botaoNovoProduto.onclick = async () => {
    const nome = prompt(
        'Nome do produto'
    );

    if (!nome) {
        return;
    }

    const preco = Number(
        prompt('Preço') || 0
    );

    const { error } = await supabase
        .from('produtos')
        .insert({
            empresa_id: contexto.empresa_id,
            nome,
            preco,
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