import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Clock, ShieldAlert, LogOut, RefreshCcw } from 'lucide-react';

const AccountPendingApproval = () => {
  const { logout, checkAppState } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 px-4 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-md w-full p-8 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 z-10 relative">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-6 rounded-2xl bg-amber-600/20 border border-amber-600/30">
            <Clock className="w-10 h-10 text-amber-500 animate-pulse" />
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-4">Aguardando Aprovação</h1>
          
          <p className="text-slate-400 mb-8 leading-relaxed">
            Sua conta foi criada com sucesso, mas o acesso ao sistema requer a aprovação de um administrador. 
            <br /><br />
            Por favor, entre em contato com o responsável pela sua unidade para liberar seu acesso.
          </p>

          <div className="space-y-4">
            <Button 
              onClick={() => checkAppState()} 
              className="w-full bg-indigo-600 hover:bg-indigo-700 h-11"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Verificar Novamente
            </Button>
            
            <Button 
              onClick={() => logout()} 
              variant="outline" 
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 h-11"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair da Conta
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800">
            <div className="flex items-center justify-center gap-2 text-slate-500 text-xs uppercase tracking-widest">
              <ShieldAlert className="w-4 h-4" />
              <span>Acesso Controlado</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountPendingApproval;
