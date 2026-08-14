import { supabase } from '../config/supabase.js';

import {
    contextoEmpresa,
    montarMenu
} from '../utils/protecao.js';

import {
    moeda,
    dataHora
} from '../utils/formatacao.js';

import {
    tocarSom
} from '../utils/notificacoes.js';

montarMenu();

const contexto = await contextoEmpresa();

const pedidosMap = new Map();

const pedidosContainer = document.getElementById('orders');
const conexaoTexto = document.getElementById('connection');
const somAtivado = document.getElementById('soundToggle');

const statusDisponiveis = [
    'pendente',
    'aceito',
    'preparando',
    'pronto',
    'saiu_para_entrega',
    'entregue',
    'cancelado'
];

function renderizarPedidos() {
    pedidosContainer.innerHTML = '';

    const pedidos = [...pedidosMap.values()].sort(
        (pedidoA, pedidoB) =>
            new Date(pedidoB.created_at) -
            new Date(pedidoA.created_at)
    );

    if (!pedidos.length) {
        pedidosContainer.innerHTML =
            '<p class="muted">Nenhum pedido.</p>';

        return;
    }

    for (const pedido of pedidos) {
        const card = document.createElement('article');

        card.className = 'order-card';

        card.innerHTML = `
            <h3>
                PEDIDO #${String(pedido.id).slice(0, 8)}
            </h3>

            <p>
                <b>Cliente:</b>
                ${pedido.cliente_id || 'Não informado'}
            </p>

            <p>
                <b>Horário:</b>
                ${dataHora(pedido.created_at)}
            </p>

            <p>
                <b>Total:</b>
                ${moeda(pedido.valor_total)}
            </p>

            <p>
                <b>Pagamento:</b>
                ${pedido.forma_pagamento || '-'}
            </p>

            <p>
                <b>Endereço:</b>
                ${pedido.endereco_entrega || '-'}
            </p>

            <p>
                <b>Observação:</b>
                ${pedido.observacao || '-'}
            </p>

            <p>
                <b>Status:</b>
                ${pedido.status}
            </p>

            <div class="order-actions">
                ${statusDisponiveis
                    .map(
                        status => `
                            <button
                                data-id="${pedido.id}"
                                data-status="${status}"
                            >
                                ${status.replaceAll('_', ' ')}
                            </button>
                        `
                    )
                    .join('')}
            </div>
        `;

        const botoes = card.querySelectorAll('button');

        botoes.forEach(botao => {
            botao.onclick = () => {
                alterarStatus(
                    botao.dataset.id,
                    botao.dataset.status
                );
            };
        });

        pedidosContainer.appendChild(card);
    }
}

async function alterarStatus(pedidoId, novoStatus) {
    const { data, error } = await supabase
        .from('pedidos')
        .update({
            status: novoStatus,
            updated_at: new Date().toISOString()
        })
        .eq('id', pedidoId)
        .eq('empresa_id', contexto.empresa_id)
        .select()
        .single();

    if (error) {
        alert(error.message);
        return;
    }

    pedidosMap.set(data.id, data);

    renderizarPedidos();
}

const {
    data: pedidos,
    error: erroCarregamento
} = await supabase
    .from('pedidos')
    .select('*')
    .eq('empresa_id', contexto.empresa_id)
    .order('created_at', {
        ascending: false
    });

if (erroCarregamento) {
    conexaoTexto.textContent = 'Erro ao carregar pedidos';
}

(pedidos || []).forEach(pedido => {
    pedidosMap.set(
        pedido.id,
        pedido
    );
});

renderizarPedidos();

const canalRealtime = supabase
    .channel(
        `pedidos-empresa-${contexto.empresa_id}`
    )

    .on(
        'postgres_changes',
        {
            event: 'INSERT',
            schema: 'public',
            table: 'pedidos',
            filter: `empresa_id=eq.${contexto.empresa_id}`
        },

        payload => {
            const novoPedido = payload.new;

            if (!pedidosMap.has(novoPedido.id)) {
                pedidosMap.set(
                    novoPedido.id,
                    novoPedido
                );

                renderizarPedidos();

                if (somAtivado.checked) {
                    tocarSom();
                }
            }
        }
    )

    .on(
        'postgres_changes',
        {
            event: 'UPDATE',
            schema: 'public',
            table: 'pedidos',
            filter: `empresa_id=eq.${contexto.empresa_id}`
        },

        payload => {
            const pedidoAtualizado = payload.new;

            pedidosMap.set(
                pedidoAtualizado.id,
                pedidoAtualizado
            );

            renderizarPedidos();
        }
    )

    .subscribe(status => {
        if (status === 'SUBSCRIBED') {
            conexaoTexto.textContent =
                '● Realtime conectado';
        } else {
            conexaoTexto.textContent =
                `Realtime: ${status}`;
        }
    });

addEventListener(
    'beforeunload',
    () => {
        supabase.removeChannel(canalRealtime);
    }
);