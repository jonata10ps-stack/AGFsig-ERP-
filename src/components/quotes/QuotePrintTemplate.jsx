import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const QuotePrintTemplate = React.forwardRef(({ quote, quoteItems, subitems, client, paymentCondition }, ref) => {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const today = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR });

  if (!quote || !quoteItems || quoteItems.length === 0) {
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
          <div className="flex items-center gap-2 mb-2">
            <div className="h-10 w-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">AG</span>
            </div>
            <h1 className="text-3xl font-extrabold text-indigo-950 tracking-tight">AGFSig ERP</h1>
          </div>
          <p className="text-slate-500 text-sm font-medium">Soluções Inteligentes para Gestão</p>
        </div>
        <div className="text-right">
          <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-md inline-block mb-2">
            <h2 className="text-xl font-bold uppercase tracking-wider">Orçamento</h2>
          </div>
          <p className="text-2xl font-mono font-bold text-slate-800">{quote.quote_number}</p>
          <p className="text-slate-500 text-xs">Gerado em: {today}</p>
        </div>
      </div>

      {/* Grid Info */}
      <div className="grid grid-cols-2 gap-12 mb-10">
        <div>
          <h3 className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest mb-4 border-b pb-1">Identificação do Cliente</h3>
          <div className="space-y-1">
            <p className="text-base font-bold text-slate-900">{quote.client_name}</p>
            {quote.client_document && (
              <p className="text-sm text-slate-600">
                <span className="font-semibold">{quote.client_document.length > 14 ? 'CNPJ' : 'CPF'}:</span> {quote.client_document}
              </p>
            )}
            {client?.address && <p className="text-sm text-slate-600">{client.address}</p>}
            {client?.city && (
              <p className="text-sm text-slate-600">{client.city} - {client.state || ''}</p>
            )}
            {client?.phone && (
              <p className="text-sm text-slate-600">
                <span className="font-semibold">Contato:</span> {client.phone}
              </p>
            )}
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
          <h3 className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest mb-4 border-b border-indigo-100 pb-1">Resumo do Documento</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 italic">Data de Validade:</span>
              <span className="font-bold text-slate-800">
                {quote.validity_date ? format(new Date(quote.validity_date), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 italic">Previsão de Entrega:</span>
              <span className="font-bold text-slate-800">
                {quote.delivery_date ? format(new Date(quote.delivery_date), 'dd/MM/yyyy', { locale: ptBR }) : 'A combinar'}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="text-slate-500 italic">Vendedor:</span>
              <span className="font-bold text-slate-800">{quote.seller_name || 'AGF Equipamentos'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 italic">Pgto:</span>
              <span className="font-bold text-indigo-700">{quote.payment_condition_name || 'A definir'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-10">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-indigo-950 text-white">
              <th className="py-3 px-4 rounded-tl-lg text-[11px] font-bold uppercase tracking-wider">Código</th>
              <th className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider">Item / Descrição</th>
              <th className="py-3 px-4 text-center text-[11px] font-bold uppercase tracking-wider">Qtd</th>
              <th className="py-3 px-4 text-right text-[11px] font-bold uppercase tracking-wider">Unitário</th>
              <th className="py-3 px-4 rounded-tr-lg text-right text-[11px] font-bold uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 border-x border-b rounded-b-lg">
            {quoteItems.map((item, idx) => {
              const itemSubitems = subitems?.filter(s => s.quote_item_id === item.id) || [];
              return (
                <React.Fragment key={item.id}>
                  <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="py-4 px-4 text-sm font-mono text-slate-500">{item.product_sku}</td>
                    <td className="py-4 px-4">
                      <p className="text-sm font-bold text-slate-900">{item.product_name}</p>
                    </td>
                    <td className="py-4 px-4 text-sm text-center font-medium text-slate-700">{item.qty}</td>
                    <td className="py-4 px-4 text-sm text-right text-slate-700">{formatCurrency(item.unit_price)}</td>
                    <td className="py-4 px-4 text-sm text-right font-bold text-slate-900">{formatCurrency(item.base_total)}</td>
                  </tr>
                  {itemSubitems.map(sub => (
                    <tr key={sub.id} className="bg-indigo-50/20">
                      <td className="py-2 px-4"></td>
                      <td colSpan={2} className="py-2 px-4 text-xs italic text-slate-500 pl-8">
                        └ {sub.product_name} ({sub.qty}x)
                      </td>
                      <td className="py-2 px-4 text-xs text-right text-slate-400">{formatCurrency(sub.unit_price)}</td>
                      <td className="py-2 px-4 text-xs text-right text-slate-500">{formatCurrency(sub.total_price)}</td>
                    </tr>
                  ))}
                  {itemSubitems.length > 0 && (
                    <tr className="bg-slate-50/80">
                      <td colSpan={4} className="py-2 px-4 text-right text-[10px] uppercase font-bold text-slate-400">Total do Item c/ Subitens:</td>
                      <td className="py-2 px-4 text-right text-xs font-bold text-indigo-600">{formatCurrency(item.final_total)}</td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Section */}
      <div className="flex justify-end mb-12">
        <div className="w-80 space-y-3">
          {paymentCondition && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Detalhes de Pagamento</p>
              <p className="text-xs font-bold text-slate-700">{paymentCondition.name}</p>
              <p className="text-[10px] text-slate-500 mt-1">{paymentCondition.description || ''}</p>
            </div>
          )}
          <div className="flex justify-between items-center px-4">
            <span className="text-slate-500 font-medium">Subtotal</span>
            <span className="text-slate-700 font-bold">{formatCurrency(quote.total_amount)}</span>
          </div>
          <div className="flex justify-between items-center bg-indigo-600 text-white p-4 rounded-xl shadow-lg shadow-indigo-200">
            <span className="text-sm font-bold uppercase tracking-widest">Valor Total</span>
            <span className="text-2xl font-black">{formatCurrency(quote.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Notes Area */}
      {quote.notes && (
        <div className="border-l-4 border-indigo-200 pl-6 py-2 mb-12">
          <h4 className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest mb-2">Observações Adicionais</h4>
          <p className="text-sm text-slate-600 leading-relaxed font-light">{quote.notes}</p>
        </div>
      )}

      {/* Modern Footer */}
      <div className="mt-auto pt-10 border-t border-slate-100 flex justify-between items-center opacity-70">
        <div className="text-[10px] space-y-1">
          <p className="font-bold text-slate-800 uppercase italic">AGF EQUIPAMENTOS - Unidade de Soluções Industriais</p>
          <p className="text-slate-500">Documento gerado digitalmente pelo AGFSig ERP v2.0</p>
        </div>
        <div className="text-right text-[10px]">
          <p className="font-bold text-slate-800">CÓDIGO DE RASTREAMENTO</p>
          <p className="font-mono text-slate-400 uppercase">{quote.id.substring(0, 13)}</p>
        </div>
      </div>

      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          body { -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
});

QuotePrintTemplate.displayName = 'QuotePrintTemplate';
export default QuotePrintTemplate;