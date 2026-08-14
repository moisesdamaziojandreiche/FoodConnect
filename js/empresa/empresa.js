import { supabase } from '../config/supabase.js';
import {
    contextoEmpresa,
    montarMenu
} from '../utils/protecao.js';

montarMenu();

const contexto = await contextoEmpresa();
const empresa = contexto.empresas || {};

nome.value = empresa.nome || '';
descricao.value = empresa.descricao || '';
telefone.value = empresa.telefone || '';
endereco.value = empresa.endereco || '';
abertura.value = empresa.horario_abertura || '';
fechamento.value = empresa.horario_fechamento || '';

async function upload(file, nomeBase) {
    if (!file) {
        return null;
    }

    const extensao = file.name.split('.').pop();

    const caminho = `
        ${contexto.empresa_id}/${nomeBase}-${Date.now()}.${extensao}
    `.trim();

    const { error } = await supabase.storage
        .from('empresa-media')
        .upload(caminho, file, {
            upsert: true
        });

    if (error) {
        throw error;
    }

    return supabase.storage
        .from('empresa-media')
        .getPublicUrl(caminho)
        .data.publicUrl;
}

companyForm.onsubmit = async (event) => {
    event.preventDefault();

    try {
        const logoUrl = await upload(
            logo.files[0],
            'logo'
        );

        const capaUrl = await upload(
            capa.files[0],
            'capa'
        );

        const dadosEmpresa = {
            nome: nome.value.trim(),
            descricao: descricao.value.trim(),
            telefone: telefone.value.trim(),
            endereco: endereco.value.trim(),
            horario_abertura: abertura.value || null,
            horario_fechamento: fechamento.value || null,
            updated_at: new Date().toISOString()
        };

        if (logoUrl) {
            dadosEmpresa.logo_url = logoUrl;
        }

        if (capaUrl) {
            dadosEmpresa.imagem_capa_url = capaUrl;
        }

        const { error } = await supabase
            .from('empresas')
            .update(dadosEmpresa)
            .eq('id', contexto.empresa_id);

        if (error) {
            throw error;
        }

        alert('Empresa atualizada!');
    } catch (erro) {
        alert(erro.message);
    }
};