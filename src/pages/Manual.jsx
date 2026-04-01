import React, { useState } from 'react';
import { ChevronDown, FileText, Menu, Search, Home, Book } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const MANUAL_SECTIONS = [
  {
    id: 'intro',
    title: 'Introdução',
    icon: Home,
    content: `
      <h2>Bem-vindo ao AGFSig ERP</h2>
      <p>Este é um sistema de gestão empresarial completo desenvolvido para gerenciar todas as operações da sua empresa.</p>
      
      <h3>Módulos Principais</h3>
      <ul>
        <li><strong>Cadastros:</strong> Gerenciar produtos, clientes, vendedores, armazéns e configurações</li>
        <li><strong>Vendas:</strong> Prospecção, orçamentos, pedidos, separação e expedição</li>
        <li><strong>Estoque:</strong> Recebimentos, conferência, alocação, inventário e movimentações</li>
        <li><strong>Produção:</strong> Ordens de produção, BOMs, roteiros e controle de consumo</li>
        <li><strong>Pós-Vendas:</strong> Solicitações de serviço, ordens de serviço e devoluções</li>
        <li><strong>Qualidade:</strong> Relatórios de não conformidade</li>
        <li><strong>Relatórios:</strong> Análise de estoque e vendas</li>
      </ul>
    `
  },
  {
    id: 'cadastros',
    title: 'Módulo de Cadastros',
    icon: FileText,
    content: `
      <h2>Cadastros</h2>
      <p>Este módulo contém todos os dados mestres da sua empresa.</p>
      
      <h3>Produtos</h3>
      <p>Cadastre produtos com SKU, descrição, preço de custo e preço de venda. Você pode marcar produtos como ativos ou inativos.</p>
      
      <h3>Clientes</h3>
      <p>Gerencie informações de clientes incluindo dados de contato, endereço e condições comerciais.</p>
      
      <h3>Vendedores</h3>
      <p>Configure vendedores com nome, email, telefone e taxa de comissão.</p>
      
      <h3>Armazéns</h3>
      <p>Defina os armazéns da sua empresa. Cada armazém pode ter múltiplas localizações.</p>
      
      <h3>Localizações</h3>
      <p>Configure as localizações dentro dos armazéns usando código de barras. Estrutura: Rua > Módulo > Nível > Posição.</p>
      
      <h3>Centro de Custos</h3>
      <p>Organize custos da empresa em diferentes centros para análise financeira.</p>
      
      <h3>Condições de Pagamento</h3>
      <p>Defina prazos e condições de pagamento para os clientes.</p>
    `
  },
  {
    id: 'vendas',
    title: 'Módulo de Vendas',
    icon: FileText,
    content: `
      <h2>Vendas</h2>
      
      <h3>Prospecção</h3>
      <p>Registre visitas de prospection a clientes potenciais. Defina tipo de visita (Prospection, Follow-up, Fechamento), resultado e próximas ações.</p>
      
      <h3>Registro de KM</h3>
      <p>Controle diário de quilometragem de veículos da empresa.</p>
      
      <h3>Orçamentos</h3>
      <p>Crie orçamentos com múltiplos itens. Cada item pode ter subitens. Você pode anexar documentos ao orçamento.</p>
      
      <h3>Pedidos de Venda</h3>
      <p>Crie pedidos com modo de atendimento (Estoque ou Produção). Controle de quantidade reservada e separada.</p>
      <p><strong>Status:</strong> Aberto, Reservado, Separado, Enviado, Entregue, Cancelado</p>
      
      <h3>Separação</h3>
      <p>Separe itens dos pedidos do estoque. Controle de código de barras e números de série.</p>
      
      <h3>Expedição</h3>
      <p>Gere notas fiscais e rótulos de expedição. Controle de rastreamento e datas de envio.</p>
      
      <h3>Reservas</h3>
      <p>Reserve itens do estoque para pedidos ou projetos específicos.</p>
    `
  },
  {
    id: 'estoque',
    title: 'Módulo de Estoque',
    icon: FileText,
    content: `
      <h2>Estoque</h2>
      
      <h3>Solicitações de Material</h3>
      <p>Crie solicitações de compra que alimentam o processo de recebimento.</p>
      <p><strong>Status:</strong> Aberta, Enviada ao Fornecedor, Parcialmente Recebida, Recebida, Cancelada</p>
      
      <h3>Recebimentos</h3>
      <p>Registre recebimentos de fornecedores. Sistema integrado com solicitações de material.</p>
      
      <h3>Conferência de Recebimento</h3>
      <p>Valide itens recebidos contra a solicitação. Registre divergências e danos.</p>
      
      <h3>Alocação de Armazém</h3>
      <p>Aloque produtos para localizações específicas no armazém baseado em código de barras.</p>
      
      <h3>Inventário</h3>
      <p>Execute contagens cíclicas ou gerais do estoque. Identifique divergências automáticamente.</p>
      <p><strong>Tipos:</strong> Geral, Cíclico, Por Localização, Por Produto</p>
      
      <h3>Movimentações de Estoque</h3>
      <p>Registre transferências entre armazéns e ajustes de quantidade.</p>
      
      <h3>Saldos de Estoque</h3>
      <p>Visualize disponibilidade por produto, armazém e localização. Controle de quantidade reservada e separada.</p>
      
      <h3>Localizador de Estoque</h3>
      <p>Busque rapidamente onde um produto está localizado no armazém.</p>
      
      <h3>Kardex</h3>
      <p>Histórico completo de movimentações de cada produto com custos médios.</p>
    `
  },
  {
    id: 'producao',
    title: 'Módulo de Produção',
    icon: FileText,
    content: `
      <h2>Produção</h2>
      
      <h3>Solicitações de Produção</h3>
      <p>Crie solicitações de produção baseadas em pedidos de venda ou necessidade interna.</p>
      
      <h3>Ordens de Produção (OPs)</h3>
      <p>Crie ordens de produção com número TOTVS. O sistema automaticamente gera etapas baseadas no roteiro do produto.</p>
      <p><strong>Status:</strong> Aberta, Em Andamento, Pausada, Encerrada, Cancelada</p>
      <p><strong>Funcionalidades:</strong> Vincular OPs pai-filho, QR Code, controle de progresso</p>
      
      <h3>Separação de BOM</h3>
      <p>Separe componentes da BOM para cada OP. Sistema integrado com estoque.</p>
      
      <h3>Controle de Consumo</h3>
      <p>Registre consumo real de materiais durante a produção. Controle de perdas e conformidade.</p>
      
      <h3>Roteiros de Produção</h3>
      <p>Defina sequência de etapas de produção com recursos (máquinas, operadores, centros de trabalho) e tempos estimados.</p>
      
      <h3>BOMs (Bill of Materials)</h3>
      <p>Estruture componentes e quantidades necessárias para cada produto. Suporta múltiplas versões com datas de vigência.</p>
      
      <h3>Recursos de Produção</h3>
      <p>Cadastre máquinas, centros de trabalho e operadores.</p>
      
      <h3>Simulação de Produção</h3>
      <p>Simule cenários de produção considerando capacidade e recursos disponíveis.</p>
      
      <h3>Cronograma de Produção</h3>
      <p>Visualize e planeje a sequência de produção baseado em datas e prioridades.</p>
    `
  },
  {
    id: 'posvenda',
    title: 'Módulo de Pós-Vendas',
    icon: FileText,
    content: `
      <h2>Pós-Vendas</h2>
      
      <h3>Solicitações de Serviço</h3>
      <p>Registre solicitações de clientes para instalação, manutenção, garantia ou reclamações.</p>
      <p><strong>Tipos:</strong> Instalação, Manutenção, Garantia, Reclamação, Troca</p>
      
      <h3>Ordens de Serviço</h3>
      <p>Crie ordens de serviço a partir de solicitações. Aloque técnico, registre diagnóstico e solução aplicada.</p>
      <p><strong>Status:</strong> Pendente, Em Andamento, Pausada, Concluída, Cancelada</p>
      <p><strong>Controle:</strong> Horas de trabalho, custo de peças, custo de mão de obra, avaliação de satisfação</p>
      
      <h3>Agenda de Serviço</h3>
      <p>Visualize agenda de técnicos e planeje visitas de serviço.</p>
      
      <h3>Técnicos</h3>
      <p>Cadastre técnicos com especialidades. Controle de histórico de serviços por técnico.</p>
      
      <h3>Devoluções</h3>
      <p>Registre devoluções de clientes com motivo e condição do produto.</p>
      <p><strong>Resoluções:</strong> Crédito, Reenvio, Reparo, Rejeição</p>
      
      <h3>Controle de Séries</h3>
      <p>Rastreie números de série de produtos vendidos. Controle de garantia e status.</p>
      <p><strong>Status:</strong> Estoque, Vendido, Instalado, Em Garantia, Fora de Garantia</p>
      
      <h3>Relatórios de Serviço</h3>
      <p>Análise de serviços realizados, técnicos, custos e satisfação de clientes.</p>
    `
  },
  {
    id: 'configuracao',
    title: 'Configurações do Sistema',
    icon: FileText,
    content: `
      <h2>Configurações do Sistema</h2>
      
      <h3>Parâmetros Globais</h3>
      <p>Defina configurações que afetam todo o sistema. Organize por categoria:</p>
      <ul>
        <li><strong>Vendas:</strong> Prazos, políticas, descontos</li>
        <li><strong>Produção:</strong> Tempos padrão, capacidades</li>
        <li><strong>Estoque:</strong> Quantidades mínimas, pontos de reposição</li>
        <li><strong>Serviço:</strong> Prazos de resposta, custos de mão de obra</li>
        <li><strong>Geral:</strong> Configurações diversas</li>
      </ul>
      
      <h3>Testes de Configuração</h3>
      <p>Crie testes para validar configurações antes de aplicá-las em produção.</p>
      <p><strong>Tipos de Teste:</strong></p>
      <ul>
        <li>Validação de Tipo (string, number, boolean)</li>
        <li>Validação de Intervalo (min/max)</li>
        <li>Validação de Padrão (regex)</li>
        <li>Regra de Negócio (validação customizada)</li>
      </ul>
      <p>Suporte a auto-apply: testes que passam podem aplicar configurações automaticamente.</p>
      
      <h3>Histórico de Configuração</h3>
      <p>Acompanhe todas as mudanças de configuração com registro de quem mudou, quando e por quê.</p>
      <p><strong>Funcionalidades:</strong> Rollback para versão anterior, auditoria completa</p>
    `
  },
  {
    id: 'fluxos',
    title: 'Fluxos Principais',
    icon: FileText,
    content: `
      <h2>Fluxos Principais do Sistema</h2>
      
      <h3>Fluxo de Vendas</h3>
      <p>1. Prospecção (Visita) → 2. Orçamento → 3. Pedido de Venda → 4. Separação → 5. Expedição → 6. Entrega</p>
      
      <h3>Fluxo de Produção</h3>
      <p>1. Pedido de Venda (modo PRODUÇÃO) → 2. OP de Produção → 3. Separação de BOM → 4. Execução com Etapas → 5. Controle de Consumo → 6. Encerramento</p>
      
      <h3>Fluxo de Estoque de Entrada</h3>
      <p>1. Solicitação de Material → 2. Recebimento → 3. Conferência → 4. Alocação em Localização → 5. Atualização de Saldo</p>
      
      <h3>Fluxo de Estoque de Saída</h3>
      <p>1. Pedido (modo ESTOQUE) → 2. Reserva → 3. Separação → 4. Expedição → 5. Atualização de Saldo</p>
      
      <h3>Fluxo de Pós-Vendas</h3>
      <p>1. Solicitação de Serviço → 2. Ordem de Serviço → 3. Agendamento → 4. Execução → 5. Registro de Satisfação → 6. Encerramento</p>
      
      <h3>Fluxo de Devolução</h3>
      <p>1. Solicitação de Devolução → 2. Recebimento → 3. Análise de Condição → 4. Aprovação → 5. Resolução (Crédito/Reenvio/Reparo) → 6. Encerramento</p>
      
      <h3>Fluxo de OP Cancelada</h3>
      <p><strong>Regra Implementada:</strong> Quando uma OP é cancelada, todos os itens consumidos retornam para o armazém configurado no sistema (definido em Configurações).</p>
    `
  },
  {
    id: 'dicas',
    title: 'Dicas e Boas Práticas',
    icon: FileText,
    content: `
      <h2>Dicas e Boas Práticas</h2>
      
      <h3>Segurança de Dados</h3>
      <ul>
        <li>Sempre faça backup das configurações antes de mudanças importantes</li>
        <li>Use o histórico de configuração para rastrear mudanças</li>
        <li>Teste novos parâmetros antes de aplicar em produção</li>
        <li>Revise relatórios regularmente para identificar anomalias</li>
      </ul>
      
      <h3>Eficiência Operacional</h3>
      <ul>
        <li>Use códigos de barras para acelerar movimentações de estoque</li>
        <li>Configure localizações lógicas (próximas por tipo de produto)</li>
        <li>Mantenha estoques mínimos ajustados baseado em histórico</li>
        <li>Execute inventários cíclicos regularmente</li>
        <li>Use QR Codes para rastrear OPs em tempo real</li>
      </ul>
      
      <h3>Organização de Dados</h3>
      <ul>
        <li>Mantenha SKUs consistentes e significativos</li>
        <li>Atualize dados mestres regularmente (preços, contatos)</li>
        <li>Documente customizações e regras especiais</li>
        <li>Use centros de custos para análise financeira</li>
      </ul>
      
      <h3>Rastreabilidade</h3>
      <ul>
        <li>Use números de série para produtos com rastreamento</li>
        <li>Registre todos os movimentos de estoque</li>
        <li>Mantenha histórico de técnicos em serviços</li>
        <li>Documente motivos de devoluções e reclamações</li>
      </ul>
    `
  },
  {
    id: 'support',
    title: 'Suporte e Ajuda',
    icon: FileText,
    content: `
      <h2>Suporte e Ajuda</h2>
      
      <h3>Funcionalidades Disponíveis</h3>
      <ul>
        <li>Busca global no sistema (atalho de busca no topo)</li>
        <li>Seletor de empresa (múltiplas empresas/filiais)</li>
        <li>Painel de notificações com eventos importantes</li>
        <li>Dashboard com KPIs em tempo real</li>
      </ul>
      
      <h3>Navegação</h3>
      <ul>
        <li>Menu lateral organizado por módulos</li>
        <li>Links rápidos entre formulários relacionados</li>
        <li>Breadcrumb de localização na página</li>
        <li>Voltar automático após ações</li>
      </ul>
      
      <h3>Validações</h3>
      <ul>
        <li>Campos obrigatórios são claramente marcados</li>
        <li>Mensagens de erro explicam o problema</li>
        <li>Confirmação para ações críticas</li>
        <li>Validação automática de dados</li>
      </ul>
      
      <h3>Dúvidas Frequentes</h3>
      
      <p><strong>P: Como vincular uma OP como sub-operação de outra?</strong></p>
      <p>R: Na lista de OPs, clique no menu da OP e selecione "Vincular a OP Pai". Escolha a OP pai desejada.</p>
      
      <p><strong>P: Como restaurar uma configuração anterior?</strong></p>
      <p>R: Acesse Histórico de Configuração, encontre a versão desejada e clique em "Restaurar".</p>
      
      <p><strong>P: O que acontece quando cancelo uma OP?</strong></p>
      <p>R: Todos os itens consumidos retornam para o armazém padrão configurado no sistema e as etapas de produção são deletadas.</p>
      
      <p><strong>P: Como exportar dados para relatório?</strong></p>
      <p>R: Use o módulo de Relatórios. Você pode filtrar por período, produto, cliente ou vendedor.</p>
      
      <p><strong>P: Como rastrear um produto vendido?</strong></p>
      <p>R: Use o número de série no módulo Controle de Séries, ou busque pelo pedido original no módulo de Vendas.</p>
    `
  }
];

export default function Manual() {
  const [selectedSection, setSelectedSection] = useState('intro');
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const filteredSections = MANUAL_SECTIONS.filter(section =>
    section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    section.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentSection = MANUAL_SECTIONS.find(s => s.id === selectedSection);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex gap-6 p-6 max-w-7xl mx-auto">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 flex-shrink-0`}>
          <Card className="sticky top-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Manual do ERP</CardTitle>
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              
              <nav className="space-y-1 max-h-[600px] overflow-y-auto">
                {filteredSections.map(section => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => {
                        setSelectedSection(section.id);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                        selectedSection === section.id
                          ? 'bg-indigo-50 text-indigo-700 font-medium'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{section.title}</span>
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {currentSection && (
            <Card>
              <CardContent className="p-8">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: currentSection.content }}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}