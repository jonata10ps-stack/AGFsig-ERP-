import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertCircle, Database, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function RestoreCompanyData() {
  const [companyCode, setCompanyCode] = useState('0000');
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restorationLog, setRestorationLog] = useState([]);

  const { data: companies = [] } = useQuery({
    queryKey: ['companies-list'],
    queryFn: () => base44.entities.Company.list(),
  });

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  const handleSearchCompany = () => {
    const company = companies.find(c => c.code === companyCode);
    if (company) {
      setSelectedCompanyId(company.id);
      setRestorationLog([]);
    } else {
      toast.error('Empresa não encontrada');
      setSelectedCompanyId(null);
    }
  };

  const entitiesToRestore = [
    'Product',
    'Client',
    'Warehouse',
    'Location',
    'Quote',
    'QuoteItem',
    'SalesOrder',
    'SalesOrderItem',
    'MaterialRequest',
    'MaterialRequestItem',
    'ProductionRequest',
    'ProductionOrder',
    'BOM',
    'BOMVersion',
    'BOMItem',
    'StockBalance',
    'InventoryMove',
    'ReceivingBatch',
    'ReceivingItem',
    'Reservation',
    'NonConformityReport',
    'BOMDeliveryControl',
    'OPConsumptionControl',
  ];

  const handleRestoreData = async () => {
    if (!selectedCompanyId) {
      toast.error('Selecione a empresa');
      return;
    }

    setIsRestoring(true);
    setRestorationLog([]);

    try {
      for (const entity of entitiesToRestore) {
        try {
          // Buscar registros SEM company_id
          const allRecords = await base44.entities[entity].list();
          const recordsWithoutCompanyId = allRecords.filter(
            r => !r.company_id || r.company_id === '' || r.company_id === null
          );

          if (recordsWithoutCompanyId.length === 0) {
            const msg = `${entity}: nenhum registro para restaurar`;
            setRestorationLog(prev => [...prev, msg]);
            continue;
          }

          // Atualizar cada registro com o company_id
          let updatedCount = 0;
          for (const record of recordsWithoutCompanyId) {
            try {
              await base44.entities[entity].update(record.id, { 
                company_id: selectedCompanyId 
              });
              updatedCount++;
            } catch (e) {
              console.error(`Erro ao atualizar ${entity}:`, e);
            }
          }

          const message = `✓ ${entity}: ${updatedCount} registros restaurados`;
          setRestorationLog(prev => [...prev, message]);
          toast.success(message);
        } catch (e) {
          const message = `✗ ${entity}: Erro ao restaurar`;
          setRestorationLog(prev => [...prev, message]);
          console.error(message, e);
        }
      }

      setRestorationLog(prev => [...prev, '✓ Restauração concluída com sucesso']);
      toast.success('Dados restaurados com sucesso!');
    } catch (e) {
      toast.error('Erro ao restaurar dados');
      console.error('Erro ao restaurar dados:', e);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card>
        <CardHeader className="bg-blue-50 border-b border-blue-200">
          <div className="flex items-start gap-3">
            <Database className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <CardTitle className="text-blue-700">Restaurar Dados de Empresa</CardTitle>
              <CardDescription className="text-blue-600 mt-1">
                Atribui company_id aos registros antigos que não o possuem
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
                  placeholder="Ex: 0000"
                  disabled={isRestoring}
                />
                <Button
                  onClick={handleSearchCompany}
                  disabled={!companyCode || isRestoring}
                  variant="outline"
                >
                  Buscar
                </Button>
              </div>
            </div>

            {/* Info */}
            {selectedCompany && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900">Empresa selecionada:</p>
                  <p className="text-lg font-bold text-blue-700 mt-2">
                    {selectedCompany.code} - {selectedCompany.name}
                  </p>
                </div>

                <Button
                  onClick={handleRestoreData}
                  disabled={isRestoring}
                  className="w-full gap-2"
                >
                  {isRestoring ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Restaurando...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4" />
                      Restaurar Dados
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Log */}
            {restorationLog.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Log da operação:</p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                  {restorationLog.map((log, idx) => (
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