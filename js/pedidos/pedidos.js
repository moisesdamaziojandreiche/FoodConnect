import React, { useCallback, useContext, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";

import { supabase } from "../lib/supabase";
import Menu from "../components/Menu";
import { ThemeContext } from "../context/ThemeContext";

// Mesmos status que o painel do restaurante usa.
const STATUS = {
  aguardando_pagamento: "Aguardando pagamento",
  pendente: "Pagamento aprovado — aguardando o restaurante",
  aceito: "Pedido aceito",
  preparando: "Em preparo",
  pronto: "Pronto para retirada",
  entregue: "Retirado",
  cancelado: "Cancelado",
};

export default function OrdersScreen({ navigation }) {
  const { cores } = useContext(ThemeContext);

  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    if (!supabase.from) {
      setErro("Supabase não configurado");
      setCarregando(false);
      return;
    }

    // A RLS já garante que só voltam os pedidos do próprio cliente.
    const { data, error } = await supabase
      .from("pedidos")
      .select("id, status, valor_total, created_at, empresas(nome, endereco)")
      .order("created_at", { ascending: false });

    setErro(error ? error.message : null);
    setPedidos(data || []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();

    if (!supabase.channel) return undefined;

    let canal;
    let cancelado = false;

    // Tempo real: quando o restaurante muda o status no painel, a lista atualiza.
    supabase.auth.getUser().then(({ data }) => {
      const usuario = data?.user;
      if (!usuario || cancelado) return;

      canal = supabase
        .channel(`meus-pedidos-${usuario.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "pedidos",
            filter: `cliente_id=eq.${usuario.id}`,
          },
          () => carregar()
        )
        .subscribe();
    });

    return () => {
      cancelado = true;
      if (canal) supabase.removeChannel(canal);
    };
  }, [carregar]);

  return (
    <View style={[styles.container, { backgroundColor: cores.fundo }]}>
      <Text style={[styles.titulo, { color: cores.texto }]}>
        Meus Pedidos
      </Text>

      <FlatList
        data={pedidos}
        keyExtractor={(item) => item.id}
        refreshing={carregando}
        onRefresh={carregar}
        ListEmptyComponent={
          <Text style={{ color: cores.secundario }}>
            {erro
              ? `Erro ao carregar: ${erro}`
              : carregando
              ? "Carregando..."
              : "Você ainda não fez pedidos."}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: cores.card }]}>
            <Text style={[styles.restaurante, { color: cores.texto }]}>
              {item.empresas?.nome || "Restaurante"}
            </Text>

            <Text style={{ color: cores.principal, fontWeight: "bold" }}>
              {STATUS[item.status] || item.status}
            </Text>

            {item.status === "pronto" && !!item.empresas?.endereco && (
              <Text style={{ color: cores.texto, marginTop: 4 }}>
                Retire em: {item.empresas.endereco}
              </Text>
            )}

            <Text style={{ color: cores.secundario, marginTop: 4 }}>
              R$ {Number(item.valor_total).toFixed(2)}  •{" "}
              {new Date(item.created_at).toLocaleString("pt-BR")}
            </Text>
          </View>
        )}
      />

      <Menu navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingBottom: 90,
  },

  titulo: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
  },

  card: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
  },

  restaurante: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
});