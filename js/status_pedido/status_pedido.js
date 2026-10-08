// Fluxo de status do pedido para o painel do restaurante.
// As transições abaixo espelham o trigger pedidos_validar_status() do banco:
//   pendente -> aceito | cancelado
//   aceito -> preparando | cancelado
//   preparando -> pronto | cancelado
//   pronto -> saiu_para_entrega | entregue
//   saiu_para_entrega -> entregue
//
// Uso:  import { rotulo, acoes, atualizar } from '../status_pedido/status_pedido.js';

const ROTULOS = {
    aguardando_pagamento: 'Aguardando pagamento',
    pendente: 'Novo pedido',
    aceito: 'Aceito',
    preparando: 'Em preparo',
    pronto: 'Pronto',
    saiu_para_entrega: 'Saiu para entrega',
    entregue: 'Entregue',
    cancelado: 'Cancelado'
};

// Pedido sem endereço de entrega = retirada no restaurante.
const ehRetirada = (pedido) => !pedido?.endereco_entrega;

export function rotulo(status, pedido) {
    if (status === 'pronto' && ehRetirada(pedido)) {
        return 'Pronto para retirada';
    }

    if (status === 'entregue' && ehRetirada(pedido)) {
        return 'Retirado';
    }

    return ROTULOS[status] || status;
}

// Próximas ações permitidas para cada status
export function acoes(status, pedido) {
    switch (status) {
        case 'pendente':
            return [
                { status: 'aceito', label: 'Aceitar pedido' },
                { status: 'cancelado', label: 'Recusar', perigo: true }
            ];

        case 'aceito':
            return [
                { status: 'preparando', label: 'Iniciar preparo' },
                { status: 'cancelado', label: 'Cancelar', perigo: true }
            ];

        case 'preparando':
            return [
                { status: 'pronto', label: 'Marcar como pronto' },
                { status: 'cancelado', label: 'Cancelar', perigo: true }
            ];

        case 'pronto':
            return ehRetirada(pedido)
                ? [{ status: 'entregue', label: 'Marcar como retirado' }]
                : [{ status: 'saiu_para_entrega', label: 'Saiu para entrega' }];

        case 'saiu_para_entrega':
            return [{ status: 'entregue', label: 'Marcar como entregue' }];

        default:
            return [];
    }
}

// Pedidos aguardando pagamento NÃO devem aparecer para a cozinha
// (a RLS já esconde, isto é só uma segunda proteção).
export function visivelParaCozinha(pedido) {
    return pedido.status !== 'aguardando_pagamento';
}

export async function atualizar(supabase, pedidoId, novoStatus) {
    const { error } = await supabase
        .from('pedidos')
        .update({ status: novoStatus })
        .eq('id', pedidoId);

    if (error) {
        throw error;
    }
}