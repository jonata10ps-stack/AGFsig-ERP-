import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Lock, Mail, Factory, ArrowLeft, ShieldCheck } from 'lucide-react';

export default function Login() {
  const [view, setView] = useState('login'); // 'login', 'signup', 'recover', 'changePassword'
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { checkAppState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Detect recovery flow from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('type') === 'recovery') {
      setView('changePassword');
      toast.info('Link de recuperação validado. Defina sua nova senha agora.');
    }
  }, [location]);

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
      await checkAppState(); 
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
      setView('login');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao criar conta: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecovery = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Digite seu e-mail para receber o link de recuperação');
      return;
    }

    try {
      setIsLoading(true);
      console.log('Solicitando reset de senha para:', email);
      const result = await base44.auth.requestPasswordReset(email);
      console.log('Resposta do Supabase:', result);
      toast.success('Link de recuperação enviado! Verifique sua caixa de entrada e SPAM.');
      setView('login');
    } catch (error) {
      console.error('Erro detalhado no reset:', error);
      let msg = 'Erro ao solicitar recuperação. ';
      if (error.message === 'Rate limit exceeded') msg += 'Muitas tentativas. Tente novamente em 24h.';
      else if (error.status === 429) msg += 'Limite de e-mails atingido pelo servidor.';
      else msg += error.message || 'E-mail pode não estar cadastrado.';
      
      toast.error(msg, { duration: 6000 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    try {
      setIsLoading(true);
      await base44.auth.updatePassword(password);
      toast.success('Senha alterada com sucesso! Você já pode entrar.');
      setView('login');
      // Limpa a URL
      navigate('/login', { replace: true });
    } catch (error) {
      console.error(error);
      toast.error('Erro ao alterar senha: ' + (error.message || 'Link expirado ou inválido'));
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (view === 'changePassword') {
      return (
        <form onSubmit={handleUpdatePassword} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-slate-300">Nova Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-500" />
              <Input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="pl-10 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500 h-11"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Confirmar Nova Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-500" />
              <Input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="pl-10 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500 h-11"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11 shadow-lg shadow-emerald-600/20" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Salvar Nova Senha'}
          </Button>
        </form>
      );
    }

    if (view === 'recover') {
      return (
        <form onSubmit={handleRecovery} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-slate-300">E-mail Cadastrado</Label>
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
          <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-11" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Enviar Link de Recuperação'}
          </Button>
          <div className="text-center">
            <button onClick={() => setView('login')} className="text-slate-400 hover:text-white text-sm flex items-center justify-center mx-auto gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar para o Login
            </button>
          </div>
        </form>
      );
    }

    return (
      <form onSubmit={view === 'signup' ? handleSignUp : handleLogin} className="space-y-6">
        {view === 'signup' && (
          <div className="space-y-2">
            <Label className="text-slate-300">Nome Completo</Label>
            <Input 
              type="text" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome"
              className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 h-11"
              required
            />
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
              className="pl-10 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 h-11"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-slate-300">Senha</Label>
            {view === 'login' && (
              <button 
                type="button" 
                onClick={() => setView('recover')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Esqueci minha senha
              </button>
            )}
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-500" />
            <Input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-10 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 h-11"
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-11 shadow-lg shadow-indigo-600/20" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (view === 'signup' ? 'Criar Minha Conta' : 'Entrar no Sistema')}
        </Button>

        <div className="text-center">
          <button type="button" onClick={() => setView(view === 'signup' ? 'login' : 'signup')} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">
            {view === 'signup' ? 'Já tem uma conta? Entrar agora' : 'Ainda não tem conta? Clique aqui'}
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-600/20 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl z-10 relative backdrop-blur-sm">
        <div className="flex justify-center mb-8 h-16 w-16 bg-indigo-600 rounded-2xl items-center mx-auto shadow-lg shadow-indigo-600/30">
          {view === 'changePassword' ? <ShieldCheck className="h-8 w-8 text-white" /> : <Factory className="h-8 w-8 text-white" />}
        </div>
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">AGF ERP</h1>
          <p className="text-slate-400">
            {view === 'signup' ? 'Crie sua conta para acessar' : 
             view === 'recover' ? 'Recuperação de acesso' : 
             view === 'changePassword' ? 'Defina sua nova senha' : 
             'Acesse sua conta para continuar'}
          </p>
        </div>

        {renderContent()}
      </div>
    </div>
  );
}
