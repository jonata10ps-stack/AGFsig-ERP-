import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { project_id, seller_id, seller_email, change_type, message } = await req.json();

    if (!seller_id || !seller_email) {
      return Response.json({ error: 'Missing seller info' }, { status: 400 });
    }

    // Send email notification to seller
    await base44.integrations.Core.SendEmail({
      to: seller_email,
      subject: change_type === 'attachment' 
        ? '📎 Novo arquivo anexado ao projeto' 
        : '📋 Status do projeto foi alterado',
      body: `Olá,\n\n${message}\n\nAcesse o sistema para mais detalhes.\n\nAtenciosamente,\nSistema ERP`
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});