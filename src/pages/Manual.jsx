import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search, Home, Book, FileText, ShoppingCart, Warehouse, Factory,
  Cog, AlertCircle, BarChart3, Calendar, Users, Package, Cpu,
  ChevronRight, ChevronDown, MessageCircle, Send, X, HelpCircle,
  ArrowRight, CheckCircle2, Lightbulb, BookOpen, Zap, ArrowLeft
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ────────────────────────────────────────────────────────
// BASE DE CONHECIMENTO COMPLETA DO ERP
// Cada módulo contém suas rotinas com passos, regras e FAQ
// ────────────────────────────────────────────────────────

const MODULES = [
  {
    id: 'intro',
    title: 'Introdução',
    icon: Home,
    color: 'from-indigo-500 to-indigo-600',
    badge: null,
    description: 'Visão geral do sistema AGFSig ERP',
    routines: [
      {
        id: 'visao-geral',
        title: 'Visão Geral do Sistema',
        description: 'O AGFSig ERP é um sistema de gestão empresarial completo para controlar todas as operações da sua empresa: vendas, estoque, produção, pós-vendas, qualidade, engenharia e relatórios.',
        steps: [],
        rules: [
          'O sistema opera com multi-empresa — você pode alternar entre empresas pelo seletor no cabeçalho.',
          'Cada usuário tem permissões baseadas em módulos atribuídos pelo administrador.',
          'Administradores têm acesso total a todos os módulos e funções.',
          'O Dashboard principal mostra KPIs em tempo real da empresa selecionada.',
        ],
        tips: [
          'Use o seletor de empresa no canto superior direito para trocar a empresa ativa.',
          'O menu lateral pode ser recolhido para ter mais espaço na tela.',
          'Notificações automáticas alertam sobre atrasos e eventos importantes.',
        ],
        faq: [
          { q: 'Como trocar de empresa?', a: 'Clique no seletor de empresa no canto superior direito e selecione a empresa desejada. A seleção persiste mesmo após atualizar a página.' },
          { q: 'Não consigo acessar um módulo, o que fazer?', a: 'Peça ao administrador para liberar o módulo no Gestão de Usuários. Apenas admins podem gerenciar permissões.' },
          { q: 'Como funciona o sistema de notificações?', a: 'O sino no cabeçalho mostra alertas de OPs atrasadas, pedidos vencendo, movimentações recentes e visitas agendadas. São atualizadas a cada 3 minutos.' },
        ]
      }
    ]
  },
  {
    id: 'agenda',
    title: 'Minha Agenda',
    icon: Calendar,
    color: 'from-violet-500 to-violet-600',
    badge: 'Agenda',
    description: 'Prospecção, visitas, projetos e controle de KM',
    routines: [
      {
        id: 'visitas',
        title: 'Agenda de Visitas',
        description: 'Gerencie e agende visitas comerciais a clientes potenciais e ativos.',
        steps: [
          'Acesse Minha Agenda → Agenda de Visitas.',
          'Clique em "Nova Visita" para agendar.',
          'Preencha: data, hora, cliente, vendedor e objetivo.',
          'Salve — a visita aparecerá no calendário e nas notificações.',
          'Após realizar a visita, edite e registre o resultado.',
        ],
        rules: [
          'Visitas próximas geram notificações automáticas no painel.',
          'Visitas canceladas geram alerta de tipo "VISITA_CANCELADA" (notificação crítica).',
          'Cada visita pode ser de tipo: Prospecção, Follow-up ou Fechamento.',
        ],
        tips: ['Registre o resultado da visita no mesmo dia para manter o histórico atualizado.'],
        faq: [
          { q: 'Recebo notificação de visita próxima?', a: 'Sim, o painel de notificações alerta sobre visitas futuras automaticamente.' },
        ]
      },
      {
        id: 'prospeccao',
        title: 'Prospecção de Clientes',
        description: 'Registre visitas de prospecção com detalhes de contato e oportunidade.',
        steps: [
          'Acesse Minha Agenda → Prospecção.',
          'Clique em "Nova Prospecção".',
          'Preencha dados do lead: nome, empresa, contato, localização.',
          'Registre o tipo e resultado da abordagem.',
          'Defina próximos passos e acompanhamento.',
        ],
        rules: [
          'Cada prospecção é vinculada a um vendedor.',
          'O dashboard de prospecção mostra métricas de conversão.',
        ],
        tips: ['Use o Dashboard de Prospecção para acompanhar a taxa de conversão de leads.'],
        faq: []
      },
      {
        id: 'km',
        title: 'Registro de KM',
        description: 'Controle diário de quilometragem de veículos da empresa.',
        steps: [
          'Acesse Minha Agenda → Registro de KM.',
          'Selecione o veículo e a data.',
          'Informe o KM inicial e final do dia.',
          'Adicione observações se necessário.',
          'Salve o registro.',
        ],
        rules: [
          'KM final deve ser maior que KM inicial.',
          'Registros são por veículo/dia.',
        ],
        tips: ['Registre o KM no início e final de cada expediente.'],
        faq: []
      },
    ]
  },
  {
    id: 'cadastros',
    title: 'Cadastros',
    icon: FileText,
    color: 'from-sky-500 to-sky-600',
    badge: 'Cadastros',
    description: 'Dados mestres: produtos, clientes, vendedores, armazéns',
    routines: [
      {
        id: 'produtos',
        title: 'Cadastro de Produtos',
        description: 'Cadastre produtos com SKU, descrição, preços e informações técnicas.',
        steps: [
          'Acesse Cadastros → Produtos.',
          'Clique em "Novo Produto".',
          'Preencha SKU (código único), descrição, unidade de medida.',
          'Informe preço de custo e preço de venda.',
          'Selecione a categoria e a empresa associada.',
          'Marque como ativo e salve.',
        ],
        rules: [
          'SKU deve ser único por empresa. Produtos duplicados podem ser removidos em Gerenciamento de Dados → Remover SKUs Duplicados.',
          'Produtos inativos não aparecem em listas de seleção de pedidos e OPs.',
          'A alteração do preço de venda não afeta pedidos já criados.',
          'Produtos com BOM podem ter estrutura de componentes vinculada.',
        ],
        tips: [
          'Mantenha SKUs consistentes e significativos (ex: PRD-001, MP-001).',
          'Use o campo de observações para informações técnicas detalhadas.',
        ],
        faq: [
          { q: 'Como inativar um produto?', a: 'Na lista de produtos, encontre o produto e altere o campo "Ativo" para falso. Isso o remove das listas de seleção mas mantém o histórico.' },
          { q: 'Posso alterar o SKU de um produto após criação?', a: 'Sim, mas não é recomendado pois pode afetar rastreabilidade de movimentações anteriores.' },
        ]
      },
      {
        id: 'clientes',
        title: 'Cadastro de Clientes',
        description: 'Gerencie informações de clientes: contato, endereço e condições comerciais.',
        steps: [
          'Acesse Cadastros → Clientes.',
          'Clique em "Novo Cliente".',
          'Preencha: razão social, CNPJ/CPF, contato, endereço completo.',
          'Defina condições de pagamento padrão.',
          'Salve o cadastro.',
        ],
        rules: [
          'CNPJ/CPF deve ser único por empresa.',
          'O endereço é usado para cálculos de frete e expedição.',
          'Clientes inativos não aparecem para seleção em novos pedidos.',
        ],
        tips: ['Mantenha dados de contato sempre atualizados para comunicação eficiente.'],
        faq: [
          { q: 'Como vincular um pedido a um cliente?', a: 'Ao criar um Pedido de Venda, selecione o cliente no campo correspondente. O sistema traz automaticamente seus dados cadastrais.' },
        ]
      },
      {
        id: 'vendedores',
        title: 'Cadastro de Vendedores',
        description: 'Configure vendedores com dados de contato e comissão.',
        steps: [
          'Acesse Cadastros → Vendedores.',
          'Clique em "Novo Vendedor".',
          'Preencha: nome, email, telefone e taxa de comissão (%).',
          'Salve.',
        ],
        rules: [
          'A taxa de comissão é usada nos cálculos de relatórios de vendas.',
          'Vendedores podem ser associados a orçamentos e pedidos.',
        ],
        tips: [],
        faq: []
      },
      {
        id: 'armazens',
        title: 'Cadastro de Armazéns',
        description: 'Defina armazéns e suas localizações internas.',
        steps: [
          'Acesse Cadastros → Armazéns.',
          'Clique em "Novo Armazém".',
          'Preencha nome, código, endereço e empresa.',
          'Salve. Depois, configure as Localizações dentro dele.',
        ],
        rules: [
          'Cada armazém pertence a uma empresa.',
          'Armazéns devem ter localizações configuradas para permitir alocação de estoque.',
          'A movimentação de estoque sempre referencia um armazém de origem e/ou destino.',
        ],
        tips: ['Use nomeação consistente: Armazém Principal, Expedição, Produção, etc.'],
        faq: [
          { q: 'Como configurar as localizações dentro do armazém?', a: 'Acesse Cadastros → Localizações. Crie localizações seguindo a estrutura: Rua > Módulo > Nível > Posição. Cada localização pode ter um código de barras associado.' },
        ]
      },
      {
        id: 'localizacoes',
        title: 'Cadastro de Localizações',
        description: 'Configure localizações internas dos armazéns.',
        steps: [
          'Acesse Cadastros → Localizações.',
          'Selecione o armazém.',
          'Clique em "Nova Localização".',
          'Defina: Rua, Módulo, Nível, Posição e código de barras.',
          'Salve.',
        ],
        rules: [
          'Cada localização pertence a um armazém.',
          'O código de barras da localização é usado na alocação e separação.',
          'A estrutura é: Rua → Módulo → Nível → Posição.',
        ],
        tips: ['Use códigos escaneáveis para acelerar a operação no chão de fábrica.'],
        faq: []
      },
      {
        id: 'centrocustos',
        title: 'Centro de Custos',
        description: 'Organize custos em centros para análise financeira.',
        steps: ['Acesse Cadastros → Centro de Custos.', 'Crie centros como: Produção, Administrativo, Comercial, etc.', 'Associe movimentações e OPs a seus respectivos centros de custo.'],
        rules: ['Centros de custo ajudam na análise financeira por departamento.'],
        tips: [],
        faq: []
      },
      {
        id: 'condpagamento',
        title: 'Condições de Pagamento',
        description: 'Defina prazos e condições de pagamento para clientes.',
        steps: ['Acesse Cadastros → Condições de Pagamento.', 'Clique em "Nova Condição".', 'Defina: nome, prazo em dias, parcelamento.', 'Salve.'],
        rules: ['Condições de pagamento são associadas a pedidos de venda.', 'Podem ser configuradas como padrão para cada cliente.'],
        tips: [],
        faq: []
      },
    ]
  },
  {
    id: 'vendas',
    title: 'Vendas',
    icon: ShoppingCart,
    color: 'from-emerald-500 to-emerald-600',
    badge: 'Vendas',
    description: 'Orçamentos, pedidos, separação, expedição e remessas',
    routines: [
      {
        id: 'orcamentos',
        title: 'Orçamentos',
        description: 'Crie e gerencie orçamentos comerciais com múltiplos itens.',
        steps: [
          'Acesse Vendas → Orçamentos.',
          'Clique em "Novo Orçamento".',
          'Selecione o cliente e vendedor.',
          'Adicione itens: produto, quantidade, preço unitário e desconto.',
          'Cada item pode ter subitens para detalhamento.',
          'Anexe documentos (PDF, imagens) se necessário.',
          'Salve o orçamento. Ele pode ser convertido em Pedido de Venda.',
        ],
        rules: [
          'Orçamentos têm numeração automática.',
          'Cada item pode ter subitens para composição de preço.',
          'Documentos podem ser anexados ao orçamento.',
          'Orçamentos recentes geram notificações no painel.',
        ],
        tips: [
          'Use o campo de observações para anotar condições especiais negociadas.',
          'Converta orçamentos aprovados em pedidos rapidamente pelo sistema.',
        ],
        faq: [
          { q: 'Como converter um orçamento em pedido?', a: 'Abra o orçamento e clique no botão "Converter em Pedido". Todos os itens e dados do cliente serão copiados para o novo pedido.' },
        ]
      },
      {
        id: 'pedidos',
        title: 'Pedidos de Venda',
        description: 'Crie e gerencie pedidos com separação, reserva e rastreamento de entrega.',
        steps: [
          'Acesse Vendas → Pedidos.',
          'Clique em "Novo Pedido" ou converta de um orçamento.',
          'Selecione o cliente, vendedor e condição de pagamento.',
          'Defina o modo de atendimento: ESTOQUE ou PRODUÇÃO.',
          'Adicione itens com produto, quantidade e preço.',
          'Defina a data de entrega.',
          'Salve o pedido — status inicial: ABERTO.',
        ],
        rules: [
          'Modo ESTOQUE: itens são reservados e separados do estoque existente.',
          'Modo PRODUÇÃO: uma Ordem de Produção (OP) deve ser criada para fabricar os itens.',
          'Status do fluxo: Aberto → Reservado → Separado → Expedido → Entregue.',
          'Pedidos com entrega atrasada geram notificações CRÍTICAS.',
          'Pedidos com entrega no dia geram notificações de ALTA prioridade.',
          'Pedidos cancelados ou expedidos não geram alertas de atraso.',
        ],
        tips: [
          'Monitore o Dashboard para ver pedidos com entrega próxima.',
          'Use a data de entrega para gerar alertas automáticos de atraso.',
        ],
        faq: [
          { q: 'Qual a diferença entre ESTOQUE e PRODUÇÃO?', a: 'No modo ESTOQUE, os itens são separados do estoque disponível. No modo PRODUÇÃO, é necessário criar uma OP para fabricar antes de separar.' },
          { q: 'O que acontece se cancelar um pedido?', a: 'O pedido muda para CANCELADO e as reservas são liberadas. Se já houve separação, os itens devem ser devolvidos manualmente ao estoque.' },
          { q: 'Como saber se um pedido está atrasado?', a: 'Pedidos com data de entrega no passado e status diferente de EXPEDIDO ou CANCELADO aparecem com notificação CRÍTICA no painel.' },
        ]
      },
      {
        id: 'separacao',
        title: 'Separação de Pedido',
        description: 'Separe itens do estoque para atender pedidos de venda.',
        steps: [
          'Acesse Vendas → Separação.',
          'Selecione o pedido a ser separado.',
          'Para cada item, escaneie o código de barras ou selecione do estoque.',
          'Informe números de série quando aplicável.',
          'Confirme a separação — os saldos de estoque serão debitados.',
        ],
        rules: [
          'Só é possível separar itens que tenham saldo disponível.',
          'Itens com número de série obrigatório exigem leitura individual.',
          'A separação debita o estoque da localização de origem.',
          'Após separação completa, o pedido avança para status SEPARADO.',
        ],
        tips: ['Use leitor de código de barras para agilizar o processo no armazém.'],
        faq: [
          { q: 'Posso separar parcialmente?', a: 'Sim, você pode separar parte dos itens e continuar depois.' },
        ]
      },
      {
        id: 'expedicao',
        title: 'Expedição',
        description: 'Gerencie o envio de pedidos separados com nota fiscal e rastreamento.',
        steps: [
          'Acesse Vendas → Expedição.',
          'Selecione pedidos separados prontos para envio.',
          'Informe: transportadora, motorista, número do lote de envio.',
          'Gere etiquetas de expedição.',
          'O sistema permite expedição em lote (vários pedidos simultâneos).',
          'Confirme a expedição — o status do pedido muda para EXPEDIDO.',
        ],
        rules: [
          'Apenas pedidos com itens SEPARADOS podem ser expedidos.',
          'A expedição em lote permite enviar vários pedidos com a mesma transportadora e dados compartilhados.',
          'Cada expedição pode ter número de rastreamento.',
          'A expedição gera um campo shipping_batch_id para agrupar envios.',
        ],
        tips: [
          'Use a expedição em lote para enviar vários pedidos do mesmo cliente de uma vez.',
          'Verifique números de série antes de confirmar o envio.',
        ],
        faq: [
          { q: 'O que é expedição em lote?', a: 'Permite agrupar vários pedidos em um único envio, compartilhando dados de transportadora e motorista. Todos recebem o mesmo batch_id para rastreamento.' },
        ]
      },
      {
        id: 'remessas',
        title: 'Remessas e Retornos',
        description: 'Controle de remessas de itens para fora da empresa e seus retornos.',
        steps: [
          'Acesse Vendas → Remessas para enviar itens em remessa.',
          'Acesse Vendas → Retornos para registrar retornos.',
          'Cada remessa rastreia itens enviados versus recebidos de volta.',
        ],
        rules: [
          'Remessas podem ser de demonstração, empréstimo ou consignação.',
          'Retornos devem ser registrados com a condição do item.',
        ],
        tips: [],
        faq: []
      },
      {
        id: 'reservas',
        title: 'Reservas de Estoque',
        description: 'Reserve itens do estoque para pedidos ou projetos específicos.',
        steps: [
          'Acesse Vendas → Reservas.',
          'Selecione o produto e a quantidade a reservar.',
          'Vincule a um pedido ou projeto.',
          'Confirme a reserva — o saldo reservado é atualizado.',
        ],
        rules: [
          'Estoque reservado não está disponível para outras operações.',
          'A reserva reduz o saldo "disponível" mas não o saldo "total".',
          'Reservas são liberadas quando o pedido é separado, cancelado ou expirado.',
        ],
        tips: [],
        faq: [
          { q: 'Qual a diferença entre reservar e separar?', a: 'Reservar "trava" o estoque para um pedido sem movê-lo fisicamente. Separar retira o produto da localização para prepará-lo para envio.' },
        ]
      },
    ]
  },
  {
    id: 'estoque',
    title: 'Estoque',
    icon: Warehouse,
    color: 'from-amber-500 to-amber-600',
    badge: 'Estoque',
    description: 'Recebimentos, conferência, movimentações, inventário e Kardex',
    routines: [
      {
        id: 'solicitacoes-material',
        title: 'Solicitações de Material',
        description: 'Crie solicitações de compra de material que iniciam o fluxo de recebimento.',
        steps: [
          'Acesse Estoque → Solicitações.',
          'Clique em "Nova Solicitação".',
          'Adicione itens: produto, quantidade necessária, fornecedor.',
          'Defina urgência e data desejada.',
          'Salve — status inicial: ABERTA.',
          'Encaminhe ao fornecedor → status: ENVIADA AO FORNECEDOR.',
        ],
        rules: [
          'Status: Aberta → Enviada ao Fornecedor → Parcialmente Recebida → Recebida → Cancelada.',
          'Solicitações alimentam o processo de recebimento.',
          'Impressão de PDF disponível com layout profissional.',
        ],
        tips: ['Agrupe itens do mesmo fornecedor em uma única solicitação para otimizar logística.'],
        faq: [
          { q: 'Posso receber parcialmente?', a: 'Sim, o sistema suporta recebimento parcial. O status muda para PARCIALMENTE RECEBIDA até que todos os itens sejam recebidos.' },
        ]
      },
      {
        id: 'recebimento',
        title: 'Recebimentos',
        description: 'Registre a chegada de materiais e vincule a solicitações.',
        steps: [
          'Acesse Estoque → Recebimentos.',
          'Clique em "Novo Recebimento".',
          'Vincule a uma solicitação de material (opcional).',
          'Informe fornecedor, nota fiscal e itens recebidos.',
          'Salve o recebimento.',
          'Prossiga para a Conferência dos itens.',
        ],
        rules: [
          'Recebimentos podem ser vinculados ou avulsos.',
          'Cada item recebido deve ser conferido antes de ir ao estoque.',
        ],
        tips: ['Sempre registre o número da nota fiscal para rastreabilidade.'],
        faq: []
      },
      {
        id: 'conferencia',
        title: 'Conferência de Recebimento',
        description: 'Valide itens recebidos contra a solicitação e registre divergências.',
        steps: [
          'Acesse Estoque → Conferência.',
          'Selecione um recebimento pendente.',
          'Para cada item, confirme quantidade, qualidade e condição.',
          'Registre divergências (faltante, danificado, excedente).',
          'Aprove os itens conferidos → eles ficam disponíveis para alocação.',
        ],
        rules: [
          'Itens conferidos com divergência geram alerta.',
          'Apenas itens conferidos e aprovados podem ser alocados em localização.',
          'Status dos itens: PENDENTE → CONFERIDO → ALOCADO/ARMAZENADO.',
        ],
        tips: ['Faça a conferência logo após o recebimento para evitar acúmulo.'],
        faq: []
      },
      {
        id: 'alocacao',
        title: 'Alocação em Armazém',
        description: 'Aloque produtos conferidos em localizações específicas do armazém.',
        steps: [
          'Acesse Estoque → Alocação.',
          'Selecione itens conferidos pendentes de alocação.',
          'Escaneie ou selecione a localização de destino (Rua/Módulo/Nível/Posição).',
          'Confirme a alocação — o saldo de estoque é atualizado na localização.',
        ],
        rules: [
          'A alocação registra uma movimentação de ENTRADA no estoque.',
          'O saldo é atualizado na localização específica do armazém.',
          'Um produto pode estar em múltiplas localizações.',
        ],
        tips: ['Use layout de armazém lógico: materiais pesados no nível baixo, leves no alto.'],
        faq: [
          { q: 'Posso alocar o mesmo produto em localizações diferentes?', a: 'Sim, o sistema rastreia saldo por produto por localização. Você pode ter o mesmo produto em diversas localizações.' },
        ]
      },
      {
        id: 'inventario',
        title: 'Inventário',
        description: 'Execute contagens cíclicas ou gerais do estoque para identificar divergências.',
        steps: [
          'Acesse Estoque → Inventário.',
          'Clique em "Novo Inventário".',
          'Selecione o tipo: Geral, Cíclico, Por Localização ou Por Produto.',
          'Informe a contagem real de cada item/localização.',
          'O sistema calcula automaticamente as divergências.',
          'Aprove os ajustes — o estoque é corrigido automaticamente.',
        ],
        rules: [
          'Tipos: Geral (todos os itens), Cíclico (rotativo), Por Localização, Por Produto.',
          'Divergências positivas geram entrada, negativas geram saída de ajuste.',
          'Inventários geram movimentações do tipo AJUSTE no Kardex.',
        ],
        tips: ['Execute inventários cíclicos mensalmente para manter a acurácia do estoque.'],
        faq: []
      },
      {
        id: 'movimentacoes',
        title: 'Movimentações de Estoque',
        description: 'Registre transferências, ajustes, entradas e saídas manuais.',
        steps: [
          'Acesse Estoque → Movimentações.',
          'Clique em "Nova Movimentação".',
          'Selecione o tipo: ENTRADA, SAÍDA, AJUSTE, TRANSFERÊNCIA ou BAIXA.',
          'Informe produto, quantidade, armazém/localização de origem e destino.',
          'Adicione motivo/justificativa.',
          'Confirme — o saldo é atualizado automaticamente.',
        ],
        rules: [
          'Tipos: ENTRADA (aumenta saldo), SAÍDA (diminui saldo), AJUSTE (corrige), BAIXA (descarte).',
          'Movimentações recentes (últimas 48h) aparecem nas notificações.',
          'BAIXA gera notificação de prioridade MÉDIA.',
          'Toda movimentação é registrada no Kardex com data, quantidade e custo.',
        ],
        tips: ['Sempre registre o motivo da movimentação para auditoria futura.'],
        faq: [
          { q: 'Qual a diferença entre SAÍDA e BAIXA?', a: 'SAÍDA é a retirada normal (venda, consumo). BAIXA é o descarte do item (avaria, perda, vencimento) e gera alerta especial.' },
        ]
      },
      {
        id: 'saldos',
        title: 'Saldos de Estoque',
        description: 'Visualize disponibilidade por produto, armazém e localização.',
        steps: [
          'Acesse Estoque → Saldos.',
          'Use os filtros para buscar por produto, armazém ou categoria.',
          'Visualize: quantidade total, reservada, separada e disponível.',
        ],
        rules: [
          'Disponível = Total - Reservado - Separado.',
          'Saldos são atualizados em tempo real a cada movimentação.',
        ],
        tips: [],
        faq: []
      },
      {
        id: 'empenho',
        title: 'Empenho x Estoque',
        description: 'Compare a necessidade de materiais das OPs abertas com o estoque disponível.',
        steps: [
          'Acesse Estoque → Empenho x Estoque.',
          'O sistema cruza automaticamente os componentes das BOMs das OPs abertas com os saldos de estoque.',
          'Itens em falta são destacados em vermelho.',
        ],
        rules: [
          'Empenho é a soma de todos os componentes necessários para OPs em aberto.',
          'O cálculo considera apenas OPs com status ABERTA ou EM ANDAMENTO.',
        ],
        tips: ['Use este relatório para planejar compras e evitar parada de produção por falta de material.'],
        faq: []
      },
      {
        id: 'localizador',
        title: 'Localizador de Estoque',
        description: 'Busque rapidamente onde um produto está no armazém.',
        steps: [
          'Acesse Estoque → Localizador.',
          'Digite o SKU ou nome do produto.',
          'O sistema mostra todas as localizações onde o produto está e a quantidade em cada uma.',
        ],
        rules: [],
        tips: ['Útil para o time de separação localizar itens rapidamente.'],
        faq: []
      },
      {
        id: 'kardex',
        title: 'Kardex',
        description: 'Histórico completo de movimentações com custos médios.',
        steps: [
          'Acesse Estoque → Kardex.',
          'Filtre por produto, período ou tipo de movimentação.',
          'Visualize cada entrada/saída com data, quantidade, custo unitário e custo total.',
        ],
        rules: [
          'O Kardex registra todas as movimentações: entradas, saídas, ajustes, transferências, consumo de produção.',
          'O custo médio é recalculado a cada entrada.',
          'Movimentações de consumo de OP são registradas automaticamente.',
        ],
        tips: ['Use o Kardex para auditoria e rastreabilidade de custos.'],
        faq: []
      },
    ]
  },
  {
    id: 'producao',
    title: 'Produção',
    icon: Factory,
    color: 'from-orange-500 to-orange-600',
    badge: 'Producao',
    description: 'OPs, BOMs, roteiros, consumo e cronograma',
    routines: [
      {
        id: 'solicitacao-producao',
        title: 'Solicitações de Produção',
        description: 'Crie solicitações de produção baseadas em pedidos ou necessidade interna.',
        steps: [
          'Acesse Produção → Solicitações.',
          'Clique em "Nova Solicitação".',
          'Selecione o produto, quantidade e data desejada.',
          'Vincule a um pedido de venda se aplicável.',
          'Salve — status: PENDENTE.',
        ],
        rules: [
          'Status: PENDENTE → EM_PRODUÇÃO → CONCLUÍDA → CANCELADA.',
          'Solicitações com data de entrega no passado geram notificação CRÍTICA.',
          'Solicitações com vencimento no dia geram notificação de ALTA prioridade.',
        ],
        tips: [],
        faq: []
      },
      {
        id: 'ops',
        title: 'Ordens de Produção (OPs)',
        description: 'Crie e gerencie ordens de produção com etapas, consumo e rastreamento.',
        steps: [
          'Acesse Produção → Ordens (OPs).',
          'Clique em "Nova OP".',
          'Selecione o produto e quantidade a produzir.',
          'O sistema busca automaticamente a BOM e o roteiro de produção.',
          'Informe o número da OP TOTVS (externo) se aplicável.',
          'Salve — status: ABERTA. Etapas do cronograma são criadas automaticamente.',
          'Inicie a OP → status: EM ANDAMENTO. Execute as etapas na ordem.',
          'Ao concluir todas as etapas, encerre a OP → status: ENCERRADA.',
        ],
        rules: [
          'Status: ABERTA → EM_ANDAMENTO → PAUSADA → ENCERRADA / CANCELADA.',
          'OPs recém-criadas geram notificação informativa.',
          'OPs encerradas geram notificação de confirmação.',
          'Etapas atrasadas (com data final no passado) geram notificação CRÍTICA (>3 dias) ou ALTA (1-3 dias).',
          'OPs podem ser vinculadas hierarquicamente (OP pai → OP filho).',
          'Cada OP gera um QR Code para rastreamento no chão de fábrica.',
          'Ao CANCELAR uma OP, todos os itens consumidos retornam ao armazém padrão do sistema.',
          'Ao ENCERRAR uma OP, o sistema valida se há etapas pendentes e avisa o usuário.',
        ],
        tips: [
          'Use o QR Code impresso para rastreamento rápido.',
          'Vincule OPs pai-filho para sub-montagens.',
          'Monitore o Dashboard de Fábrica para ver OPs atrasadas.',
        ],
        faq: [
          { q: 'Como vincular uma OP como sub-operação de outra?', a: 'Na lista de OPs, clique no menu da OP e selecione "Vincular a OP Pai". Escolha a OP pai desejada.' },
          { q: 'O que acontece quando cancelo uma OP?', a: 'Todos os itens consumidos são devolvidos automaticamente ao armazém padrão (configurado em Parâmetros do Sistema) e as etapas de produção são excluídas.' },
          { q: 'Posso encerrar uma OP com etapas pendentes?', a: 'O sistema avisa sobre etapas não concluídas mas permite forçar o encerramento se necessário.' },
        ]
      },
      {
        id: 'separacao-bom',
        title: 'Separação de BOM',
        description: 'Separe componentes da lista de materiais para cada OP.',
        steps: [
          'Acesse Produção → Separação de BOM.',
          'Selecione a OP desejada.',
          'O sistema mostra todos os componentes necessários com quantidade baseada na BOM.',
          'Para cada componente, selecione a localização de origem e confirme.',
          'A separação debita o estoque e registra consumo na OP.',
        ],
        rules: [
          'A quantidade necessária é calculada: (quantidade BOM × quantidade OP).',
          'O sistema valida se há estoque disponível antes de permitir a separação.',
          'Itens separados são registrados como consumo na OP.',
        ],
        tips: ['Verifique o Empenho x Estoque antes de iniciar a separação para garantir disponibilidade de todos os componentes.'],
        faq: []
      },
      {
        id: 'consumo-op',
        title: 'Controle de Consumo',
        description: 'Registre consumo real de materiais durante a produção.',
        steps: [
          'Acesse Produção → Controle de Consumo.',
          'Selecione a OP.',
          'Registre a quantidade real consumida de cada componente.',
          'Informe perdas e motivos de divergência se houver.',
          'O sistema compara com a BOM para análise de conformidade.',
        ],
        rules: [
          'Consumo é registrado como movimentação de SAÍDA no estoque.',
          'Diferenças entre BOM e consumo real são rastreadas para análise.',
          'Reversão de consumo é possível via "Estornar Consumo".',
          'Cada consumo registra: produto, quantidade, armazém de origem, OP vinculada.',
        ],
        tips: ['Registre perdas e refugo para melhorar o planejamento futuro.'],
        faq: [
          { q: 'Posso estornar um consumo registrado?', a: 'Sim, use a função "Estornar Consumo" que reverte a movimentação e devolve o material ao estoque.' },
        ]
      },
      {
        id: 'bom',
        title: 'BOM (Lista de Materiais)',
        description: 'Estruture componentes e quantidades necessárias para cada produto.',
        steps: [
          'Acesse Produção → BOM.',
          'Selecione um produto ou crie uma nova BOM.',
          'Adicione componentes com SKU, quantidade e unidade.',
          'Defina roteiro de produção com etapas sequenciais.',
          'BOMs podem ter versões com datas de vigência.',
        ],
        rules: [
          'Cada produto pode ter múltiplas versões de BOM.',
          'A versão ativa (vigente) é usada ao criar novas OPs.',
          'Componentes podem ser matéria-prima ou semi-acabados com sub-BOMs.',
          'O roteiro de produção dentro da BOM define as etapas de fabricação do produto final.',
        ],
        tips: ['Atualize a BOM sempre que houver mudança de componentes ou processos.'],
        faq: [
          { q: 'Como criar uma nova versão da BOM?', a: 'Na página da BOM, clique em "Nova Versão". Defina a data de início de vigência. A versão anterior será automaticamente encerrada.' },
        ]
      },
      {
        id: 'roteiros',
        title: 'Roteiros de Produção',
        description: 'Defina a sequência de etapas de produção com recursos e tempos.',
        steps: [
          'Acesse Produção → Roteiros.',
          'Crie um roteiro vinculado a um produto.',
          'Adicione etapas em ordem sequencial.',
          'Para cada etapa: nome, recurso (máquina/centro), tempo estimado.',
          'As etapas são automaticamente criadas no cronograma da OP quando ela é aberta.',
        ],
        rules: [
          'Etapas incluem: início, execução e conclusão com timestamps.',
          'Recursos podem ser: máquinas, centros de trabalho ou operadores.',
          'O tempo estimado é usado no planejamento do cronograma.',
        ],
        tips: ['Importe roteiros em massa usando a função Importar Roteiros.'],
        faq: []
      },
      {
        id: 'cronograma',
        title: 'Cronograma de Produção',
        description: 'Visualize e planeje a sequência de produção.',
        steps: [
          'Acesse Produção → Cronograma.',
          'Visualize todas as OPs e suas etapas em linha do tempo.',
          'Identifique gargalos e atrasos.',
          'Clique em atividades atrasadas para ir diretamente à OP.',
        ],
        rules: [
          'O Dashboard de Fábrica mostra atividades atrasadas com link direto para o cronograma da OP.',
          'Etapas com status CONCLUÍDA ou PULADA não geram alertas.',
        ],
        tips: [],
        faq: []
      },
      {
        id: 'recursos',
        title: 'Recursos de Produção',
        description: 'Cadastre máquinas, centros de trabalho e operadores.',
        steps: [
          'Acesse Produção → Recursos.',
          'Crie recursos: Máquina, Centro de Trabalho ou Operador.',
          'Vincule recursos às etapas dos roteiros de produção.',
        ],
        rules: ['Recursos são referenciados nas etapas dos roteiros.'],
        tips: [],
        faq: []
      },
    ]
  },
  {
    id: 'posvendas',
    title: 'Pós-Vendas',
    icon: Cog,
    color: 'from-rose-500 to-rose-600',
    badge: 'PosVendas',
    description: 'Solicitações de serviço, ordens de serviço, técnicos e devoluções',
    routines: [
      {
        id: 'solicitacao-servico',
        title: 'Solicitações de Serviço',
        description: 'Registre solicitações de clientes para manutenção, instalação ou garantia.',
        steps: [
          'Acesse Pós-Vendas → Solicitações.',
          'Clique em "Nova Solicitação".',
          'Selecione o tipo: Instalação, Manutenção, Garantia, Reclamação ou Troca.',
          'Informe cliente, produto, número de série e descrição do problema.',
          'Salve — a solicitação pode ser convertida em Ordem de Serviço.',
        ],
        rules: [
          'Tipos: Instalação, Manutenção, Garantia, Reclamação, Troca.',
          'Solicitações são vinculadas a clientes e produtos.',
          'Números de série podem ser rastreados pelo módulo Controle de Séries.',
        ],
        tips: [],
        faq: []
      },
      {
        id: 'os',
        title: 'Ordens de Serviço (OS)',
        description: 'Crie e execute ordens de serviço com alocação de técnico.',
        steps: [
          'Acesse Pós-Vendas → Ordens de Serviço.',
          'Crie uma OS a partir de uma solicitação ou diretamente.',
          'Atribua o técnico responsável.',
          'Registre diagnóstico, peças utilizadas e mão de obra.',
          'Registre a solução aplicada.',
          'Ao concluir, registre avaliação de satisfação do cliente.',
          'Encerre a OS.',
        ],
        rules: [
          'Status: Pendente → Em Andamento → Pausada → Concluída → Cancelada.',
          'Controle de: horas de trabalho, custo de peças, custo de mão de obra.',
          'Avaliação de satisfação pode ser registrada ao final.',
          'OS gera relatório público (link compartilhável) para o cliente.',
        ],
        tips: ['Use o link público da OS para enviar relatório ao cliente sem precisar de login.'],
        faq: [
          { q: 'Como gerar relatório público da OS?', a: 'Cada OS tem um link público no formato /public/os/{id} que pode ser acessado pelo cliente sem login no sistema.' },
        ]
      },
      {
        id: 'agenda-servico',
        title: 'Agenda de Serviço',
        description: 'Planeje e visualize a agenda de técnicos.',
        steps: [
          'Acesse Pós-Vendas → Agenda.',
          'Visualize a agenda por técnico e data.',
          'Arraste e solte para reagendar.',
        ],
        rules: ['A agenda mostra apenas técnicos ativos.', 'Conflitos de horário são alertados.'],
        tips: [],
        faq: []
      },
      {
        id: 'devolucoes',
        title: 'Devoluções',
        description: 'Registre e gerencie devoluções de clientes.',
        steps: [
          'Acesse Pós-Vendas → Devoluções.',
          'Clique em "Nova Devolução".',
          'Informe: cliente, produto, motivo e condição do item.',
          'Analise e defina a resolução: Crédito, Reenvio, Reparo ou Rejeição.',
          'Execute a resolução e encerre.',
        ],
        rules: [
          'Resoluções possíveis: Crédito, Reenvio de produto novo, Reparo do existente ou Rejeição da devolução.',
          'Devoluções geram movimentação de ENTRADA se o item for aceito de volta no estoque.',
        ],
        tips: ['Documente sempre o motivo detalhado da devolução para análise de qualidade.'],
        faq: []
      },
      {
        id: 'series',
        title: 'Controle de Séries',
        description: 'Rastreie números de série de produtos vendidos.',
        steps: [
          'Acesse Pós-Vendas → Controle de Séries.',
          'Busque por número de série, cliente ou produto.',
          'Visualize histórico: venda, instalação, manutenções.',
        ],
        rules: [
          'Status de série: Estoque, Vendido, Instalado, Em Garantia, Fora de Garantia.',
          'Números de série são vinculados na separação do pedido.',
        ],
        tips: ['Use números de série para rastrear garantia e histórico do produto.'],
        faq: [
          { q: 'Como rastrear um produto vendido?', a: 'Busque pelo número de série no módulo Controle de Séries, ou pelo pedido original em Vendas → Pedidos.' },
        ]
      },
    ]
  },
  {
    id: 'qualidade',
    title: 'Qualidade',
    icon: AlertCircle,
    color: 'from-red-500 to-red-600',
    badge: 'Qualidade',
    description: 'Relatórios de não conformidade',
    routines: [
      {
        id: 'rnc',
        title: 'Relatórios de Não Conformidade (RNC)',
        description: 'Registre e gerencie ocorrências de não conformidade.',
        steps: [
          'Acesse Qualidade → Não Conformidades.',
          'Clique em "Novo RNC".',
          'Descreva a não conformidade: tipo, setor, produto afetado.',
          'Defina ação corretiva e responsável.',
          'Acompanhe a resolução até o fechamento.',
        ],
        rules: [
          'Cada RNC deve ter uma ação corretiva definida.',
          'RNCs podem ser vinculados a OPs, pedidos ou recebimentos.',
        ],
        tips: ['Use RNCs como base para melhoria contínua dos processos.'],
        faq: []
      }
    ]
  },
  {
    id: 'engenharia',
    title: 'Engenharia',
    icon: Cpu,
    color: 'from-teal-500 to-teal-600',
    badge: 'Engenharia',
    description: 'Projetos de engenharia, componentes e histórico',
    routines: [
      {
        id: 'projetos-eng',
        title: 'Projetos de Engenharia',
        description: 'Gerencie projetos de engenharia e desenvolvimento.',
        steps: [
          'Acesse Engenharia → Projetos.',
          'Crie um novo projeto com nome, descrição e responsável.',
          'Adicione componentes e documentos ao projeto.',
          'Acompanhe o progresso das etapas.',
        ],
        rules: ['Projetos podem ser vinculados a produtos e BOMs.'],
        tips: [],
        faq: []
      },
      {
        id: 'componentes-eng',
        title: 'Componentes de Engenharia',
        description: 'Cadastre e gerencie componentes com especificações técnicas.',
        steps: [
          'Acesse Engenharia → Componentes.',
          'Cadastre componentes com especificações técnicas detalhadas.',
          'Vincule a projetos e BOMs.',
        ],
        rules: ['O histórico de alterações de componentes é rastreado automaticamente.'],
        tips: [],
        faq: []
      },
    ]
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    icon: BarChart3,
    color: 'from-cyan-500 to-cyan-600',
    badge: 'Relatorios',
    description: 'Análises de estoque, vendas e itens pendentes',
    routines: [
      {
        id: 'relatorio-geral',
        title: 'Relatório Geral',
        description: 'Análises consolidadas de vendas, produção e estoque.',
        steps: ['Acesse Relatórios → Geral.', 'Selecione o período e filtros desejados.', 'Visualize gráficos e tabelas com métricas.', 'Exporte em PDF se necessário.'],
        rules: ['Relatórios são filtrados pela empresa selecionada.'],
        tips: [],
        faq: [{ q: 'Como exportar dados?', a: 'Use o módulo de Relatórios com os filtros desejados e clique no botão de exportação (PDF ou Excel quando disponível).' }]
      },
      {
        id: 'relatorio-estoque',
        title: 'Relatório de Estoque',
        description: 'Análise detalhada de posições de estoque e movimentações.',
        steps: ['Acesse Relatórios → Estoque.', 'Filtre por produto, armazém, período.', 'Visualize posição de estoque, giro e cobertura.'],
        rules: [],
        tips: [],
        faq: []
      },
      {
        id: 'itens-pendentes',
        title: 'Itens Pendentes',
        description: 'Lista de itens pendentes em vários estágios do processo.',
        steps: ['Acesse Relatórios → Itens Pendentes.', 'Visualize itens que estão pendentes de recebimento, separação ou expedição.'],
        rules: [],
        tips: ['Use este relatório diariamente para priorizar atividades.'],
        faq: []
      },
    ]
  },
  {
    id: 'admin',
    title: 'Administração',
    icon: Users,
    color: 'from-slate-600 to-slate-700',
    badge: 'Admin',
    description: 'Gestão de usuários, empresas e dados do sistema',
    routines: [
      {
        id: 'usuarios',
        title: 'Gestão de Usuários',
        description: 'Gerencie contas de usuários, permissões e aprovações.',
        steps: [
          'Acesse Gestão de Usuários (menu lateral).',
          'Visualize todos os usuários cadastrados.',
          'Para aprovar um novo usuário: clique em "Aprovar" e defina os módulos permitidos.',
          'Atribua as empresas que o usuário pode acessar.',
          'Defina se é técnico ou vendedor.',
          'Para bloquear: altere o status para REJEITADO ou desative.',
        ],
        rules: [
          'Novos auto-cadastros entram com status PENDENTE e precisam de aprovação.',
          'Apenas administradores podem aprovar, rejeitar ou alterar permissões.',
          'Módulos disponíveis: Cadastros, Vendas, Estoque, Producao, PosVendas, Qualidade, Engenharia, Relatorios, Agenda, DashboardFabrica.',
          'Técnicos só veem Agenda de Serviço e Ordens de Serviço no módulo Pós-Vendas.',
          'A role "admin" dá acesso total a todos os módulos.',
        ],
        tips: [
          'Sempre atribua pelo menos uma empresa ao novo usuário.',
          'Revise permissões periodicamente para manter a segurança.',
        ],
        faq: [
          { q: 'Um usuário novo está vendo "Aguardando Aprovação", por quê?', a: 'O usuário fez auto-cadastro e precisa que um administrador aprove seu acesso no Gestão de Usuários. Clique em "Aprovar", defina os módulos e empresas.' },
          { q: 'Como resetar a senha de um usuário?', a: 'No Gestão de Usuários, clique no menu do usuário e selecione "Reset de Senha". Defina a nova senha.' },
        ]
      },
      {
        id: 'empresas',
        title: 'Gestão de Empresas',
        description: 'Cadastre e gerencie as empresas/filiais do sistema.',
        steps: [
          'Acesse Empresas (menu lateral).',
          'Clique em "Nova Empresa".',
          'Preencha: nome, CNPJ, endereço e dados fiscais.',
          'Salve — a empresa fica disponível no seletor de empresa.',
        ],
        rules: [
          'Cada empresa tem seus próprios dados (estoque, pedidos, OPs, etc.).',
          'Usuários precisam ter a empresa na lista company_ids para acessá-la.',
          'Administradores podem acessar qualquer empresa.',
        ],
        tips: [],
        faq: []
      },
    ]
  },
  {
    id: 'fluxos',
    title: 'Fluxos do Sistema',
    icon: Zap,
    color: 'from-purple-500 to-purple-600',
    badge: null,
    description: 'Fluxos completos de processos e regras de negócio',
    routines: [
      {
        id: 'fluxo-vendas',
        title: 'Fluxo Completo de Vendas',
        description: 'Prospecção → Orçamento → Pedido → Separação → Expedição → Entrega',
        steps: [
          '1. PROSPECÇÃO: Vendedor registra visita a cliente potencial.',
          '2. ORÇAMENTO: Cria orçamento com produtos e preços negociados.',
          '3. PEDIDO: Converte orçamento aprovado em pedido de venda.',
          '4. Se modo PRODUÇÃO: Cria OP para fabricar os itens.',
          '5. RESERVA: Sistema reserva itens do estoque (se modo ESTOQUE).',
          '6. SEPARAÇÃO: Operador separa itens fisicamente do armazém.',
          '7. EXPEDIÇÃO: Embala, gera etiqueta e despacha com transportadora.',
          '8. ENTREGA: Confirma recebimento pelo cliente.',
        ],
        rules: [],
        tips: [],
        faq: []
      },
      {
        id: 'fluxo-producao',
        title: 'Fluxo Completo de Produção',
        description: 'Solicitação → OP → Separação BOM → Etapas → Consumo → Encerramento',
        steps: [
          '1. SOLICITAÇÃO: Pedido gera demanda de produção.',
          '2. OP: Cria-se a Ordem de Produção vinculada à BOM do produto.',
          '3. ETAPAS: Sistema cria cronograma baseado no roteiro da BOM.',
          '4. SEPARAÇÃO BOM: Componentes são separados do estoque.',
          '5. EXECUÇÃO: Etapas são iniciadas e concluídas sequencialmente.',
          '6. CONSUMO: Material é registrado como consumido.',
          '7. ENCERRAMENTO: OP é encerrada, produto acabado entra no estoque.',
        ],
        rules: ['Cancelamento de OP retorna materiais ao armazém padrão.', 'Encerramento verifica etapas pendentes.'],
        tips: [],
        faq: []
      },
      {
        id: 'fluxo-estoque-entrada',
        title: 'Fluxo de Entrada de Estoque',
        description: 'Solicitação → Recebimento → Conferência → Alocação',
        steps: [
          '1. SOLICITAÇÃO: Cria solicitação de compra com itens necessários.',
          '2. ENVIO: Encaminha ao fornecedor.',
          '3. RECEBIMENTO: Registra chegada do material na empresa.',
          '4. CONFERÊNCIA: Valida quantidade, qualidade e registra divergências.',
          '5. ALOCAÇÃO: Aloca itens conferidos em localização do armazém.',
          '6. SALDO: Estoque é atualizado automaticamente.',
        ],
        rules: [],
        tips: [],
        faq: []
      },
      {
        id: 'fluxo-posvendas',
        title: 'Fluxo de Pós-Vendas',
        description: 'Solicitação → OS → Agendamento → Execução → Satisfação',
        steps: [
          '1. SOLICITAÇÃO: Cliente solicita serviço.',
          '2. OS: Cria Ordem de Serviço a partir da solicitação.',
          '3. AGENDAMENTO: Atribui técnico e data.',
          '4. EXECUÇÃO: Técnico realiza o serviço.',
          '5. REGISTRO: Registra diagnóstico, peças e horas.',
          '6. SATISFAÇÃO: Cliente avalia o serviço.',
          '7. ENCERRAMENTO: OS é concluída.',
        ],
        rules: [],
        tips: [],
        faq: []
      },
    ]
  },
];

