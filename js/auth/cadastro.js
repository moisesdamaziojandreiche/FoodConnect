import { supabase } from '../config/supabase.js';


const cadastroForm =
    document.getElementById(
        'cadastroForm'
    );


const botaoCadastrar =
    document.getElementById(
        'botaoCadastrar'
    );


const mensagem =
    document.getElementById(
        'cadastroMensagem'
    );


function mostrarErro(texto) {

    mensagem.textContent = texto;

    mensagem.className =
        'mensagem erro';
}


function mostrarSucesso(texto) {

    mensagem.textContent = texto;

    mensagem.className =
        'mensagem sucesso';
}


function limparMensagem() {

    mensagem.textContent = '';

    mensagem.className =
        'mensagem';
}


cadastroForm.addEventListener(
    'submit',

    async (event) => {

        event.preventDefault();

        limparMensagem();


        /*
        =========================
        PEGAR CAMPOS
        =========================
        */

        const nomeEmpresa =
            document
                .getElementById(
                    'nomeEmpresa'
                )
                .value
                .trim();


        const descricao =
            document
                .getElementById(
                    'descricao'
                )
                .value
                .trim();


        const telefone =
            document
                .getElementById(
                    'telefone'
                )
                .value
                .trim();


        const endereco =
            document
                .getElementById(
                    'endereco'
                )
                .value
                .trim();


        const responsavel =
            document
                .getElementById(
                    'responsavel'
                )
                .value
                .trim();


        const email =
            document
                .getElementById(
                    'email'
                )
                .value
                .trim();


        const senha =
            document
                .getElementById(
                    'senha'
                )
                .value;


        const confirmarSenha =
            document
                .getElementById(
                    'confirmarSenha'
                )
                .value;


        /*
        =========================
        VALIDAÇÕES
        =========================
        */

        if (
            !nomeEmpresa ||
            !responsavel ||
            !email ||
            !senha
        ) {

            mostrarErro(
                'Preencha todos os campos obrigatórios.'
            );

            return;
        }


        if (senha.length < 8) {

            mostrarErro(
                'A senha deve possuir pelo menos 8 caracteres.'
            );

            return;
        }


        if (
            senha !==
            confirmarSenha
        ) {

            mostrarErro(
                'As senhas não são iguais.'
            );

            return;
        }


        /*
        =========================
        LOADING
        =========================
        */

        botaoCadastrar.disabled =
            true;


        botaoCadastrar.textContent =
            'Cadastrando...';


        try {

            /*
            =========================
            SUPABASE AUTH
            =========================

            Os dados colocados em
            options.data serão salvos
            como metadata do usuário.

            O trigger do banco poderá
            usar esses dados para
            criar automaticamente:

            empresas

            e

            usuarios_empresa
            */


            const {
                data,
                error
            } =
                await supabase
                    .auth
                    .signUp({

                        email:
                            email,

                        password:
                            senha,

                        options: {

                            // Chaves lidas pelo trigger criar_conta_no_cadastro():
                            // tipo_cadastro, nome_empresa, nome, telefone, endereco
                            data: {

                                tipo_cadastro:
                                    'empresa',

                                nome_empresa:
                                    nomeEmpresa,

                                nome:
                                    responsavel,

                                telefone:
                                    telefone,

                                endereco:
                                    endereco

                            }

                        }

                    });


            /*
            =========================
            ERRO DO SUPABASE
            =========================
            */

            if (error) {

                throw error;

            }


            /*
            =========================
            VERIFICAR USUÁRIO
            =========================
            */

            if (!data.user) {

                throw new Error(
                    'Não foi possível criar o usuário.'
                );

            }


            /*
            =========================
            COM SESSÃO
            =========================

            Se confirmação de e-mail
            estiver desativada,
            poderá existir uma sessão
            imediatamente.
            */

            if (data.session) {

                // O trigger do banco não grava a descrição: atualiza agora.
                if (descricao) {

                    await supabase
                        .from('empresas')
                        .update({ descricao })
                        .eq(
                            'id',
                            (
                                await supabase
                                    .from('usuarios_empresa')
                                    .select('empresa_id')
                                    .eq('user_id', data.user.id)
                                    .maybeSingle()
                            ).data?.empresa_id
                        );

                }

                mostrarSucesso(
                    'Empresa cadastrada com sucesso! Entrando no sistema...'
                );


                setTimeout(
                    () => {

                        window.location.href =
                            'dashboard.html';

                    },
                    1200
                );


                return;
            }


            /*
            =========================
            SEM SESSÃO
            =========================

            Normalmente acontece
            quando confirmação de
            e-mail está habilitada.
            */

            mostrarSucesso(
                'Empresa cadastrada! Verifique seu e-mail para confirmar a conta antes de entrar.'
            );


            cadastroForm.reset();


        } catch (erro) {

            console.error(
                'Erro no cadastro:',
                erro
            );


            let mensagemErro =
                erro.message;


            /*
            =========================
            TRADUÇÕES SIMPLES
            =========================
            */

            if (
                mensagemErro
                    .toLowerCase()
                    .includes(
                        'already registered'
                    )
            ) {

                mensagemErro =
                    'Este e-mail já está cadastrado.';

            }


            if (
                mensagemErro
                    .toLowerCase()
                    .includes(
                        'password'
                    )
            ) {

                mensagemErro =
                    'Verifique se a senha atende aos requisitos.';

            }


            mostrarErro(
                mensagemErro
            );


        } finally {

            /*
            =========================
            FINALIZAR LOADING
            =========================
            */

            botaoCadastrar.disabled =
                false;


            botaoCadastrar.textContent =
                'Cadastrar empresa';

        }

    }
);