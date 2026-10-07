// Fluxo de status do pedido para o painel do restaurante.
// Carregue com <script src="js/status-pedido.js"></script> ANTES do script da página.
// Expõe o objeto global FoodStatus.
(function (global) {
  const ROTULOS = {
    aguardando_pagamento: "Aguardando pagamento",
    pendente: "Novo pedido",
    aceito: "Aceito",
    preparando: "Em preparo",
    pronto: "Pronto",
    saiu_para_entrega: "Saiu para entrega",
    entregue: "Entregue",
    cancelado: "Cancelado",
  };

  // Próximas ações permitidas para cada status
  const ACOES = {
    pendente: [
      { status: "aceito", label: "Aceitar pedido" },
      { status: "cancelado", label: "Recusar", perigo: true },
    ],
    aceito: [
      { status: "preparando", label: "Iniciar preparo" },
      { status: "cancelado", label: "Cancelar", perigo: true },
    ],
    preparando: [
      { status: "pronto", label: "Marcar como pronto" },
      { status: "cancelado", label: "Cancelar", perigo: true },
    ],
    pronto: [{ status: "saiu_para_entrega", label: "Saiu para entrega" }],
    saiu_para_entrega: [{ status: "entregue", label: "Marcar como entregue" }],
  };

  function rotulo(status) {
    return ROTULOS[status] || status;
  }

  function acoes(status) {
    return ACOES[status] || [];
  }

  // Pedidos aguardando pagamento NÃO devem aparecer para a cozinha
  function visivelParaCozinha(pedido) {
    return pedido.status !== "aguardando_pagamento";
  }

  async function atualizar(supabase, pedidoId, novoStatus) {
    const { error } = await supabase
      .from("pedidos")
      .update({ status: novoStatus })
      .eq("id", pedidoId);
    if (error) throw error;
  }

  global.FoodStatus = { rotulo, acoes, visivelParaCozinha, atualizar };
})(window);