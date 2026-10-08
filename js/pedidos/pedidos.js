import { supabase } from '../config/supabase.js';
import { contextoEmpresa, montarMenu } from '../utils/protecao.js';
import { moeda, dataHora, esc } from '../utils/formatacao.js';
import { tocarSom } from '../utils/notificacoes.js';
import {
    rotulo,
    acoes,
    visivelParaCozinha,
    atualizar
} from '../status_pedido/status_pedido.js';

montarMenu();

const contexto = await contextoEmpresa();

const lista = document.getElementById('orders');
const conexao = document.getElementById('connection');
const somLigado = document.getElementById('soundToggle');

// ids dos pedidos que já estavam "pendente" na última carga
// (para tocar o som só quando chega um pedido novo)
let pendentesConhecidos = null;

async function carregarPedidos() {
    // A RLS só devolve pedidos JÁ PAGOS desta empresa.
    const { data, error } = await supabase
        .from('pedidos')
        .select(`
            id, status, valor_total, observacao, endereco_entrega,
            cliente_nome, payment_status, payment_method, created_at,
            itens_pedido ( nome_produto, quantidade, subtotal, observacao )
        `)
        .eq('empresa_id', contexto.empresa_id)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        lista.innerHTML = `<p class="error">${esc(error.message)}</p>`;
        return;
    }

    const pedidos = (data || []).filter(visivelParaCozinha);

    const pendentes = new Set(
        pedidos.filter((p) => p.status === 'pendente').map((p) => p.id)
    );

    if (pendentesConhecidos && somLigado.checked) {
        const chegouNovo = [...pendentes].some(
            (id) => !pendentesConhecidos.has(id)
        );

        if (chegouNovo) {
            tocarSom();
        }
    }

    pendentesConhecidos = pendentes;

    desenhar(pedidos);
}

function desenhar(pedidos) {
    if (!pedidos.length) {
        lista.innerHTML = '<p class="muted">Nenhum pedido pago ainda.</p>';
        return;
    }

    lista.innerHTML = pedidos
        .map((pedido) => {
            const itens = (pedido.itens_pedido || [])
                .map(
                    (item) => `
                        <li>
                            ${item.quantidade}x ${esc(item.nome_produto)}
                            — ${moeda(item.subtotal)}
                            ${item.observacao ? `<br><small>Obs.: ${esc(item.observacao)}</small>` : ''}
                        </li>
                    `
                )
                .join('');

            const botoes = acoes(pedido.status, pedido)
                .map(
                    (acao) => `
                        <button
                            data-id="${pedido.id}"
                            data-status="${acao.status}"
                            ${acao.perigo ? 'class="danger"' : ''}
                        >
                            ${esc(acao.label)}
                        </button>
                    `
                )
                .join('');

            const reembolsado = pedido.payment_status === 'reembolsado';

            return `
                <article class="card order-card">
                    <h3>
                        #${pedido.id.slice(0, 8)} · ${esc(rotulo(pedido.status, pedido))}
                    </h3>

                    <p class="muted">
                        ${esc(pedido.cliente_nome || 'Cliente')}
                        · ${dataHora(pedido.created_at)}
                    </p>

                    <ul>${itens}</ul>

                    <p><b>Total: ${moeda(pedido.valor_total)}</b>
                        ${pedido.payment_method ? `(${esc(pedido.payment_method)})` : ''}
                        ${reembolsado ? ' — REEMBOLSADO' : ''}
                    </p>

                    <p>
                        ${pedido.endereco_entrega
                            ? `Entrega: ${esc(pedido.endereco_entrega)}`
                            : 'Retirada no restaurante'}
                    </p>

                    ${pedido.observacao
                        ? `<p>Obs.: ${esc(pedido.observacao)}</p>`
                        : ''}

                    <div class="order-actions">${botoes}</div>
                </article>
            `;
        })
        .join('');

    lista.querySelectorAll('button[data-status]').forEach((botao) => {
        botao.onclick = async () => {
            if (
                botao.dataset.status === 'cancelado' &&
                !confirm('Cancelar este pedido?')
            ) {
                return;
            }

            botao.disabled = true;

            try {
                await atualizar(
                    supabase,
                    botao.dataset.id,
                    botao.dataset.status
                );

                await carregarPedidos();
            } catch (erro) {
                alert(erro.message);
                botao.disabled = false;
            }
        };
    });
}

// Tempo real: INSERT/UPDATE em pedidos desta empresa.
supabase
    .channel(`pedidos-empresa-${contexto.empresa_id}`)
    .on(
        'postgres_changes',
        {
            event: '*',
            schema: 'public',
            table: 'pedidos',
            filter: `empresa_id=eq.${contexto.empresa_id}`
        },
        () => carregarPedidos()
    )
    .subscribe((estado) => {
        conexao.textContent =
            estado === 'SUBSCRIBED'
                ? 'Conectado em tempo real'
                : estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT'
                ? 'Sem conexão em tempo real (recarregue a página)'
                : 'Conectando...';
    });

await carregarPedidos();