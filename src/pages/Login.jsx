import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Lock, Mail, Factory } from 'lucide-react';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { checkAppState } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha email e senha para continuar');
      return;
    }

    try {
      setIsLoading(true);
      await base44.auth.signIn(email, password);
      toast.success('Login realizado com sucesso!');
      await checkAppState(); // Reload auth state 
      navigate('/');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao fazer login: Credenciais inválidas ou erro no servidor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      toast.error('Preencha todos os campos para criar sua conta');
      return;
    }

    try {
      setIsLoading(true);
      await base44.auth.signUp(email, password, { full_name: fullName });
      toast.success('Conta criada com sucesso! Verifique seu e-mail se necessário.');
      setIsSignUp(false); // Volta para o login após cadastrar
    } catch (error) {
      console.error(error);
      toast.error('Erro ao criar conta: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-600/20 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl z-10 relative backdrop-blur-sm">
        <div className="flex justify-center mb-8 h-16 w-16 bg-indigo-600 rounded-2xl items-center mx-auto shadow-lg shadow-indigo-600/30">
          <Factory className="h-8 w-8 text-white" />
        </div>
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">AGF ERP</h1>
          <p className="text-slate-400">
            {isSignUp ? 'Crie sua conta para acessar' : 'Acesse sua conta para continuar'}
          </p>
        </div>

        <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-6">
          {isSignUp && (
            <div className="space-y-2">
              <Label className="text-slate-300">Nome Completo</Label>
              <div className="relative">
                <Input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome"
                  className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500 h-11"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-slate-300">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-5 w-5 text-slate-500" />
              <Input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="pl-10 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500 h-11"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-slate-300">Senha</Label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-500" />
              <Input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-10 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500 h-11"
                required
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-11 shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98]"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {isSignUp ? 'Criando conta...' : 'Validando credenciais...'}
              </>
            ) : (
              isSignUp ? 'Criar Minha Conta' : 'Entrar no Sistema'
            )}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
            >
              {isSignUp ? 'Já tem uma conta? Entrar agora' : 'Ainda não tem conta? Clique aqui'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
