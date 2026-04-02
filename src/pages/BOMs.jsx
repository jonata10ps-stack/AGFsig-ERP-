import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompanyId } from '@/components/useCompanyId';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, FileText, Package, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ProductSearchSelect from '@/components/products/ProductSearchSelect';
import { toast } from 'sonner';

export default function BOMs() {
  const { companyId } = useCompanyId();
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newBOM, setNewBOM] = useState({ selectedProduct: null });
  const queryClient = useQueryClient();

  const { data: boms = [], isLoading } = useQuery({
    queryKey: ['boms', companyId],
    queryFn: () => companyId ? base44.entities.BOM.filter({ company_id: companyId, is_active: true }, '-created_date') : Promise.resolve([]),
    enabled: !!companyId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => companyId ? base44.entities.Product.filter({ company_id: companyId, active: true }) : Promise.resolve([]),
    enabled: !!companyId,
  });

  const createBOMMutation = useMutation({
    mutationFn: async (data) => {
      const product = data.selectedProduct;
      if (!product) throw new Error('Produto não selecionado');
      
      try {
        // 1. Buscar todas as BOMs existentes para este SKU (de forma ampla)
        const allBoms = await base44.entities.BOM.filter({
          product_sku: product.sku
        });

        let mainBom = null;
        let maxVersion = 0;

        if (allBoms && allBoms.length > 0) {
          // Encontramos registros. Vamos identificar a versão mais alta e consolidar.
          const versions = allBoms.map(b => parseInt(b.current_version_number) || 0);
          maxVersion = Math.max(0, ...versions);
          mainBom = allBoms.sort((a, b) => (parseInt(b.current_version_number) || 0) - (parseInt(a.current_version_number) || 0))[0];

          // Inativar TODAS as outras BOMs para este produto, exceto a que vamos usar
          for (const b of allBoms) {
            if (b.id !== mainBom.id) {
              await base44.entities.BOM.update(b.id, { is_active: false });
            }
          }
        }

        const nextVersionNumber = maxVersion + 1;
        
        if (!mainBom) {
          // Criar BOM nova se não existir absolutamente nada
          mainBom = await base44.entities.BOM.create({
            company_id: companyId || '00000000-0000-0000-0000-000000000000',
            product_id: product.id,
            product_sku: product.sku,
            product_name: product.name,
            is_active: true,
            current_version_number: 1
          });
        }

        // 2. Inativar a versão anterior da BOM principal
        if (mainBom.current_version_id) {
          await base44.entities.BOMVersion.update(mainBom.current_version_id, {
            is_active: false
          });
        }

        // 3. Criar a nova versão
        const version = await base44.entities.BOMVersion.create({
          company_id: companyId || '00000000-0000-0000-0000-000000000000',
          bom_id: mainBom.id,
          version_number: nextVersionNumber,
          is_active: true,
          effective_date: new Date().toISOString().split('T')[0]
        });

        // 4. Atualizar a BOM principal
        await base44.entities.BOM.update(mainBom.id, {
          current_version_id: version.id,
          current_version_number: nextVersionNumber,
          is_active: true
        });

        return mainBom;
      } catch (err) {
        console.error('Falha crítica na mutação de BOM:', err);
        throw err;
      }
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['boms', companyId] });
       setShowNewDialog(false);
       setNewBOM({ selectedProduct: null });
       toast.success('BOM criado com sucesso');
     },
     onError: (error) => {
       console.error('Erro ao criar BOM:', error);
       toast.error('Erro ao salvar BOM: ' + (error.message || 'Verifique se as colunas existem no banco'));
     }
  });

  const filteredBOMs = boms.filter(bom =>
    bom.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bom.product_sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Lista de Materiais (BOM)</h1>
          <p className="text-slate-500 mt-1">Gerencie as estruturas de produtos</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo BOM
          </Button>
          <Link to={createPageUrl('ImportBOMs')}>
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Importar Excel
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Buscar por produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">Carregando...</div>
          ) : filteredBOMs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p>Nenhum BOM encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredBOMs.map((bom) => (
                <Link
                  key={bom.id}
                  to={createPageUrl('BOMDetail') + '?id=' + bom.id}
                  className="block p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <FileText className="h-5 w-5 text-slate-400" />
                      <div>
                        <div className="font-medium text-slate-900">{bom.product_name}</div>
                        <div className="text-sm text-slate-500">SKU: {bom.product_sku}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {bom.current_version_number && (
                        <Badge variant="outline">
                          Versão {bom.current_version_number}
                        </Badge>
                      )}
                      {bom.is_active ? (
                        <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                      ) : (
                        <Badge variant="outline">Inativo</Badge>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo BOM</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Produto</label>
              <ProductSearchSelect
                value={newBOM.selectedProduct?.id}
                onSelect={(productId, product) => {
                  setNewBOM({ selectedProduct: product || null });
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => createBOMMutation.mutate(newBOM)}
                disabled={!newBOM.selectedProduct || createBOMMutation.isPending}
              >
                Criar BOM
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}