import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertCircle, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DeleteCompanyData() {
  const [companyCode, setCompanyCode] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [deletionLog, setDeletionLog] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: companies = [] } = useQuery({
    queryKey: ['companies-list'],
    queryFn: () => base44.entities.Company.list(),
  });

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);
  const isCurrentCompany = selectedCompanyId === user?.company_id;

  const handleSearchCompany = () => {
    const company = companies.find(c => c.code === companyCode);
    if (company) {
      if (company.id === user?.company_id) {
        toast.error('Você não pode deletar a empresa que está usando no momento');
        return;
      }
      setSelectedCompanyId(company.id);
      setIsConfirmed(false);
    } else {
      toast.error('Empresa não encontrada');
      setSelectedCompanyId(null);
    }
  };

  const deletionOperations = [
    { entity: 'OPConsumptionControl', name: 'Controles de Consumo' },
    { entity: 'ProductionStep', name: 'Etapas de Produção' },
    { entity: 'BOMDeliveryControl', name: 'Controles de Entrega de BOM' },
    { entity: 'BOMItem', name: 'Itens de BOM' },
    { entity: 'BOMVersion', name: 'Versões de BOM' },
    { entity: 'BOM', name: 'BOMs' },
    { entity: 'ProductionOrder', name: 'Ordens de Produção' },
    { entity: 'MaterialRequestItem', name: 'Itens de Solicitação' },
    { entity: 'MaterialRequest', name: 'Solicitações de Material' },
    { entity: 'ReceivingItem', name: 'Itens de Recebimento' },
    { entity: 'NonConformityReport', name: 'Relatórios de Não Conformidade' },
    { entity: 'ReceivingBatch', name: 'Lotes de Recebimento' },
    { entity: 'InventoryMove', name: 'Movimentações de Inventário' },
    { entity: 'StockBalance', name: 'Saldos de Estoque' },
    { entity: 'Reservation', name: 'Reservas' },
    { entity: 'SalesOrderItem', name: 'Itens de Pedido' },
    { entity: 'SalesOrder', name: 'Pedidos de Venda' },
    { entity: 'QuoteItem', name: 'Itens de Orçamento' },
    { entity: 'QuoteAttachment', name: 'Anexos de Orçamento' },
    { entity: 'Quote', name: 'Orçamentos' },
    { entity: 'Location', name: 'Localizações' },
    { entity: 'Warehouse', name: 'Armazéns' },
    { entity: 'Client', name: 'Clientes' },
    { entity: 'Product', name: 'Produtos' },
  ];

  const handleDeleteAllData = async () => {
    if (!selectedCompanyId || !isConfirmed) {
      toast.error('Selecione a empresa e confirme a operação');
      return;
    }

    setIsDeleting(true);
    setDeletionLog([]);

    try {
      for (const operation of deletionOperations) {
        try {
          const records = await base44.entities[operation.entity].filter({
            company_id: selectedCompanyId
          });
          
          for (const record of records) {
            await base44.entities[operation.entity].delete(record.id);
          }

          const message = `✓ ${operation.name}: ${records.length} registros deletados`;
          setDeletionLog(prev => [...prev, message]);
          toast.success(message);
        } catch (e) {
          const message = `✗ ${operation.name}: Erro ao deletar`;
          setDeletionLog(prev => [...prev, message]);
          console.error(message, e);
        }
      }

      setDeletionLog(prev => [...prev, '✓ Operação concluída com sucesso']);
      toast.success('Todos os dados foram deletados');
      setIsConfirmed(false);
      setCompanyCode('');
      setSelectedCompanyId(null);
    } catch (e) {
      toast.error('Erro ao deletar dados');
      console.error('Erro ao deletar dados:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="border-red-200">
        <CardHeader className="bg-red-50 border-b border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <CardTitle className="text-red-700">Deletar Dados de Empresa</CardTitle>
              <CardDescription className="text-red-600 mt-1">
                ⚠️ Esta ação é irreversível. Todos os dados da empresa selecionada serão permanentemente removidos.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Busca de empresa */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Código da Empresa</label>
              <div className="flex gap-2">
                <Input
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value)}
                  placeholder="Ex: 0101"
                  disabled={isDeleting}
                />
                <Button
                  onClick={handleSearchCompany}
                  disabled={!companyCode || isDeleting}
                  variant="outline"
                >
                  Buscar
                </Button>
              </div>
            </div>

            {/* Confirmação */}
            {selectedCompany && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-900">Empresa selecionada:</p>
                  <p className="text-lg font-bold text-red-700 mt-2">
                    {selectedCompany.code} - {selectedCompany.name}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="confirm-delete"
                    checked={isConfirmed}
                    onChange={(e) => setIsConfirmed(e.target.checked)}
                    disabled={isDeleting}
                    className="rounded"
                  />
                  <label htmlFor="confirm-delete" className="text-sm text-slate-700">
                    Confirmo que desejo deletar todos os dados desta empresa
                  </label>
                </div>

                <Button
                  onClick={handleDeleteAllData}
                  disabled={!isConfirmed || isDeleting || isCurrentCompany}
                  variant="destructive"
                  className="w-full gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deletando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Deletar Todos os Dados
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Log de deleção */}
            {deletionLog.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Log da operação:</p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                  {deletionLog.map((log, idx) => (
                    <p key={idx} className="text-xs font-mono text-slate-700 py-1">
                      {log}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}