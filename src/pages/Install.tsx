import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Smartphone, Share2, MoreVertical, Download, Chrome, Home } from "lucide-react";

export default function Install() {
  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold">Instale o App</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Adicione o LemeFinance à sua tela inicial para uma experiência completa
        </p>
      </div>

      <Tabs defaultValue="android" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="android" className="gap-2 text-xs sm:text-sm">
            <Smartphone className="h-4 w-4" />
            Android
          </TabsTrigger>
          <TabsTrigger value="ios" className="gap-2 text-xs sm:text-sm">
            <Smartphone className="h-4 w-4" />
            iOS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="android" className="space-y-4">
          <Card className="border-0 shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Chrome className="h-5 w-5 text-primary" />
                Google Chrome
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Método mais comum no Android</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              <div className="space-y-4">
                {[
                  { step: 1, title: "Abra o menu do Chrome", desc: <>Toque nos três pontos verticais <MoreVertical className="inline h-4 w-4" /> no canto superior direito</> },
                  { step: 2, title: "Adicionar à tela inicial", desc: 'Selecione "Adicionar à tela inicial" ou "Instalar app"' },
                  { step: 3, title: "Confirme a instalação", desc: 'Toque em "Adicionar" ou "Instalar" na mensagem de confirmação' },
                  { step: 4, title: "Pronto!", desc: "O ícone do LemeFinance aparecerá na sua tela inicial" },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex gap-3 sm:gap-4">
                    <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                      {step}
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1 text-sm sm:text-base">{title}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-muted/50 rounded-lg p-3 sm:p-4 border border-border">
                <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                  <Download className="h-4 w-4" />
                  Outros navegadores
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  No Firefox ou Edge, procure pela opção "Adicionar à tela inicial" no menu do navegador (⋮)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ios" className="space-y-4">
          <Card className="border-0 shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Smartphone className="h-5 w-5 text-primary" />
                Safari (iOS)
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Método para iPhone e iPad</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              <div className="space-y-4">
                {[
                  { step: 1, title: "Abra no Safari", desc: "Certifique-se de estar usando o navegador Safari (não funciona no Chrome iOS)" },
                  { step: 2, title: "Toque no botão Compartilhar", desc: <>Toque no ícone de compartilhar <Share2 className="inline h-4 w-4" /> na barra inferior do Safari</> },
                  { step: 3, title: "Adicionar à Tela de Início", desc: <>Role para baixo e selecione "Adicionar à Tela de Início" <Home className="inline h-4 w-4" /></> },
                  { step: 4, title: "Confirme e personalize", desc: 'Você pode editar o nome do app e depois tocar em "Adicionar"' },
                  { step: 5, title: "Pronto!", desc: "O ícone do LemeFinance aparecerá na sua tela inicial" },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex gap-3 sm:gap-4">
                    <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                      {step}
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1 text-sm sm:text-base">{title}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-warning/10 rounded-lg p-3 sm:p-4 border border-warning/20">
                <h4 className="font-semibold mb-2 text-warning text-sm">
                  ⚠️ Importante
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  No iOS, a instalação só funciona através do Safari. Outros navegadores como Chrome não têm essa funcionalidade.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-0 shadow-elegant bg-primary/5">
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-base sm:text-lg">Por que instalar?</h3>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 text-sm text-muted-foreground mt-4">
              <div className="space-y-1">
                <div className="text-2xl">⚡</div>
                <p className="font-medium text-foreground">Mais rápido</p>
                <p className="text-xs sm:text-sm">Acesso instantâneo sem abrir o navegador</p>
              </div>
              <div className="space-y-1">
                <div className="text-2xl">📱</div>
                <p className="font-medium text-foreground">Como um app nativo</p>
                <p className="text-xs sm:text-sm">Funciona em tela cheia sem barras do navegador</p>
              </div>
              <div className="space-y-1">
                <div className="text-2xl">🔔</div>
                <p className="font-medium text-foreground">Notificações</p>
                <p className="text-xs sm:text-sm">Receba lembretes e alertas importantes</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
