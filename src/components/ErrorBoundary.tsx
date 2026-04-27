import { Component, type ReactNode } from "react";
import { Button } from "./ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            Algo deu errado
          </h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Encontramos um erro inesperado. Você pode tentar recarregar a página ou reportar o problema.
          </p>
          {this.state.error && (
            <details className="w-full max-w-2xl mb-6 p-4 bg-muted/50 rounded-lg border border-border/50">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                Detalhes do erro
              </summary>
              <pre className="mt-2 text-xs text-destructive overflow-auto max-h-40 p-2 bg-background rounded">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <div className="flex gap-3">
            <Button onClick={this.handleReset} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Recarregar Página
            </Button>
            <Button variant="outline" onClick={() => window.history.back()}>
              Voltar
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;