import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const QuotePrintTemplate = React.forwardRef(({ quote, quoteItems, subitems, client, paymentCondition }, ref) => {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const today = format(new Date(), 'dd/MM/yyyy', { locale: ptBR });

  if (!quote || !quoteItems || quoteItems.length === 0) {
    return (
      <div ref={ref} style={{
        backgroundColor: 'white',
        padding: '48px',
        width: '210mm',
        minHeight: '297mm',
        fontFamily: 'Arial, sans-serif',
        color: '#1e293b'
      }}>
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
      <div style={{
        borderBottom: '2px solid #1e293b',
        paddingBottom: '24px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 8px 0' }}>ORÇAMENTO</h1>
          <p style={{ color: '#64748b', margin: 0 }}>Nº {quote?.quote_number}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>AGFSig ERP</p>
          <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Sistema de Gestão Empresarial</p>
        </div>
      </div>

      {/* Info Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '12px', textTransform: 'uppercase' }}>
            Dados do Cliente
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ fontWeight: '600', margin: 0 }}>{quote?.client_name}</p>
            {quote?.client_document && (
              <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                {quote.client_document.length > 14 ? 'CNPJ' : 'CPF'}: {quote.client_document}
              </p>
            )}
            {client?.address && <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>{client.address}</p>}
            {client?.city && client?.state && (
              <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>{client.city} - {client.state}</p>
            )}
            {client?.phone && <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Tel: {client.phone}</p>}
            {client?.email && <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Email: {client.email}</p>}
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '12px', textTransform: 'uppercase' }}>
            Informações do Orçamento
          </h2>
          <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Data de Emissão:</span>
              <span style={{ fontWeight: '500' }}>{today}</span>
            </div>
            {quote?.validity_date && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Validade:</span>
                <span style={{ fontWeight: '500' }}>
                  {format(new Date(quote.validity_date), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              </div>
            )}
            {quote?.delivery_date && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Previsão de Entrega:</span>
                <span style={{ fontWeight: '500' }}>
                  {format(new Date(quote.delivery_date), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              </div>
            )}
            {quote?.seller_name && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Vendedor:</span>
                <span style={{ fontWeight: '500' }}>{quote.seller_name}</span>
              </div>
            )}
            {quote?.payment_condition_name && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Condição de Pagamento:</span>
                <span style={{ fontWeight: '500' }}>{quote.payment_condition_name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '12px', textTransform: 'uppercase' }}>
          Itens do Orçamento
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e293b', color: 'white' }}>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600' }}>Código</th>
              <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600' }}>Descrição</th>
              <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600' }}>Qtd</th>
              <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600' }}>Valor Unit.</th>
              <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {quoteItems?.flatMap((item, index) => {
              const itemSubitems = subitems?.filter(s => s.quote_item_id === item.id) || [];
              const rows = [
                <tr key={`item-${item.id}`} style={{ backgroundColor: index % 2 === 0 ? '#f8fafc' : 'white' }}>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>{item.product_sku}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '500' }}>{item.product_name}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569', textAlign: 'right' }}>{item.qty}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569', textAlign: 'right' }}>
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', textAlign: 'right' }}>
                    {formatCurrency(item.base_total)}
                  </td>
                </tr>
              ];

              itemSubitems.forEach((subitem) => {
                rows.push(
                  <tr key={subitem.id} style={{ backgroundColor: index % 2 === 0 ? '#f8fafc' : 'white' }}>
                    <td style={{ padding: '8px 16px', paddingLeft: '32px' }}></td>
                    <td style={{ padding: '8px 16px', fontSize: '12px', color: '#64748b', fontStyle: 'italic', paddingLeft: '32px' }}>
                      • {subitem.product_name}
                    </td>
                    <td style={{ padding: '8px 16px', fontSize: '12px', color: '#64748b', textAlign: 'right' }}>{subitem.qty}</td>
                    <td style={{ padding: '8px 16px', fontSize: '12px', color: '#64748b', textAlign: 'right' }}>
                      {formatCurrency(subitem.unit_price)}
                    </td>
                    <td style={{ padding: '8px 16px', fontSize: '12px', color: '#64748b', textAlign: 'right' }}>
                      {formatCurrency(subitem.total_price)}
                    </td>
                  </tr>
                );
              });

              if (itemSubitems.length > 0) {
                rows.push(
                  <tr key={`total-${item.id}`} style={{ backgroundColor: index % 2 === 0 ? '#f8fafc' : 'white' }}>
                    <td colSpan="4" style={{ padding: '8px 16px', fontSize: '12px', color: '#475569', fontWeight: '600', textAlign: 'right' }}>
                      Total do Item:
                    </td>
                    <td style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 'bold', textAlign: 'right' }}>
                      {formatCurrency(item.final_total)}
                    </td>
                  </tr>
                );
              }

              return rows;
            })}
          </tbody>
        </table>
      </div>

      {/* Total */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
        <div style={{ backgroundColor: '#1e293b', color: 'white', padding: '16px 32px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '18px', fontWeight: '600' }}>VALOR TOTAL:</span>
            <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatCurrency(quote?.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {quote?.notes && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>
            Observações
          </h2>
          <p style={{ color: '#64748b', fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0 }}>{quote.notes}</p>
        </div>
      )}

      {/* Payment Condition Details */}
      {paymentCondition && (
        <div style={{ marginBottom: '32px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '8px', textTransform: 'uppercase' }}>
            Condições de Pagamento
          </h2>
          <div style={{ fontSize: '12px', color: '#475569' }}>
            <p style={{ fontWeight: '500', margin: '0 0 4px 0' }}>{paymentCondition.name}</p>
            {paymentCondition.description && (
              <p style={{ color: '#64748b', margin: '0 0 8px 0' }}>{paymentCondition.description}</p>
            )}
            <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              {paymentCondition.installments > 0 && (
                <div>
                  <span style={{ color: '#64748b' }}>Parcelas: </span>
                  <span style={{ fontWeight: '500' }}>{paymentCondition.installments}x</span>
                </div>
              )}
              {paymentCondition.discount_percentage > 0 && (
                <div>
                  <span style={{ color: '#64748b' }}>Desconto: </span>
                  <span style={{ fontWeight: '500', color: '#16a34a' }}>{paymentCondition.discount_percentage}%</span>
                </div>
              )}
              {paymentCondition.interest_percentage > 0 && (
                <div>
                  <span style={{ color: '#64748b' }}>Juros: </span>
                  <span style={{ fontWeight: '500', color: '#d97706' }}>{paymentCondition.interest_percentage}% a.m.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: '2px solid #1e293b', paddingTop: '24px', marginTop: 'auto' }}>
        <div style={{ textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
          <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>
            Este orçamento tem validade até {quote?.validity_date ? format(new Date(quote.validity_date), 'dd/MM/yyyy', { locale: ptBR }) : '___/___/___'}
          </p>
          <p style={{ fontSize: '10px', margin: '8px 0 0 0' }}>Orçamento gerado automaticamente pelo AGFSig ERP</p>
        </div>
      </div>
    </div>
  );
});

QuotePrintTemplate.displayName = 'QuotePrintTemplate';

export default QuotePrintTemplate;