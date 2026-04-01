import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AccessControl({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        console.error('User not authenticated');
      } finally {
        setLoading(false);
      }
    };
    checkAccess();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  // Allow admins full access
  if (user?.role === 'admin') {
    return children;
  }

  // Check if user is inactive
  if (user?.active === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-slate-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Conta Inativa</h2>
            <p className="text-slate-600 mb-6">
              Sua conta foi desativada. Entre em contato com o administrador para mais informações.
            </p>
            <Button
              onClick={() => base44.auth.logout()}
              variant="outline"
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if regular user is approved
  const isApproved = user?.account_status === 'APROVADO';
  const isPending = !user?.account_status || user?.account_status === 'PENDENTE';
  const isRejected = user?.account_status === 'REJEITADO';

  if (isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Aguardando Aprovação</h2>
            <p className="text-slate-600 mb-6">
              Seu acesso está pendente de aprovação por um administrador. 
              Você receberá um email quando seu acesso for liberado.
            </p>
            <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-slate-600 mb-1">
                <strong>Usuário:</strong> {user?.full_name || 'Sem nome'}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Email:</strong> {user?.email}
              </p>
            </div>
            <Button
              onClick={() => base44.auth.logout()}
              variant="outline"
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isRejected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Acesso Negado</h2>
            <p className="text-slate-600 mb-6">
              Seu acesso a este sistema foi negado. Entre em contato com o administrador para mais informações.
            </p>
            <Button
              onClick={() => base44.auth.logout()}
              variant="outline"
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is approved, show normal content
  return children;
}