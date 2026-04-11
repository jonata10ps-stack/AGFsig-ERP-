import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Clock, LogOut, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { navigation } from '@/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function AccessControl({ children, currentPageName }) {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  // Admins have bypass
  if (user?.role === 'admin') {
    return children;
  }

  // 1. Check if user is active
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
            <Button onClick={() => base44.auth.logout()} variant="outline" className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. Check if user is rejected
  if (user?.account_status === 'REJEITADO') {
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
            <Button onClick={() => base44.auth.logout()} variant="outline" className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. Check if user is pending
  if (!user?.account_status || user?.account_status === 'PENDENTE') {
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
            </p>
            <Button onClick={() => base44.auth.logout()} variant="outline" className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 4. MODULE ENFORCEMENT
  const parseModules = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.startsWith('[')) {
      try { return JSON.parse(val); } catch (e) { return []; }
    }
    if (typeof val === 'string') return val.split(',').map(s => s.trim());
    return [];
  };

  const allowedModules = parseModules(user?.allowed_modules).map(m => String(m).toLowerCase());

  const findModuleForPage = (navItems, pageName) => {
    for (const item of navItems) {
      if (item.page === pageName) return item.moduleId;
      if (item.children) {
        const found = findModuleForPage(item.children, pageName);
        if (found) return found;
      }
    }
    return null;
  };

  const requiredModule = findModuleForPage(navigation, currentPageName);

  if (requiredModule && !allowedModules.includes(requiredModule.toLowerCase())) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Acesso Restrito</h2>
            <p className="text-slate-600 mb-6">
              Você não possui permissão para acessar o módulo <strong>{requiredModule}</strong>.
              Dúvidas? Fale com seu gestor.
            </p>
            <Button
              onClick={() => window.location.href = '#/Dashboard'}
              className="w-full bg-indigo-600"
            >
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return children;
}