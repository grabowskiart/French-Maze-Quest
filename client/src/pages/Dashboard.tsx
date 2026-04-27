import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Zap,
  RotateCcw,
  Plus
} from "lucide-react";
import type { GameSettings, Category, ConjugationPack, QuestionType, ProficiencyLevel, Tense } from "@shared/schema";
import { StatsPanel } from "@/components/dashboard/StatsPanel";
import {
  addProfile,
  clearSavedRun,
  hasSavedRun,
  loadProfiles,
  removeProfile,
  renameProfile,
  MAX_PROFILES,
  type ChildProfile,
} from "@/lib/saveGame";
import { Pencil, Trash2, UserRound, Users } from "lucide-react";

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
  const [generatingLevel, setGeneratingLevel] = useState<ProficiencyLevel | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetSaveTargetId, setResetSaveTargetId] = useState<string | null>(null);
  const [showAddVerbDialog, setShowAddVerbDialog] = useState(false);
  const [newVerbInput, setNewVerbInput] = useState("");
  const [profileList, setProfileList] = useState<ChildProfile[]>(() => loadProfiles());
  const [savedRunByProfile, setSavedRunByProfile] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const p of loadProfiles()) initial[p.id] = hasSavedRun(p.id);
    return initial;
  });
  const [newProfileName, setNewProfileName] = useState("");
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState("");
  const [removingProfileId, setRemovingProfileId] = useState<string | null>(null);

  const refreshProfiles = () => {
    const latest = loadProfiles();
    setProfileList(latest);
    const next: Record<string, boolean> = {};
    for (const p of latest) next[p.id] = hasSavedRun(p.id);
    setSavedRunByProfile(next);
  };

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
      setGeneratingLevel(params.proficiencyLevel);
      const res = await apiRequest("POST", "/api/questions/generate", params);
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratingLevel(null);
      toast({ title: "Questions generated", description: `Created ${data.generatedCount} new questions.` });
    },
    onError: () => {
      setGeneratingLevel(null);
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

  const generateNewVerbsMutation = useMutation({
    mutationFn: async (count: number): Promise<{ generatedCount: number }> => {
      const res = await apiRequest("POST", "/api/conjugation-packs/generate", { count });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conjugation-packs"] });
      toast({ title: "New verbs added", description: `Added ${data.generatedCount} new verb conjugation packs.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate new verbs.", variant: "destructive" });
    },
  });

  const addSingleVerbMutation = useMutation({
    mutationFn: async (verb: string): Promise<{ verbInfinitive: string | null; questionsGenerated: number; alreadyExists: boolean }> => {
      const res = await apiRequest("POST", "/api/conjugation-packs/add-verb", { verb });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conjugation-packs"] });
      setShowAddVerbDialog(false);
      setNewVerbInput("");
      if (data.alreadyExists) {
        toast({
          title: "Verb already exists",
          description: `"${data.verbInfinitive}" is already in your conjugation packs.`,
        });
      } else {
        toast({
          title: "Verb added",
          description: `Added "${data.verbInfinitive}" with ${data.questionsGenerated} conjugation questions.`,
        });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add the verb. Please try a different spelling.", variant: "destructive" });
    },
  });

  const resetStatsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stats/reset");
      return res.json();
    },
    onSuccess: () => {
      setShowResetConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Statistics reset", description: "All question streaks and answer history have been cleared." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reset statistics.", variant: "destructive" });
    },
  });

  const handleResetSavedRun = (profileId: string) => {
    const profile = profileList.find((p) => p.id === profileId);
    clearSavedRun(profileId);
    refreshProfiles();
    setResetSaveTargetId(null);
    toast({
      title: "Saved adventure cleared",
      description: profile
        ? `${profile.name}'s in-progress dungeon run has been cleared.`
        : "The saved run has been cleared.",
    });
  };

  const handleAddProfile = () => {
    const trimmed = newProfileName.trim();
    if (!trimmed) return;
    const result = addProfile(trimmed);
    if (result.error === "limit") {
      toast({
        title: "Profile limit reached",
        description: `You can have up to ${MAX_PROFILES} profiles.`,
        variant: "destructive",
      });
      return;
    }
    if (result.error === "duplicate") {
      toast({
        title: "Name already used",
        description: "Pick a different name for this profile.",
        variant: "destructive",
      });
      return;
    }
    if (result.error === "empty" || !result.profile) {
      return;
    }
    setNewProfileName("");
    refreshProfiles();
    toast({
      title: "Profile added",
      description: `${result.profile.name} can now play with their own saved adventure.`,
    });
  };

  const startEditProfile = (profile: ChildProfile) => {
    setEditingProfileId(profile.id);
    setEditingProfileName(profile.name);
  };

  const cancelEditProfile = () => {
    setEditingProfileId(null);
    setEditingProfileName("");
  };

  const handleRenameProfile = () => {
    if (!editingProfileId) return;
    const result = renameProfile(editingProfileId, editingProfileName);
    if (result.error === "duplicate") {
      toast({
        title: "Name already used",
        description: "Pick a different name for this profile.",
        variant: "destructive",
      });
      return;
    }
    if (result.error === "not_found") {
      toast({
        title: "Profile not found",
        description: "That profile no longer exists.",
        variant: "destructive",
      });
      cancelEditProfile();
      refreshProfiles();
      return;
    }
    if (result.error === "empty" || !result.profile) {
      return;
    }
    cancelEditProfile();
    refreshProfiles();
    toast({
      title: "Profile renamed",
      description: `Updated to ${result.profile.name}.`,
    });
  };

  const handleRemoveProfile = (profile: ChildProfile) => {
    removeProfile(profile.id);
    setRemovingProfileId(null);
    if (editingProfileId === profile.id) cancelEditProfile();
    refreshProfiles();
    toast({
      title: "Profile removed",
      description: `${profile.name} and their saved adventure have been deleted.`,
    });
  };

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

  const tenseOptions: { value: Tense; label: string; description: string }[] = [
    { value: "present", label: "Présent", description: "Present tense (je parle, tu parles…)" },
    { value: "imparfait", label: "Imparfait", description: "Past continuous (je parlais…)" },
    { value: "passé_composé", label: "Passé Composé", description: "Compound past (j'ai parlé…)" },
    { value: "futur", label: "Futur", description: "Simple future (je parlerai…)" },
  ];

  const toggleTense = (tense: Tense) => {
    if (!settings) return;
    const current = settings.enabledTenses ?? ["present", "imparfait", "passé_composé", "futur"];
    const updated = current.includes(tense)
      ? current.filter((t) => t !== tense)
      : [...current, tense];
    if (updated.length === 0) {
      toast({ title: "Warning", description: "At least one tense must be enabled.", variant: "destructive" });
      return;
    }
    updateSettingsMutation.mutate({ enabledTenses: updated });
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
                  {generatingLevel === "beginner" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Generate 5 Beginner Questions
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generateQuestionsMutation.mutate({ count: 5, proficiencyLevel: "intermediate" })}
                  disabled={generateQuestionsMutation.isPending}
                  data-testid="button-generate-intermediate"
                >
                  {generatingLevel === "intermediate" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
                <CardTitle>Tenses to Practice</CardTitle>
                <CardDescription>Choose which verb tenses to include in conjugation questions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {tenseOptions.map((tense) => {
                  const enabled = settings?.enabledTenses?.includes(tense.value) ?? true;
                  return (
                    <div
                      key={tense.value}
                      className="flex items-center justify-between p-3 rounded-md border"
                      data-testid={`toggle-tense-${tense.value}`}
                    >
                      <div>
                        <p className="font-medium">{tense.label}</p>
                        <p className="text-sm text-muted-foreground">{tense.description}</p>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={() => toggleTense(tense.value)}
                        data-testid={`switch-tense-${tense.value}`}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Add New Verbs
                </CardTitle>
                <CardDescription>Generate new verb conjugation packs using AI (ordered by frequency of usage)</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setShowAddVerbDialog(true)}
                  data-testid="button-open-add-single-verb"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add a Specific Verb
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generateNewVerbsMutation.mutate(3)}
                  disabled={generateNewVerbsMutation.isPending}
                  data-testid="button-generate-verbs"
                >
                  {generateNewVerbsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add 3 New Verbs
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generateNewVerbsMutation.mutate(5)}
                  disabled={generateNewVerbsMutation.isPending}
                  data-testid="button-generate-verbs-5"
                >
                  {generateNewVerbsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add 5 New Verbs
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conjugation Packs ({conjugationPacks?.length || 0} verbs)</CardTitle>
                <CardDescription>Enable or disable verb conjugation practice for specific verbs (sorted alphabetically)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {conjugationPacks
                    ?.slice()
                    .sort((a, b) => a.verbInfinitive.localeCompare(b.verbInfinitive, "fr", { sensitivity: "base" }))
                    .map((pack) => (
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-destructive" />
              Reset Statistics
            </CardTitle>
            <CardDescription>Clear all question streaks, answer counts, and progress tracking. This will reset the spaced repetition system so all questions are treated as new.</CardDescription>
          </CardHeader>
          <CardContent>
            {showResetConfirm ? (
              <div className="flex items-center gap-3 p-3 rounded-md border border-destructive/50 bg-destructive/5">
                <p className="text-sm flex-1">Are you sure? This cannot be undone.</p>
                <Button
                  variant="destructive"
                  onClick={() => resetStatsMutation.mutate()}
                  disabled={resetStatsMutation.isPending}
                  data-testid="button-confirm-reset-stats"
                >
                  {resetStatsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Yes, Reset
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowResetConfirm(false)}
                  data-testid="button-cancel-reset-stats"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowResetConfirm(true)}
                data-testid="button-reset-stats"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset All Statistics
              </Button>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-child-profiles">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Child Profiles
            </CardTitle>
            <CardDescription>
              Add a profile for each child so siblings can play without overwriting each other's saved adventure. Each profile has its own in-progress dungeon run. You can have up to {MAX_PROFILES} profiles.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profileList.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-profiles-dashboard">
                No profiles yet. Add one below to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {profileList.map((profile) => {
                  const isEditing = editingProfileId === profile.id;
                  const isRemoving = removingProfileId === profile.id;
                  const isResetting = resetSaveTargetId === profile.id;
                  const profileHasSave = Boolean(savedRunByProfile[profile.id]);
                  return (
                    <div
                      key={profile.id}
                      className="rounded-md border p-3 space-y-2"
                      data-testid={`row-profile-${profile.id}`}
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="p-2 rounded-md bg-primary/10 text-primary">
                            <UserRound className="h-4 w-4" />
                          </div>
                          {isEditing ? (
                            <Input
                              autoFocus
                              value={editingProfileName}
                              onChange={(e) => setEditingProfileName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleRenameProfile();
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  cancelEditProfile();
                                }
                              }}
                              className="max-w-xs"
                              data-testid={`input-rename-profile-${profile.id}`}
                            />
                          ) : (
                            <div className="min-w-0">
                              <p className="font-medium truncate" data-testid={`text-profile-name-${profile.id}`}>
                                {profile.name}
                              </p>
                              <p className="text-xs text-muted-foreground" data-testid={`text-profile-save-status-${profile.id}`}>
                                {profileHasSave ? "Has a saved adventure" : "No saved adventure yet"}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                onClick={handleRenameProfile}
                                disabled={!editingProfileName.trim()}
                                data-testid={`button-save-rename-${profile.id}`}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEditProfile}
                                data-testid={`button-cancel-rename-${profile.id}`}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEditProfile(profile)}
                                data-testid={`button-edit-profile-${profile.id}`}
                              >
                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                Rename
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setResetSaveTargetId(profile.id)}
                                disabled={!profileHasSave}
                                data-testid={`button-reset-saved-run-${profile.id}`}
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                Reset Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRemovingProfileId(profile.id)}
                                data-testid={`button-remove-profile-${profile.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" />
                                Remove
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      {isResetting && (
                        <div
                          className="flex items-center gap-3 p-3 rounded-md border border-destructive/50 bg-destructive/5"
                          data-testid={`confirm-reset-saved-run-${profile.id}`}
                        >
                          <p className="text-sm flex-1">
                            Clear {profile.name}'s saved adventure? Their current progress will be lost.
                          </p>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleResetSavedRun(profile.id)}
                            data-testid={`button-confirm-reset-saved-run-${profile.id}`}
                          >
                            Yes, Clear
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setResetSaveTargetId(null)}
                            data-testid={`button-cancel-reset-saved-run-${profile.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                      {isRemoving && (
                        <div
                          className="flex items-center gap-3 p-3 rounded-md border border-destructive/50 bg-destructive/5"
                          data-testid={`confirm-remove-profile-${profile.id}`}
                        >
                          <p className="text-sm flex-1">
                            Remove {profile.name}? Their saved adventure will also be deleted.
                          </p>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveProfile(profile)}
                            data-testid={`button-confirm-remove-profile-${profile.id}`}
                          >
                            Yes, Remove
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRemovingProfileId(null)}
                            data-testid={`button-cancel-remove-profile-${profile.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">Add a new profile</p>
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddProfile();
                }}
              >
                <Input
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder="Child's name"
                  maxLength={30}
                  className="max-w-xs"
                  disabled={profileList.length >= MAX_PROFILES}
                  data-testid="input-new-profile-name"
                />
                <Button
                  type="submit"
                  disabled={!newProfileName.trim() || profileList.length >= MAX_PROFILES}
                  data-testid="button-add-profile"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Profile
                </Button>
              </form>
              {profileList.length >= MAX_PROFILES && (
                <p className="text-xs text-muted-foreground" data-testid="text-profile-limit">
                  Profile limit reached ({MAX_PROFILES}). Remove one to add a new child.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <StatsPanel />
      </main>

      <Dialog open={showAddVerbDialog} onOpenChange={(open) => {
        if (!addSingleVerbMutation.isPending) {
          setShowAddVerbDialog(open);
          if (!open) setNewVerbInput("");
        }
      }}>
        <DialogContent data-testid="dialog-add-single-verb">
          <DialogHeader>
            <DialogTitle>Add a Specific Verb</DialogTitle>
            <DialogDescription>
              Type a verb in French (e.g., "manger") or English (e.g., "to eat"). AI will identify the verb and create a complete conjugation pack with all tenses.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = newVerbInput.trim();
              if (trimmed && !addSingleVerbMutation.isPending) {
                addSingleVerbMutation.mutate(trimmed);
              }
            }}
            className="space-y-4"
          >
            <Input
              autoFocus
              placeholder="e.g., manger or to eat"
              value={newVerbInput}
              onChange={(e) => setNewVerbInput(e.target.value)}
              disabled={addSingleVerbMutation.isPending}
              data-testid="input-new-verb"
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddVerbDialog(false);
                  setNewVerbInput("");
                }}
                disabled={addSingleVerbMutation.isPending}
                data-testid="button-cancel-add-verb"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newVerbInput.trim() || addSingleVerbMutation.isPending}
                data-testid="button-submit-add-verb"
              >
                {addSingleVerbMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Verb
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
