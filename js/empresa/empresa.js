import { supabase } from '../config/supabase.js';
import {
    contextoEmpresa,
    montarMenu
} from '../utils/protecao.js';

montarMenu();

const contexto = await contextoEmpresa();
const empresa = contexto.empresas || {};

// O input type="time" quer HH:MM; o banco devolve HH:MM:SS.
const hhmm = (valor) => (valor ? String(valor).slice(0, 5) : '');

nome.value = empresa.nome || '';
descricao.value = empresa.descricao || '';
telefone.value = empresa.telefone || '';
endereco.value = empresa.endereco || '';
abertura.value = hhmm(empresa.horario_abertura);
fechamento.value = hhmm(empresa.horario_fechamento);

// Bucket "imagens". A policy de storage exige o caminho
// empresas/<empresa_id>/<arquivo>.
async function upload(file, nomeBase) {
    if (!file) {
        return null;
    }

    const extensao = (file.name.split('.').pop() || 'jpg').toLowerCase();

    const caminho =
        `empresas/${contexto.empresa_id}/${nomeBase}-${Date.now()}.${extensao}`;

    const { error } = await supabase.storage
        .from('imagens')
        .upload(caminho, file, {
            upsert: true
        });

    if (error) {
        throw error;
    }

    return supabase.storage
        .from('imagens')
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

        // Só colunas liberadas no GRANT UPDATE de public.empresas.
        // (updated_at é atualizado sozinho pelo trigger do banco.)
        const dadosEmpresa = {
            nome: nome.value.trim(),
            descricao: descricao.value.trim() || null,
            telefone: telefone.value.trim() || null,
            endereco: endereco.value.trim() || null,
            horario_abertura: abertura.value || null,
            horario_fechamento: fechamento.value || null
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