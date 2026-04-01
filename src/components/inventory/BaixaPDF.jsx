import React from 'react';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';

export function generateBaixaPDF(moveData, productData, warehouseData, costCenterData, managerSignature) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text('REQUISIÇÃO DE BAIXA DE ESTOQUE', 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Data: ${format(new Date(moveData.created_date), 'dd/MM/yyyy HH:mm')}`, 20, 35);
  doc.text(`Nº Movimentação: ${moveData.id.slice(0, 8).toUpperCase()}`, 20, 42);
  
  // Separator line
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 48, 190, 48);
  
  // Product Information
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('INFORMAÇÕES DO PRODUTO', 20, 58);
  
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Código: ${productData?.sku || 'N/A'}`, 20, 68);
  doc.text(`Descrição: ${productData?.name || 'N/A'}`, 20, 75);
  doc.text(`Quantidade: ${moveData.qty} ${productData?.unit || 'UN'}`, 20, 82);
  doc.text(`Armazém: ${warehouseData?.code} - ${warehouseData?.name || 'N/A'}`, 20, 89);
  
  // Separator line
  doc.line(20, 95, 190, 95);
  
  // Cost Center
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('CENTRO DE CUSTOS', 20, 105);
  
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`${costCenterData?.code || 'N/A'} - ${costCenterData?.name || 'N/A'}`, 20, 115);
  
  // Separator line
  doc.line(20, 121, 190, 121);
  
  // Baixa Details
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('MOTIVO DA BAIXA', 20, 131);
  
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Motivo: ${moveData.baixa_motivo || 'N/A'}`, 20, 141);
  
  // Detalhamento (text wrapping)
  doc.text('Detalhamento:', 20, 151);
  const detalhamentoLines = doc.splitTextToSize(
    moveData.baixa_detalhamento || 'Não informado',
    170
  );
  doc.text(detalhamentoLines, 20, 158);
  
  // Separator line
  const yPos = 158 + (detalhamentoLines.length * 7) + 5;
  doc.line(20, yPos, 190, yPos);
  
  // Signature Section
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('ASSINATURA DO GESTOR', 20, yPos + 10);
  
  // Signature box
  const sigBoxY = yPos + 20;
  doc.setDrawColor(100, 100, 100);
  doc.rect(20, sigBoxY, 170, 30);
  
  if (managerSignature) {
    // Add signature image
    doc.addImage(managerSignature, 'PNG', 25, sigBoxY + 5, 160, 20);
  }
  
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text('_________________________________________________', 60, sigBoxY + 40);
  doc.text('Assinatura e Carimbo do Gestor Responsável', 70, sigBoxY + 45);
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Documento gerado automaticamente pelo Sistema ERP Industrial', 105, 280, { align: 'center' });
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, 105, 285, { align: 'center' });
  
  return doc;
}

export function downloadBaixaPDF(moveData, productData, warehouseData, costCenterData, managerSignature) {
  const doc = generateBaixaPDF(moveData, productData, warehouseData, costCenterData, managerSignature);
  doc.save(`Baixa_${moveData.id.slice(0, 8)}_${format(new Date(), 'yyyyMMdd')}.pdf`);
}

export function printBaixaPDF(moveData, productData, warehouseData, costCenterData, managerSignature) {
  const doc = generateBaixaPDF(moveData, productData, warehouseData, costCenterData, managerSignature);
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}