// ────────────────────────────────────────────────────────
// MOTOR DE BUSCA: busca inteligente em todo o conteúdo
// ────────────────────────────────────────────────────────

function searchKnowledgeBase(query) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const results = [];

  MODULES.forEach(mod => {
    mod.routines.forEach(routine => {
      let score = 0;
      const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      if (normalize(routine.title).includes(q)) score += 10;
      if (normalize(routine.description).includes(q)) score += 5;
      routine.steps.forEach(s => { if (normalize(s).includes(q)) score += 3; });
      routine.rules.forEach(r => { if (normalize(r).includes(q)) score += 3; });
      routine.tips.forEach(t => { if (normalize(t).includes(q)) score += 2; });
      routine.faq.forEach(f => {
        if (normalize(f.q).includes(q)) score += 8;
        if (normalize(f.a).includes(q)) score += 4;
      });

      if (score > 0) {
        results.push({ module: mod, routine, score });
      }
    });
  });

  return results.sort((a, b) => b.score - a.score);
}

// Responde perguntas baseado na base de conhecimento
function answerQuestion(question) {
  const results = searchKnowledgeBase(question);
  if (results.length === 0) {
    return {
      answer: 'Desculpe, não encontrei informações sobre esse tema no manual. Tente reformular a pergunta ou busque por palavras-chave como: pedido, OP, estoque, separação, expedição, BOM, etc.',
      sources: []
    };
  }

  const top = results[0];
  const routine = top.routine;
  const mod = top.module;

  let answer = `**${routine.title}** (Módulo: ${mod.title})\n\n`;
  answer += `${routine.description}\n\n`;

  if (routine.steps.length > 0) {
    answer += `**Como fazer:**\n`;
    routine.steps.forEach(s => { answer += `• ${s}\n`; });
    answer += '\n';
  }

  // Busca FAQ relevante
  const q = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const matchedFaq = routine.faq.find(f =>
    f.q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q) ||
    q.includes(f.q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ').slice(0, 3).join(' '))
  );

  if (matchedFaq) {
    answer += `**Resposta direta:** ${matchedFaq.a}\n\n`;
  }

  if (routine.rules.length > 0) {
    answer += `**Regras importantes:**\n`;
    routine.rules.slice(0, 3).forEach(r => { answer += `⚠️ ${r}\n`; });
  }

  return {
    answer,
    sources: results.slice(0, 3).map(r => ({ module: r.module.title, routine: r.routine.title }))
  };
}

