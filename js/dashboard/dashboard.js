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

// A RLS já devolve só pedidos PAGOS ('aprovado' ou 'reembolsado') da empresa.
const { data, error } = await supabase
    .from('pedidos')
    .select('id, status, valor_total, payment_status')
    .eq('empresa_id', contexto.empresa_id)
    .gte('created_at', hoje.toISOString());

if (error) {
    console.error('Erro ao carregar pedidos:', error);
}

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

// Faturamento: só pedido pago, não cancelado e não reembolsado.
const faturamento = pedidos
    .filter(
        pedido =>
            pedido.payment_status === 'aprovado' &&
            pedido.status !== 'cancelado'
    )
    .reduce(
        (soma, pedido) => soma + Number(pedido.valor_total || 0),
        0
    );

revenue.textContent = moeda(faturamento);


// =========================================================
// FATURAMENTO MENSAL
// Conta só pedidos pagos (payment_status = 'aprovado') e não cancelados,
// a mesma regra do card "Faturamento de hoje".
// =========================================================

const mesInput = document.getElementById('mesFaturamento');
const mesTotal = document.getElementById('mesTotal');
const mesVariacao = document.getElementById('mesVariacao');
const mesPedidos = document.getElementById('mesPedidos');
const mesTicket = document.getElementById('mesTicket');
const mesMelhorDia = document.getElementById('mesMelhorDia');
const mesMelhorDiaValor = document.getElementById('mesMelhorDiaValor');
const mesGrafico = document.getElementById('mesGrafico');
const mesMensagem = document.getElementById('mesMensagem');

let versaoBusca = 0;

function textoMes(data) {
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

// '2026-11' -> { inicio, fim, diasNoMes } (datas no fuso do navegador)
function intervaloDoMes(valor) {
    const [ano, mes] = valor.split('-').map(Number);

    return {
        inicio: new Date(ano, mes - 1, 1),
        fim: new Date(ano, mes, 1),
        diasNoMes: new Date(ano, mes, 0).getDate()
    };
}

function mesAnterior(valor) {
    const [ano, mes] = valor.split('-').map(Number);

    return textoMes(new Date(ano, mes - 2, 1));
}

// Busca em páginas de 1000 (limite do Supabase por consulta).
async function buscarPedidosPagos(inicio, fim) {
    const TAMANHO = 1000;
    let todos = [];
    let de = 0;

    while (true) {
        const { data, error } = await supabase
            .from('pedidos')
            .select('id, valor_total, created_at')
            .eq('empresa_id', contexto.empresa_id)
            .eq('payment_status', 'aprovado')
            .neq('status', 'cancelado')
            .gte('created_at', inicio.toISOString())
            .lt('created_at', fim.toISOString())
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(de, de + TAMANHO - 1);

        if (error) {
            throw error;
        }

        todos = todos.concat(data || []);

        if (!data || data.length < TAMANHO) {
            break;
        }

        de += TAMANHO;
    }

    return todos;
}

// Soma total e por dia do mês.
function resumirMes(pedidos, diasNoMes) {
    const porDia = Array(diasNoMes).fill(0);
    let total = 0;

    pedidos.forEach((pedido) => {
        const valor = Number(pedido.valor_total || 0);
        const dia = new Date(pedido.created_at).getDate();

        total += valor;
        porDia[dia - 1] += valor;
    });

    return { total, porDia, quantidade: pedidos.length };
}

function desenharGrafico(porDia, maximo) {
    mesGrafico.innerHTML = porDia
        .map((valor, indice) => {
            const altura = maximo > 0 ? Math.max((valor / maximo) * 100, valor > 0 ? 3 : 0) : 0;

            return `
                <div class="barra-dia" title="Dia ${indice + 1}: ${moeda(valor)}">
                    <div class="barra-area">
                        <div class="barra" style="height:${altura}%"></div>
                    </div>
                    <span>${indice + 1}</span>
                </div>
            `;
        })
        .join('');
}

function mostrarVariacao(atual, anterior) {
    mesVariacao.className = '';

    if (anterior > 0) {
        const pct = ((atual - anterior) / anterior) * 100;
        const subiu = pct >= 0;

        mesVariacao.classList.add(subiu ? 'sobe' : 'desce');
        mesVariacao.textContent =
            `${subiu ? '▲' : '▼'} ${Math.abs(pct).toLocaleString('pt-BR', {
                maximumFractionDigits: 1
            })}% vs mês anterior (${moeda(anterior)})`;
        return;
    }

    mesVariacao.textContent =
        atual > 0 ? 'Sem faturamento no mês anterior' : '';
}

async function carregarFaturamentoMensal() {
    const minhaVersao = ++versaoBusca;
    const mes = mesInput.value || textoMes(new Date());

    mesMensagem.textContent = 'Carregando...';

    try {
        const atual = intervaloDoMes(mes);
        const anterior = intervaloDoMes(mesAnterior(mes));

        const [pedidosMes, pedidosAnterior] = await Promise.all([
            buscarPedidosPagos(atual.inicio, atual.fim),
            buscarPedidosPagos(anterior.inicio, anterior.fim)
        ]);

        // Se o usuário trocou de mês enquanto carregava, ignora esta resposta.
        if (minhaVersao !== versaoBusca) {
            return;
        }

        const resumo = resumirMes(pedidosMes, atual.diasNoMes);
        const totalAnterior = resumirMes(pedidosAnterior, anterior.diasNoMes).total;

        mesTotal.textContent = moeda(resumo.total);
        mesPedidos.textContent = resumo.quantidade;
        mesTicket.textContent = moeda(
            resumo.quantidade ? resumo.total / resumo.quantidade : 0
        );

        mostrarVariacao(resumo.total, totalAnterior);

        const maximo = Math.max(...resumo.porDia);

        if (maximo > 0) {
            const melhor = resumo.porDia.indexOf(maximo) + 1;
            mesMelhorDia.textContent = `Dia ${melhor}`;
            mesMelhorDiaValor.textContent = moeda(maximo);
        } else {
            mesMelhorDia.textContent = '—';
            mesMelhorDiaValor.textContent = '';
        }

        desenharGrafico(resumo.porDia, maximo);

        mesMensagem.textContent =
            resumo.quantidade === 0
                ? 'Nenhum pedido pago neste mês.'
                : '';
    } catch (erro) {
        if (minhaVersao !== versaoBusca) {
            return;
        }

        console.error('Erro no faturamento mensal:', erro);
        mesMensagem.textContent =
            `Não foi possível carregar o faturamento: ${erro.message}`;
    }
}

mesInput.value = textoMes(new Date());
mesInput.max = textoMes(new Date());
mesInput.onchange = carregarFaturamentoMensal;

await carregarFaturamentoMensal();