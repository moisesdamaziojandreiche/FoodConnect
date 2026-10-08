export const moeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(Number(valor) || 0);
};

export const dataHora = (valor) => {
    return new Date(valor).toLocaleString('pt-BR');
};

// Evita que texto digitado por usuários (nome de produto, observação etc.)
// seja interpretado como HTML quando usamos innerHTML.
export const esc = (valor) => {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};