// ────────────────────────────────────────────────────────
// COMPONENTES UI
// ────────────────────────────────────────────────────────

function RoutineContent({ routine }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{routine.title}</h2>
        <p className="text-slate-600 text-base leading-relaxed">{routine.description}</p>
      </div>

      {routine.steps.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-indigo-500" />
            Passo a Passo
          </h3>
          <ol className="space-y-3">
            {routine.steps.map((step, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                <span className="text-sm text-slate-700 leading-relaxed pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {routine.rules.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Regras do Sistema
          </h3>
          <ul className="space-y-2">
            {routine.rules.map((rule, i) => (
              <li key={i} className="text-sm text-amber-900 flex gap-2 items-start">
                <span className="text-amber-500 mt-1">▸</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {routine.tips.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Dicas
          </h3>
          <ul className="space-y-2">
            {routine.tips.map((tip, i) => (
              <li key={i} className="text-sm text-emerald-800 flex gap-2 items-start">
                <span className="text-emerald-500 mt-1">💡</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {routine.faq.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-indigo-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Perguntas Frequentes
          </h3>
          <div className="space-y-4">
            {routine.faq.map((item, i) => (
              <div key={i} className="bg-white rounded-lg p-4 border border-indigo-100">
                <p className="text-sm font-semibold text-indigo-900 mb-1">❓ {item.q}</p>
                <p className="text-sm text-slate-700">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Olá! Sou o assistente do ERP. Me pergunte como fazer qualquer rotina do sistema. Exemplos:\n\n• "Como criar um pedido de venda?"\n• "Como fazer uma OP?"\n• "O que acontece ao cancelar uma OP?"\n• "Como separar itens da BOM?"' }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    setTimeout(() => {
      const { answer, sources } = answerQuestion(userMsg);
      let response = answer;
      if (sources.length > 1) {
        response += '\n\n📚 **Veja também:** ' + sources.slice(1).map(s => `${s.module} → ${s.routine}`).join(' | ');
      }
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    }, 300);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-2xl shadow-indigo-300 flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
        title="Assistente do Manual"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[560px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Assistente do ERP</p>
            <p className="text-indigo-200 text-xs">Pergunte como fazer qualquer rotina</p>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-br-md'
                : 'bg-slate-100 text-slate-800 rounded-bl-md'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-200 flex-shrink-0">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Pergunte algo sobre o sistema..."
            className="flex-1 h-10 text-sm"
          />
          <Button type="submit" size="icon" className="h-10 w-10 bg-indigo-600 hover:bg-indigo-700 flex-shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ────────────────────────────────────────────────────────

export default function Manual() {
  const [selectedModule, setSelectedModule] = useState('intro');
  const [selectedRoutine, setSelectedRoutine] = useState('visao-geral');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedModules, setExpandedModules] = useState({ intro: true });
  const [searchResults, setSearchResults] = useState([]);

  const currentModule = MODULES.find(m => m.id === selectedModule);
  const currentRoutine = useMemo(() => {
    for (const mod of MODULES) {
      const found = mod.routines.find(r => r.id === selectedRoutine);
      if (found) return found;
    }
    return null;
  }, [selectedRoutine]);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      setSearchResults(searchKnowledgeBase(searchTerm));
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  const toggleModule = (id) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectRoutine = (modId, routineId) => {
    setSelectedModule(modId);
    setSelectedRoutine(routineId);
    setExpandedModules(prev => ({ ...prev, [modId]: true }));
    setSearchTerm('');
    setSearchResults([]);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex gap-0 max-w-[1400px] mx-auto">

        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-white min-h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Book className="h-5 w-5 text-indigo-600" />
              <h1 className="text-lg font-bold text-slate-900">Manual do ERP</h1>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar rotina, processo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm bg-slate-50"
              />
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="p-3 border-b border-slate-200 bg-indigo-50">
              <p className="text-xs font-semibold text-indigo-700 mb-2">{searchResults.length} resultado(s) encontrado(s)</p>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {searchResults.slice(0, 10).map((r, i) => (
                  <button
                    key={i}
                    onClick={() => selectRoutine(r.module.id, r.routine.id)}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-indigo-100 transition-all"
                  >
                    <p className="font-medium text-indigo-900 truncate">{r.routine.title}</p>
                    <p className="text-indigo-600 truncate">{r.module.title}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Module list */}
          <nav className="p-2 space-y-0.5">
            {MODULES.map(mod => {
              const Icon = mod.icon;
              const isExpanded = expandedModules[mod.id];
              const isActive = selectedModule === mod.id;

              return (
                <div key={mod.id}>
                  <button
                    onClick={() => {
                      toggleModule(mod.id);
                      if (mod.routines.length === 1) {
                        selectRoutine(mod.id, mod.routines[0].id);
                      }
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-2.5 group ${
                      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${mod.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="font-medium truncate flex-1">{mod.title}</span>
                    {mod.routines.length > 1 && (
                      <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    )}
                  </button>

                  {isExpanded && mod.routines.length > 1 && (
                    <div className="ml-5 pl-4 border-l border-slate-200 mt-1 mb-2 space-y-0.5">
                      {mod.routines.map(routine => (
                        <button
                          key={routine.id}
                          onClick={() => selectRoutine(mod.id, routine.id)}
                          className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-all ${
                            selectedRoutine === routine.id
                              ? 'bg-indigo-100 text-indigo-800 font-medium'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                          }`}
                        >
                          {routine.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 p-8">
          {/* Breadcrumb */}
          {currentModule && currentRoutine && (
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
              <Book className="h-4 w-4" />
              <span>Manual</span>
              <ChevronRight className="h-3 w-3" />
              <span>{currentModule.title}</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-indigo-600 font-medium">{currentRoutine.title}</span>
            </div>
          )}

          {/* Module badge */}
          {currentModule && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${currentModule.color} flex items-center justify-center`}>
                  {React.createElement(currentModule.icon, { className: 'h-5 w-5 text-white' })}
                </div>
                {currentModule.badge && (
                  <Badge variant="outline" className="text-xs text-slate-500">Módulo: {currentModule.badge}</Badge>
                )}
              </div>
            </div>
          )}

          {/* Routine content */}
          <Card className="border-slate-200">
            <CardContent className="p-8">
              {currentRoutine ? (
                <RoutineContent routine={currentRoutine} />
              ) : (
                <p className="text-slate-500">Selecione uma rotina no menu lateral.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Chat Assistant */}
      <ChatAssistant />
    </div>
  );
}