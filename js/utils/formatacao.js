export const moeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(Number(valor) || 0);
};

export const dataHora = (valor) => {
    return new Date(valor).toLocaleString('pt-BR');
};