import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TrendingUp, PiggyBank, Shield, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ProfileType = "conservador" | "moderado" | "arrojado";

interface Question {
  id: string;
  question: string;
  options: { value: string; label: string; points: number }[];
}

const questions: Question[] = [
  {
    id: "q1",
    question: "Qual é o seu objetivo principal ao investir?",
    options: [
      { value: "preserve", label: "Preservar meu capital", points: 1 },
      { value: "balance", label: "Equilibrar segurança e crescimento", points: 2 },
      { value: "growth", label: "Maximizar o crescimento", points: 3 },
    ],
  },
  {
    id: "q2",
    question: "Como você reagiria se seus investimentos perdessem 20% do valor?",
    options: [
      { value: "panic", label: "Venderia imediatamente", points: 1 },
      { value: "wait", label: "Esperaria se recuperar", points: 2 },
      { value: "buy", label: "Compraria mais", points: 3 },
    ],
  },
  {
    id: "q3",
    question: "Qual é o prazo do seu investimento?",
    options: [
      { value: "short", label: "Menos de 2 anos", points: 1 },
      { value: "medium", label: "2 a 5 anos", points: 2 },
      { value: "long", label: "Mais de 5 anos", points: 3 },
    ],
  },
  {
    id: "q4",
    question: "Qual percentual do seu patrimônio você pode investir?",
    options: [
      { value: "low", label: "Até 20%", points: 1 },
      { value: "medium", label: "20% a 50%", points: 2 },
      { value: "high", label: "Mais de 50%", points: 3 },
    ],
  },
];

const investments = {
  conservador: [
    { name: "Tesouro Selic", description: "Título público com liquidez diária", risk: "Baixo", return: "CDI", icon: Shield },
    { name: "CDB com garantia do FGC", description: "Certificado de Depósito Bancário", risk: "Baixo", return: "90-100% CDI", icon: Shield },
    { name: "Fundos de Renda Fixa", description: "Diversificação em títulos públicos", risk: "Baixo", return: "CDI+", icon: PiggyBank },
  ],
  moderado: [
    { name: "Tesouro IPCA+", description: "Proteção contra inflação", risk: "Médio", return: "IPCA + 5-6%", icon: TrendingUp },
    { name: "Fundos Multimercado", description: "Mix de renda fixa e variável", risk: "Médio", return: "CDI+ a IPCA+", icon: TrendingUp },
    { name: "Ações Blue Chips", description: "Ações de grandes empresas", risk: "Médio", return: "Variável", icon: TrendingUp },
    { name: "Fundos Imobiliários", description: "Investimento em imóveis", risk: "Médio", return: "6-10% a.a.", icon: PiggyBank },
  ],
  arrojado: [
    { name: "Ações Growth", description: "Empresas de alto crescimento", risk: "Alto", return: "Alto potencial", icon: Zap },
    { name: "Fundos de Ações", description: "Carteira diversificada de ações", risk: "Alto", return: "Variável", icon: Zap },
    { name: "Criptomoedas", description: "Bitcoin e altcoins principais", risk: "Muito Alto", return: "Alto potencial", icon: Zap },
    { name: "Small Caps", description: "Ações de pequenas empresas", risk: "Alto", return: "Alto potencial", icon: TrendingUp },
    { name: "ETFs Internacionais", description: "Exposição a mercados globais", risk: "Alto", return: "Variável", icon: TrendingUp },
  ],
};

