import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompanyId } from '@/components/useCompanyId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const STATUS_CONFIG = {
  ABERTO: { label: 'Aberto', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  RESOLVIDO: { label: 'Resolvido', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  CANCELADO: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800' },
};

export default function NonConformityReports() {
  const { companyId } = useCompanyId();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ABERTO');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['nonconformity-reports', statusFilter, companyId],
    queryFn: () => companyId ? base44.entities.NonConformityReport.filter({ company_id: companyId, status: statusFilter }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ reportId, action }) => {
      const now = new Date().toISOString();
      const report = selectedReport;

      // Verificar se já existe solicitação vinculada para evitar duplicação
      if (action === 'MATERIAL_REQUEST' && report.material_request_id) {
        throw new Error('Já existe uma solicitação de material vinculada a esta não conformidade.');
      }

      await base44.entities.NonConformityReport.update(reportId, {
        status: 'RESOLVIDO',
        action_type: action,
        resolved_at: now,
        resolved_by: user?.email,
        notes: actionNotes,
      });

      if (action === 'MATERIAL_REQUEST') {
         // Criar a solicitação de material
         const requestNumber = `MR-${Date.now()}`;
         const newRequest = await base44.entities.MaterialRequest.create({
           company_id: companyId,
           request_number: requestNumber,
           description: `Não conformidade #${report.report_number} - Item faltante`,
           status: 'ABERTA',
           requester: user?.full_name || user?.email,
           department: 'Qualidade',
           priority: 'ALTA',
           notes: actionNotes,
         });

         // Criar o item da solicitação
         await base44.entities.MaterialRequestItem.create({
           company_id: companyId,
           request_id: newRequest.id,
           product_id: report.product_id,
           product_sku: report.product_sku,
           product_name: report.product_name,
           qty_requested: Math.abs(report.variance),
           qty_received: 0,
           qty_pending: Math.abs(report.variance),
           notes: `Não conformidade #${report.report_number}`,
         });

         // Atualizar a não conformidade com o ID da solicitação
         await base44.entities.NonConformityReport.update(reportId, {
           material_request_id: newRequest.id,
         });
       } else if (action === 'NEW_RECEIVING') {
         const report = selectedReport;
         const batch = await base44.entities.ReceivingBatch.create({
           company_id: companyId,
           batch_number: `REC-EXCESS-${Date.now()}`,
           status: 'PENDENTE_CONF',
           notes: `Recebimento de excesso #${report.report_number}`,
         });

         await base44.entities.ReceivingItem.create({
           company_id: companyId,
           receiving_batch_id: batch.id,
           product_id: report.product_id,
           product_sku: report.product_sku,
           product_name: report.product_name,
           quantity_expected: report.variance,
           quantity_received: report.variance,
           status: 'PENDENTE_CONF',
         });

        await base44.entities.NonConformityReport.update(reportId, {
          new_receiving_id: batch.id,
        });
      }
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['nonconformity-reports', statusFilter, companyId] });
       setShowActionDialog(false);
       setSelectedReport(null);
       setActionType('');
       setActionNotes('');
     },
  });

  const filteredReports = reports.filter(report =>
    report.product_sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.report_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Relatórios de Não Conformidade</h1>
        <p className="text-slate-500 mt-1">Gerenciar discrepâncias em recebimentos</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por SKU, produto ou número..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ABERTO">Abertos</SelectItem>
                <SelectItem value="RESOLVIDO">Resolvidos</SelectItem>
                <SelectItem value="CANCELADO">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center text-slate-500">
              Carregando...
            </CardContent>
          </Card>
        ) : filteredReports.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-slate-500">
              Nenhum relatório encontrado
            </CardContent>
          </Card>
        ) : (
          filteredReports.map((report) => {
            const statusConfig = STATUS_CONFIG[report.status];
            return (
              <Card key={report.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{report.product_name}</h3>
                        <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                        <Badge variant="outline">{report.variance_type}</Badge>
                      </div>
                      <p className="text-sm text-slate-500">
                        {report.report_number} • SKU: {report.product_sku}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b">
                    <div>
                      <p className="text-xs text-slate-500">Esperado</p>
                      <p className="text-lg font-semibold">{report.quantity_expected}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Recebido</p>
                      <p className="text-lg font-semibold">{report.quantity_received}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Diferença</p>
                      <p className={`text-lg font-semibold ${report.variance < 0 ? 'text-red-600' : 'text-orange-600'}`}>
                        {report.variance > 0 ? '+' : ''}{report.variance}
                      </p>
                    </div>
                  </div>

                  {report.status === 'ABERTO' && (
                    <Button
                      onClick={() => {
                        setSelectedReport(report);
                        setShowActionDialog(true);
                      }}
                      size="sm"
                    >
                      Resolver
                    </Button>
                  )}

                  {report.action_type && report.action_type !== 'NENHUMA' && (
                    <div className="text-xs text-slate-500 mt-2">
                      {report.action_type === 'MATERIAL_REQUEST' && (
                        <>Solicitação de Material: {report.material_request_id}</>
                      )}
                      {report.action_type === 'NEW_RECEIVING' && (
                        <>Novo Recebimento: {report.new_receiving_id}</>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver Não Conformidade</DialogTitle>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-sm font-medium">{selectedReport.product_name}</p>
                <p className="text-sm text-slate-500">
                  Discrepância: {selectedReport.variance > 0 ? 'Excesso' : 'Faltante'} de {Math.abs(selectedReport.variance)} unidades
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Ação</label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma ação" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedReport.variance < 0 && (
                      <SelectItem value="MATERIAL_REQUEST">
                        Gerar Solicitação de Material
                      </SelectItem>
                    )}
                    {selectedReport.variance > 0 && (
                      <SelectItem value="NEW_RECEIVING">
                        Gerar Novo Recebimento
                      </SelectItem>
                    )}
                    <SelectItem value="NENHUMA">Nenhuma ação</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Observações</label>
                <Textarea
                  placeholder="Descreva como o problema foi resolvido..."
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                />
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowActionDialog(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => resolveMutation.mutate({ reportId: selectedReport.id, action: actionType })}
                  disabled={!actionType || resolveMutation.isPending}
                >
                  Resolver
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}