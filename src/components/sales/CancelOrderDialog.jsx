import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Package } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

export default function CancelOrderDialog({ open, onClose, productionRequests, productionOrders, onConfirm, loading }) {
  const [selections, setSelections] = useState({});

  const pendingRequests = productionRequests?.filter(r => r.status === 'PENDENTE') || [];
  const inProgressRequests = productionRequests?.filter(r => r.status === 'EM_PRODUCAO') || [];
  const completedRequests = productionRequests?.filter(r => r.status === 'CONCLUIDA') || [];
  const notCompletedRequests = productionRequests?.filter(r => r.status !== 'CONCLUIDA') || [];

  const hasDecisions = Object.values(selections).length > 0 || (productionRequests?.length === 0);

  const handleConfirm = () => {
    const decisions = {
      pendingRequests: pendingRequests.map(pr => ({
        id: pr.id,
        action: selections[`req-${pr.id}`] || 'CANCELAR'
      })),
      inProgressOps: inProgressRequests.map(ir => {
        const relatedOps = productionOrders?.filter(o => 
          o.request_id === ir.id || 
          (o.product_id === ir.product_id && o.qty_planned === ir.qty_requested)
        ) || [];
        
        return {
          requestId: ir.id,
          opId: relatedOps[0]?.id,
          opIds: relatedOps.map(o => o.id),
          action: selections[`op-${ir.id}`] || 'MANTER'
        };
      }),
      completedRequests: completedRequests.map(cr => ({
        id: cr.id,
        action: selections[`res-${cr.id}`] || 'MANTER_RESIDUO'
      }))
    };
    onConfirm(decisions);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
           <DialogTitle>Gerenciar Ordens de Produção</DialogTitle>
         </DialogHeader>

        <div className="space-y-4">
          {productionRequests?.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhuma solicitação de produção vinculada a este pedido. Pode cancelar normalmente.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Solicitações Pendentes */}
              {pendingRequests.length > 0 && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Solicitações Pendentes ({pendingRequests.length})
                  </h3>
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertDescription className="text-sm">
                      Essas solicitações ainda não foram atendidas. Selecione a ação para cada uma.
                    </AlertDescription>
                  </Alert>
                  {pendingRequests.map(req => (
                    <div key={req.id} className="p-3 bg-white rounded border border-slate-200">
                      <p className="font-medium text-sm mb-2">{req.product_name}</p>
                      <div className="space-y-2 ml-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`req-${req.id}-cancel`}
                            checked={selections[`req-${req.id}`] === 'CANCELAR'}
                            onCheckedChange={(checked) =>
                              setSelections({
                                ...selections,
                                [`req-${req.id}`]: checked ? 'CANCELAR' : undefined
                              })
                            }
                          />
                          <Label htmlFor={`req-${req.id}-cancel`} className="text-sm cursor-pointer">
                            Cancelar solicitação
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`req-${req.id}-manter`}
                            checked={selections[`req-${req.id}`] === 'MANTER'}
                            onCheckedChange={(checked) =>
                              setSelections({
                                ...selections,
                                [`req-${req.id}`]: checked ? 'MANTER' : undefined
                              })
                            }
                          />
                          <Label htmlFor={`req-${req.id}-manter`} className="text-sm cursor-pointer">
                            Manter solicitação
                          </Label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Solicitações Não Concluídas (Pendentes + Em Produção) */}
               {notCompletedRequests.length > 0 && (
                 <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                   <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                     <Package className="h-4 w-4" />
                     Ordens de Produção ({notCompletedRequests.length})
                   </h3>
                   <Alert className="bg-red-50 border-red-200">
                     <AlertDescription className="text-sm">
                       Escolha se deseja manter ou cancelar cada ordem de produção.
                     </AlertDescription>
                   </Alert>
                   {notCompletedRequests.map(req => {
                     // Procurar OPs que foram criadas a partir desta solicitação
                     const relatedOps = productionOrders?.filter(o => 
                       o.request_id === req.id || 
                       (o.product_id === req.product_id && o.qty_planned === req.qty_requested)
                     ) || [];

                     const op = relatedOps[0];
                     const shouldAskAboutOp = op && !['ENCERRADA', 'CANCELADA'].includes(op.status);
                     return (
                       <div key={req.id} className="p-3 bg-white rounded border border-red-200">
                         <p className="font-medium text-sm mb-2">
                           {req.product_name} (Qtd: {req.qty_requested})
                           {op && <span className="text-xs text-slate-500 ml-2">OP: {op.op_number}</span>}
                           {relatedOps.length > 1 && <span className="text-xs text-amber-600 ml-2">({relatedOps.length} OPs encontradas)</span>}
                         </p>
                         <p className="text-xs text-slate-500 mb-3">Status: {req.status}</p>
                         <div className="space-y-2 ml-2">
                           {shouldAskAboutOp ? (
                             <>
                               <div className="flex items-center gap-2">
                                 <Checkbox
                                   id={`op-${req.id}-manter`}
                                   checked={selections[`op-${req.id}`] === 'MANTER'}
                                   onCheckedChange={(checked) =>
                                     setSelections({
                                       ...selections,
                                       [`op-${req.id}`]: checked ? 'MANTER' : undefined
                                     })
                                   }
                                 />
                                 <Label htmlFor={`op-${req.id}-manter`} className="text-sm cursor-pointer">
                                   Manter OP aberta (descontinuar vínculo)
                                 </Label>
                               </div>
                               <div className="flex items-center gap-2">
                                 <Checkbox
                                   id={`op-${req.id}-cancelar`}
                                   checked={selections[`op-${req.id}`] === 'CANCELAR'}
                                   onCheckedChange={(checked) =>
                                     setSelections({
                                       ...selections,
                                       [`op-${req.id}`]: checked ? 'CANCELAR' : undefined
                                     })
                                   }
                                 />
                                 <Label htmlFor={`op-${req.id}-cancelar`} className="text-sm cursor-pointer">
                                   Cancelar {relatedOps.length > 1 ? `todas as ${relatedOps.length} OPs` : 'OP'} e solicitação
                                 </Label>
                               </div>
                             </>
                           ) : (
                             <div className="flex items-center gap-2">
                               <Checkbox
                                 id={`req-${req.id}-cancel`}
                                 checked={selections[`req-${req.id}`] === 'CANCELAR'}
                                 onCheckedChange={(checked) =>
                                   setSelections({
                                     ...selections,
                                     [`req-${req.id}`]: checked ? 'CANCELAR' : undefined
                                   })
                                 }
                               />
                               <Label htmlFor={`req-${req.id}-cancel`} className="text-sm cursor-pointer">
                                 Cancelar solicitação
                               </Label>
                             </div>
                           )}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               )}

              {/* Solicitações Concluídas */}
              {completedRequests.length > 0 && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Solicitações Concluídas ({completedRequests.length})
                  </h3>
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertDescription className="text-sm">
                      Essas solicitações já foram atendidas. Escolha o que fazer com o resíduo.
                    </AlertDescription>
                  </Alert>
                  {completedRequests.map(req => (
                    <div key={req.id} className="p-3 bg-white rounded border border-blue-200">
                      <p className="font-medium text-sm mb-2">
                        {req.product_name}
                        <span className="text-xs text-slate-500 ml-2">
                          Resíduo: {req.qty_residue || 0}
                        </span>
                      </p>
                      <div className="space-y-2 ml-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`res-${req.id}-manter`}
                            checked={selections[`res-${req.id}`] === 'MANTER_RESIDUO'}
                            onCheckedChange={(checked) =>
                              setSelections({
                                ...selections,
                                [`res-${req.id}`]: checked ? 'MANTER_RESIDUO' : undefined
                              })
                            }
                          />
                          <Label htmlFor={`res-${req.id}-manter`} className="text-sm cursor-pointer">
                            Manter resíduo em estoque
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`res-${req.id}-eliminar`}
                            checked={selections[`res-${req.id}`] === 'ELIMINAR_RESIDUO'}
                            onCheckedChange={(checked) =>
                              setSelections({
                                ...selections,
                                [`res-${req.id}`]: checked ? 'ELIMINAR_RESIDUO' : undefined
                              })
                            }
                          />
                          <Label htmlFor={`res-${req.id}-eliminar`} className="text-sm cursor-pointer">
                            Eliminar resíduo (dar baixa)
                          </Label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!hasDecisions || loading}
          >
            {loading ? 'Cancelando...' : 'Confirmar Cancelamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}