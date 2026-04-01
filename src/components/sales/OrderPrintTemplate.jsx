import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const OrderPrintTemplate = React.forwardRef(({ order, items }, ref) => {
  const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const today = format(new Date(), 'dd/MM/yyyy', { locale: ptBR });

  if (!order || !items) {
    return (
      <div ref={ref} style={{ backgroundColor: 'white', padding: '48px', width: '210mm', minHeight: '297mm', fontFamily: 'Arial, sans-serif' }}>
        <p>Carregando dados...</p>
      </div>
    );
  }

  return (
    <div ref={ref} style={{
      backgroundColor: 'white',
      padding: '48px',
      width: '210mm',
      minHeight: '297mm',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      lineHeight: '1.5',
      color: '#1e293b'
    }}>
      {/* Header */}
      <div style={{ borderBottom: '2px solid #1e293b', paddingBottom: '24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 8px 0' }}>PEDIDO DE VENDA</h1>
          <p style={{ color: '#64748b', margin: 0 }}>Nº {order.order_number || order.numero_pedido_externo || order.id?.slice(0, 8)}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>AGFSig ERP</p>
          <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Sistema de Gestão Empresarial</p>
        </div>
      </div>

      {/* Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '12px', textTransform: 'uppercase' }}>
            Dados do Cliente
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ fontWeight: '600', margin: 0 }}>{order.client_name}</p>
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '12px', textTransform: 'uppercase' }}>
            Informações do Pedido
          </h2>
          <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Data de Emissão:</span>
              <span style={{ fontWeight: '500' }}>{today}</span>
            </div>
            {order.delivery_date && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Previsão de Entrega:</span>
                <span style={{ fontWeight: '500' }}>{format(new Date(order.delivery_date), 'dd/MM/yyyy', { locale: ptBR })}</span>
              </div>
            )}
            {order.seller_name && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Vendedor:</span>
                <span style={{ fontWeight: '500' }}>{order.seller_name}</span>
              </div>
            )}
            {(order.payment_condition_name || order.payment_terms) && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Condição de Pagamento:</span>
                <span style={{ fontWeight: '500' }}>{order.payment_condition_name || order.payment_terms}</span>
              </div>
            )}
            {order.numero_pedido_externo && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Pedido Externo (TOTVS):</span>
                <span style={{ fontWeight: '500' }}>{order.numero_pedido_externo}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '12px', textTransform: 'uppercase' }}>
          Itens do Pedido
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px' }}>Código</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px' }}>Descrição</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px' }}>Cod. FINAME</th>
              <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: '12px' }}>Qtd</th>
              <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: '12px' }}>Valor Unit.</th>
              <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: '12px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} style={{ backgroundColor: index % 2 === 0 ? '#f8fafc' : 'white' }}>
                <td style={{ padding: '10px 14px', fontSize: '12px', color: '#475569' }}>{item.product_sku}</td>
                <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: '500' }}>{item.product_name}</td>
                <td style={{ padding: '10px 14px', fontSize: '12px', color: '#475569' }}>{item.cod_finame || '-'}</td>
                <td style={{ padding: '10px 14px', fontSize: '12px', textAlign: 'right' }}>{item.qty}</td>
                <td style={{ padding: '10px 14px', fontSize: '12px', textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
                <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: '600', textAlign: 'right' }}>{formatCurrency(item.total_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
        <div style={{ backgroundColor: '#1e293b', color: 'white', padding: '16px 32px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '18px', fontWeight: '600' }}>VALOR TOTAL:</span>
            <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatCurrency(order.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>
            Observações
          </h2>
          <p style={{ color: '#64748b', fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0 }}>{order.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: '2px solid #1e293b', paddingTop: '24px', marginTop: 'auto' }}>
        <div style={{ textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
          <p style={{ fontSize: '10px', margin: '8px 0 0 0' }}>Pedido gerado automaticamente pelo AGFSig ERP</p>
        </div>
      </div>
    </div>
  );
});

OrderPrintTemplate.displayName = 'OrderPrintTemplate';
export default OrderPrintTemplate;