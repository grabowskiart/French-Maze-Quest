import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { 
  ArrowLeft, 
  BookOpen, 
  Sparkles, 
  Settings, 
  Loader2,
  Palette,
  Hash,
  MessageCircle,
  Star,
  Zap
} from "lucide-react";
import type { GameSettings, Category, ConjugationPack, QuestionType, ProficiencyLevel } from "@shared/schema";

const iconMap: Record<string, React.ReactNode> = {
  "hand-wave": <MessageCircle className="h-4 w-4" />,
  "palette": <Palette className="h-4 w-4" />,
  "hash": <Hash className="h-4 w-4" />,
  "paw-print": <Star className="h-4 w-4" />,
  "utensils": <Star className="h-4 w-4" />,
  "users": <Star className="h-4 w-4" />,
  "zap": <Zap className="h-4 w-4" />,
  "book-open": <BookOpen className="h-4 w-4" />,
  "heart": <Star className="h-4 w-4" />,
  "star": <Star className="h-4 w-4" />,
  "box": <Star className="h-4 w-4" />,
  "map-pin": <Star className="h-4 w-4" />,
  "tree": <Star className="h-4 w-4" />,
  "user": <Star className="h-4 w-4" />,
  "message-circle": <MessageCircle className="h-4 w-4" />,
  "speech": <MessageCircle className="h-4 w-4" />,
};

