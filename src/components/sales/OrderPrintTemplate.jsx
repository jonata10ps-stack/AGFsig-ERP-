import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const OrderPrintTemplate = React.forwardRef(({ order, items }, ref) => {
  const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const today = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR });

  if (!order || !items) {
    return (
      <div ref={ref} className="p-12 bg-white text-slate-800 font-sans">
        <p>Carregando dados para impressão...</p>
      </div>
    );
  }

  return (
    <div ref={ref} className="bg-white p-10 w-[210mm] min-h-[297mm] font-sans text-slate-900 mx-auto">
      {/* Premium Header */}
      <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-8 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-10 w-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">AG</span>
            </div>
            <h1 className="text-3xl font-extrabold text-indigo-950 tracking-tight">AGFSig ERP</h1>
          </div>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest pl-12">Sales & Industry Management</p>
        </div>
        <div className="text-right">
          <div className="bg-indigo-950 text-white px-4 py-2 rounded-md inline-block mb-2">
            <h2 className="text-xl font-bold uppercase tracking-widest text-[16px]">Pedido de Venda</h2>
          </div>
          <p className="text-2xl font-mono font-bold text-slate-800">
            {order.order_number || order.numero_pedido_externo || order.id?.slice(0, 8)}
          </p>
          <p className="text-slate-500 text-xs">Emissão: {today}</p>
        </div>
      </div>

      {/* Info Boxes */}
      <div className="grid grid-cols-2 gap-10 mb-10">
        <div>
          <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4 border-b pb-1">Cliente</h3>
          <div className="space-y-1">
            <p className="text-base font-black text-slate-900 leading-tight">{order.client_name}</p>
            {order.client_document && (
              <p className="text-sm text-slate-600 font-medium">
                {order.client_document.length > 14 ? 'CNPJ' : 'CPF'}: {order.client_document}
              </p>
            )}
            {order.client_city && (
              <p className="text-sm text-slate-500">{order.client_city} - {order.client_state || ''}</p>
            )}
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-indigo-600 opacity-20"></div>
          <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4 border-b border-indigo-100 pb-1 font-mono">Detalhes Comerciais</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold uppercase">Previsão Entrega:</span>
              <span className="font-black text-slate-900">{order.delivery_date ? format(new Date(order.delivery_date), 'dd/MM/yyyy', { locale: ptBR }) : 'A confirmar'}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold uppercase">Vendedor:</span>
              <span className="font-black text-slate-900 truncate ml-4 uppercase">{order.seller_name || 'Agf Equipamentos'}</span>
            </div>
            <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200">
              <span className="text-slate-400 font-bold uppercase">Pagamento:</span>
              <span className="font-black text-indigo-700">{order.payment_condition_name || order.payment_terms || 'A DEFINIR'}</span>
            </div>
            {order.numero_pedido_externo && (
              <div className="flex justify-between items-center text-xs pt-2">
                <span className="text-slate-400 font-bold uppercase">Pedido TOTVS:</span>
                <span className="font-mono font-black text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-100">{order.numero_pedido_externo}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-10">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="py-4 px-4 rounded-tl-xl text-[10px] font-black uppercase tracking-widest w-24">Código</th>
              <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest">Item / Descrição</th>
              <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-center w-32">Cód. FINAME</th>
              <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-center">Qtd</th>
              <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-right">Unitário</th>
              <th className="py-4 px-4 rounded-tr-xl text-[10px] font-black uppercase tracking-widest text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 border-x border-b border-slate-100">
            {items.map((item, idx) => (
              <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                <td className="py-4 px-4 text-xs font-mono font-bold text-slate-400">{item.product_sku}</td>
                <td className="py-4 px-4">
                  <p className="text-sm font-black text-slate-800 leading-tight">{item.product_name}</p>
                </td>
                <td className="py-4 px-4 text-center">
                   {item.cod_finame ? (
                      <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-100">
                         {item.cod_finame}
                      </span>
                   ) : (
                      <span className="text-slate-300">-</span>
                   )}
                </td>
                <td className="py-4 px-4 text-sm text-center font-black text-slate-700">{item.qty}</td>
                <td className="py-4 px-4 text-sm text-right font-medium text-slate-600">{formatCurrency(item.unit_price)}</td>
                <td className="py-4 px-4 text-sm text-right font-black text-slate-900">{formatCurrency(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Area */}
      <div className="flex justify-between items-start mb-12">
        <div className="w-1/2">
           {order.notes && (
             <div className="bg-indigo-50/30 rounded-xl p-6 border-l-4 border-indigo-600">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">Observações do Pedido</h4>
                <p className="text-sm text-slate-600 font-medium leading-relaxed italic">"{order.notes}"</p>
             </div>
           )}
        </div>
        
        <div className="w-80 space-y-3">
          <div className="flex justify-between items-center px-4">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest tracking-widest">Subtotal</span>
            <span className="text-slate-700 font-bold">{formatCurrency(order.total_amount)}</span>
          </div>
          <div className="flex justify-between items-center bg-indigo-600 text-white p-5 rounded-2xl shadow-xl shadow-indigo-100">
            <span className="text-xs font-black uppercase tracking-[0.2em] border-b border-indigo-400">Total Geral</span>
            <span className="text-2xl font-black">{formatCurrency(order.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Modern Detailed Footer */}
      <div className="mt-auto pt-10 border-t border-slate-200">
        <div className="grid grid-cols-3 gap-6 items-end">
          <div className="col-span-2 space-y-2">
            <p className="text-[10px] font-black text-slate-800 uppercase italic opacity-60">
              AGF EQUIPAMENTOS - Unidade Industrial & Distribuição
            </p>
            <p className="text-[9px] text-slate-400">
              Este documento é uma representação digital do pedido registrado no sistema ERP. 
              Sua validade comercial está sujeita à aprovação do setor de crédito e estoque.
            </p>
          </div>
          <div className="text-right">
             <div className="inline-block p-2 bg-slate-950 rounded text-center min-w-[120px]">
                <p className="text-[8px] font-bold text-slate-500 uppercase">Sistema Autenticado</p>
                <p className="text-[10px] font-mono text-white font-bold">{order.id.substring(0, 18).toUpperCase()}</p>
             </div>
          </div>
        </div>
      </div>

      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          body { -webkit-print-color-adjust: exact; }
          .no-print { display: none; }
        }
      `}</style>
    </div>
  );
});

OrderPrintTemplate.displayName = 'OrderPrintTemplate';
export default OrderPrintTemplate;