export default function Investments() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [profileType, setProfileType] = useState<ProfileType | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);

  const loadProfile = useCallback(async () => {
    if (!user) return;

    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from("investment_profile")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setHasProfile(true);
        setProfileType(data.profile_type as ProfileType);
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast.error("Erro ao carregar perfil de investimentos");
    } finally {
      setLoadingProfile(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleAnswer = (value: string) => {
    setAnswers({ ...answers, [questions[currentQuestion].id]: value });
  };

  const handleNext = () => {
    if (!answers[questions[currentQuestion].id]) {
      toast.error("Por favor, selecione uma opção antes de continuar");
      return;
    }

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      calculateProfile();
    }
  };

  const calculateProfile = async () => {
    setLoading(true);
    try {
      let totalPoints = 0;
      questions.forEach((q) => {
        const answer = answers[q.id];
        const option = q.options.find((o) => o.value === answer);
        if (option) totalPoints += option.points;
      });

      const avgPoints = totalPoints / questions.length;
      let profile: ProfileType;
      
      if (avgPoints <= 1.5) {
        profile = "conservador";
      } else if (avgPoints <= 2.5) {
        profile = "moderado";
      } else {
        profile = "arrojado";
      }

      const { error } = await supabase
        .from("investment_profile")
        .upsert({
          user_id: user?.id,
          profile_type: profile,
          quiz_responses: answers,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setProfileType(profile);
      setHasProfile(true);

      toast.success(`Perfil definido! Seu perfil de investidor é: ${profile}`);
    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast.error("Erro ao salvar perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleRetakeQuiz = () => {
    setHasProfile(false);
    setProfileType(null);
    setAnswers({});
    setCurrentQuestion(0);
  };

  const getRiskColor = useCallback((risk: string) => {
    switch (risk) {
      case "Baixo": return "bg-success/10 text-success border-success/20";
      case "Médio": return "bg-warning/10 text-warning border-warning/20";
      case "Alto": case "Muito Alto": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "";
    }
  }, []);

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
      
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Investimentos</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Descubra seu perfil e recomendações personalizadas
          </p>
        </div>

        {loadingProfile ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                <p className="text-sm text-muted-foreground">Carregando...</p>
              </div>
            </CardContent>
          </Card>
        ) : !hasProfile ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">
                Quiz de Perfil de Investidor
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Pergunta {currentQuestion + 1} de {questions.length}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="mb-4">
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-medium mb-4">
                  {questions[currentQuestion].question}
                </h3>

                <RadioGroup
                  value={answers[questions[currentQuestion].id]}
                  onValueChange={handleAnswer}
                  className="space-y-3"
                >
                  {questions[currentQuestion].options.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label
                        htmlFor={option.value}
                        className="text-sm sm:text-base cursor-pointer flex-1"
                      >
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>

                <div className="flex gap-2 pt-4">
                  {currentQuestion > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => setCurrentQuestion(currentQuestion - 1)}
                    >
                      Voltar
                    </Button>
                  )}
                  <Button onClick={handleNext} disabled={loading} className="flex-1">
                    {currentQuestion === questions.length - 1
                      ? loading
                        ? "Calculando..."
                        : "Finalizar"
                      : "Próxima"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg sm:text-xl">Seu Perfil</CardTitle>
                    <CardDescription className="text-xs sm:text-sm mt-1">
                      Baseado nas suas respostas
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleRetakeQuiz}>
                    Refazer Quiz
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-base sm:text-lg px-3 sm:px-4 py-1.5 sm:py-2 capitalize">
                    {profileType}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
                Investimentos Recomendados
              </h2>
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                {profileType && investments[profileType].map((investment, index) => {
                  const Icon = investment.icon;
                  return (
                    <Card key={index} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                              <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                              {investment.name}
                            </CardTitle>
                            <CardDescription className="text-xs sm:text-sm mt-1">
                              {investment.description}
                            </CardDescription>
                          </div>
                          <Badge
                            variant="outline"
                            className={`${getRiskColor(investment.risk)} text-xs whitespace-nowrap`}
                          >
                            {investment.risk}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm text-muted-foreground">
                            Retorno esperado:
                          </span>
                          <span className="text-xs sm:text-sm font-medium">
                            {investment.return}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <Card className="bg-muted/50 border-primary/20">
              <CardContent className="pt-4 sm:pt-6">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  <strong>Importante:</strong> As recomendações são baseadas no seu perfil de risco.
                  Sempre busque orientação de um profissional certificado antes de investir.
                  Rentabilidades passadas não garantem resultados futuros.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
    </div>
  );
}