export default function Dashboard() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: settings, isLoading: settingsLoading } = useQuery<GameSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: conjugationPacks, isLoading: packsLoading } = useQuery<ConjugationPack[]>({
    queryKey: ["/api/conjugation-packs"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<GameSettings>) => {
      const res = await apiRequest("PATCH", "/api/settings", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved", description: "Your preferences have been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    },
  });

  const toggleCategoryMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/categories/${id}/toggle`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
    },
  });

  const togglePackMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/conjugation-packs/${id}/toggle`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conjugation-packs"] });
    },
  });

  const generateQuestionsMutation = useMutation({
    mutationFn: async (params: { count: number; categoryId?: number; proficiencyLevel: ProficiencyLevel }): Promise<{ generatedCount: number }> => {
      const res = await apiRequest("POST", "/api/questions/generate", params);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Questions generated", description: `Created ${data.generatedCount} new questions.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate questions.", variant: "destructive" });
    },
  });

  const generateConjugationMutation = useMutation({
    mutationFn: async ({ packId, count }: { packId: number; count: number }): Promise<{ generatedCount: number }> => {
      const res = await apiRequest("POST", `/api/conjugation-packs/${packId}/generate`, { count });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Conjugation questions created", description: `Added ${data.generatedCount} new exercises.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate conjugation questions.", variant: "destructive" });
    },
  });

  const questionTypes: { value: QuestionType; label: string; description: string }[] = [
    { value: "mcq", label: "Multiple Choice", description: "Choose from 4 options" },
    { value: "fill", label: "Fill in the Blank", description: "Type the answer" },
    { value: "conjugation", label: "Conjugation", description: "Practice verb forms" },
    { value: "grammar", label: "Grammar", description: "Grammar exercises" },
  ];

  const proficiencyLevels: { value: ProficiencyLevel; label: string; description: string }[] = [
    { value: "beginner", label: "Beginner", description: "Basic vocabulary and simple phrases" },
    { value: "intermediate", label: "Intermediate", description: "Common verbs and grammar" },
    { value: "advanced", label: "Advanced", description: "Complex grammar and vocabulary" },
  ];

  const toggleQuestionType = (type: QuestionType) => {
    if (!settings) return;
    const current = settings.enabledQuestionTypes || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    if (updated.length === 0) {
      toast({ title: "Warning", description: "At least one question type must be enabled.", variant: "destructive" });
      return;
    }
    updateSettingsMutation.mutate({ enabledQuestionTypes: updated });
  };

  const toggleProficiencyLevel = (level: ProficiencyLevel) => {
    if (!settings) return;
    const current = settings.enabledProficiencyLevels || [];
    const updated = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level];
    if (updated.length === 0) {
      toast({ title: "Warning", description: "At least one proficiency level must be enabled.", variant: "destructive" });
      return;
    }
    updateSettingsMutation.mutate({ enabledProficiencyLevels: updated });
  };

  const isLoading = settingsLoading || categoriesLoading || packsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              data-testid="button-back-to-game"
              onClick={() => window.history.length > 1 ? window.history.back() : navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-display font-bold text-foreground">Parent Dashboard</h1>
              <p className="text-sm text-muted-foreground">Configure learning settings</p>
            </div>
          </div>
          <Settings className="h-6 w-6 text-muted-foreground" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Tabs defaultValue="types" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4" data-testid="tabs-dashboard">
            <TabsTrigger value="types" data-testid="tab-question-types">Question Types</TabsTrigger>
            <TabsTrigger value="categories" data-testid="tab-categories">Categories</TabsTrigger>
            <TabsTrigger value="levels" data-testid="tab-levels">Levels</TabsTrigger>
            <TabsTrigger value="verbs" data-testid="tab-verbs">Conjugation</TabsTrigger>
          </TabsList>

          <TabsContent value="types" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Question Types</CardTitle>
                <CardDescription>Choose which types of questions to include in the game</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {questionTypes.map((type) => (
                  <div key={type.value} className="flex items-center justify-between p-3 rounded-md border" data-testid={`toggle-type-${type.value}`}>
                    <div>
                      <p className="font-medium">{type.label}</p>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                    <Switch
                      checked={settings?.enabledQuestionTypes?.includes(type.value) ?? false}
                      onCheckedChange={() => toggleQuestionType(type.value)}
                      data-testid={`switch-type-${type.value}`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Vocabulary Categories</CardTitle>
                <CardDescription>Select which topics to practice</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {categoriesData?.map((category) => (
                    <div key={category.id} className="flex items-center justify-between p-3 rounded-md border" data-testid={`toggle-category-${category.id}`}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-primary/10 text-primary">
                          {iconMap[category.icon || "star"] || <Star className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-medium">{category.displayName}</p>
                          <p className="text-xs text-muted-foreground">{category.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={category.isActive}
                        onCheckedChange={(checked) => toggleCategoryMutation.mutate({ id: category.id, isActive: checked })}
                        data-testid={`switch-category-${category.id}`}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Generate New Questions
                </CardTitle>
                <CardDescription>Use AI to create fresh practice questions</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  onClick={() => generateQuestionsMutation.mutate({ count: 5, proficiencyLevel: "beginner" })}
                  disabled={generateQuestionsMutation.isPending}
                  data-testid="button-generate-beginner"
                >
                  {generateQuestionsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Generate 5 Beginner Questions
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generateQuestionsMutation.mutate({ count: 5, proficiencyLevel: "intermediate" })}
                  disabled={generateQuestionsMutation.isPending}
                  data-testid="button-generate-intermediate"
                >
                  Generate 5 Intermediate Questions
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="levels" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Proficiency Levels</CardTitle>
                <CardDescription>Choose the difficulty levels for questions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {proficiencyLevels.map((level) => (
                  <div key={level.value} className="flex items-center justify-between p-3 rounded-md border" data-testid={`toggle-level-${level.value}`}>
                    <div className="flex items-center gap-3">
                      <Badge variant={level.value === "beginner" ? "default" : level.value === "intermediate" ? "secondary" : "outline"}>
                        {level.label}
                      </Badge>
                      <p className="text-sm text-muted-foreground">{level.description}</p>
                    </div>
                    <Switch
                      checked={settings?.enabledProficiencyLevels?.includes(level.value) ?? false}
                      onCheckedChange={() => toggleProficiencyLevel(level.value)}
                      data-testid={`switch-level-${level.value}`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verbs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Conjugation Packs</CardTitle>
                <CardDescription>Enable or disable verb conjugation practice for specific verbs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {conjugationPacks?.map((pack) => (
                    <div key={pack.id} className="flex items-center justify-between p-3 rounded-md border" data-testid={`toggle-pack-${pack.id}`}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-accent text-accent-foreground">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{pack.verbInfinitive}</p>
                          <p className="text-xs text-muted-foreground">{pack.verbEnglish} (Group {pack.group})</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => generateConjugationMutation.mutate({ packId: pack.id, count: 6 })}
                          disabled={generateConjugationMutation.isPending}
                          data-testid={`button-generate-conj-${pack.id}`}
                        >
                          <Sparkles className="h-3 w-3" />
                        </Button>
                        <Switch
                          checked={pack.isActive}
                          onCheckedChange={(checked) => togglePackMutation.mutate({ id: pack.id, isActive: checked })}
                          data-testid={`switch-pack-${pack.id}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
