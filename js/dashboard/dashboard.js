import { supabase } from '../config/supabase.js';
import {
    contextoEmpresa,
    montarMenu
} from '../utils/protecao.js';
import { moeda } from '../utils/formatacao.js';

montarMenu();

const contexto = await contextoEmpresa();

empresaNome.textContent = contexto.empresas?.nome || '';

const hoje = new Date();
hoje.setHours(0, 0, 0, 0);

const { data } = await supabase
    .from('pedidos')
    .select('*')
    .eq('empresa_id', contexto.empresa_id)
    .gte('created_at', hoje.toISOString());

const pedidos = data || [];

todayOrders.textContent = pedidos.length;

pendingOrders.textContent = pedidos.filter(
    pedido => pedido.status === 'pendente'
).length;

preparingOrders.textContent = pedidos.filter(
    pedido => pedido.status === 'preparando'
).length;

completedOrders.textContent = pedidos.filter(
    pedido => pedido.status === 'entregue'
).length;

const faturamento = pedidos
    .filter(pedido => pedido.status !== 'cancelado')
    .reduce(
        (soma, pedido) => soma + Number(pedido.valor_total || 0),
        0
    );

revenue.textContent = moeda(faturamento);