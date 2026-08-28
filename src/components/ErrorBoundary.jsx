import React from 'react';
import { AlertCircle, RefreshCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500">
              <AlertCircle className="w-8 h-8" />
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-2">Ops! Algo deu errado ao carregar a página</h1>
            <p className="text-slate-400 text-sm mb-6">
              Ocorreu um erro inesperado ao renderizar esta tela. Você pode tentar recarregar a página ou voltar para o início.
            </p>

            {this.state.error?.message && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-6 text-left overflow-auto max-h-32">
                <p className="text-xs font-mono text-red-400 break-words">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                onClick={this.handleReset}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Recarregar Página
              </Button>
              <Button 
                onClick={this.handleGoHome}
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <Home className="w-4 h-4 mr-2" />
                Voltar ao Início
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
