import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { BarChart3, Target, CheckCircle2, XCircle, TrendingUp, AlertCircle, Users } from "lucide-react";
import type { StatsResponse } from "@shared/schema";
import { loadProfiles, type ChildProfile } from "@/lib/saveGame";

const TYPE_LABELS: Record<string, string> = {
  mcq: "MCQ",
  fill: "Fill-in",
  conjugation: "Conjugation",
  grammar: "Grammar",
};

const ALL_VALUE = "__all__";

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

interface StatsPanelProps {
  profiles?: ChildProfile[];
}

export function StatsPanel({ profiles: profilesProp }: StatsPanelProps = {}) {
  const [profiles, setProfiles] = useState<ChildProfile[]>(
    () => profilesProp ?? loadProfiles(),
  );
  const [selectedProfileId, setSelectedProfileId] = useState<string>(ALL_VALUE);

  useEffect(() => {
    if (profilesProp) {
      setProfiles(profilesProp);
    }
  }, [profilesProp]);

  useEffect(() => {
    if (profilesProp) return;
    const refresh = () => setProfiles(loadProfiles());
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith("french-maze:")) refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", handleStorage);
    };
  }, [profilesProp]);

  useEffect(() => {
    if (
      selectedProfileId !== ALL_VALUE &&
      !profiles.some((p) => p.id === selectedProfileId)
    ) {
      setSelectedProfileId(ALL_VALUE);
    }
  }, [profiles, selectedProfileId]);

  const queryKey = useMemo<readonly unknown[]>(
    () =>
      selectedProfileId === ALL_VALUE
        ? ["/api/stats"]
        : ["/api/stats", selectedProfileId],
    [selectedProfileId],
  );

  const { data: stats, isLoading, isError } = useQuery<StatsResponse>({
    queryKey,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const activeProfileLabel =
    selectedProfileId === ALL_VALUE
      ? "All children (combined)"
      : profiles.find((p) => p.id === selectedProfileId)?.name ?? "Selected profile";

  const profileSelector = profiles.length > 0 ? (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3 mt-3">
      <Label htmlFor="stats-profile-select" className="text-xs text-muted-foreground flex items-center gap-1">
        <Users className="h-3.5 w-3.5" />
        Showing stats for
      </Label>
      <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
        <SelectTrigger
          id="stats-profile-select"
          className="h-8 w-full sm:w-56"
          data-testid="select-stats-profile"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE} data-testid="option-stats-profile-all">
            All children (combined)
          </SelectItem>
          {profiles.map((p) => (
            <SelectItem
              key={p.id}
              value={p.id}
              data-testid={`option-stats-profile-${p.id}`}
            >
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ) : null;

  if (isLoading) {
    return (
      <Card data-testid="card-stats">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Answer Statistics
          </CardTitle>
          <CardDescription>Loading statistics…</CardDescription>
          {profileSelector}
        </CardHeader>
        <CardContent>
          <div className="h-32 rounded-md bg-muted animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !stats) {
    return (
      <Card data-testid="card-stats">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Answer Statistics
          </CardTitle>
          <CardDescription>Couldn't load statistics. Please refresh the page to try again.</CardDescription>
          {profileSelector}
        </CardHeader>
      </Card>
    );
  }

  const { summary, byCategory, needsPractice } = stats;

  const chartData = byCategory
    .filter((c) => c.totalAnswers > 0)
    .map((c) => ({
      name: c.categoryName.length > 14 ? c.categoryName.slice(0, 13) + "…" : c.categoryName,
      fullName: c.categoryName,
      Correct: c.totalCorrect,
      Incorrect: c.totalIncorrect,
    }));

  const hasData = summary.totalAnswers > 0;

  return (
    <Card data-testid="card-stats">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Answer Statistics
        </CardTitle>
        <CardDescription>
          See how <span data-testid="text-stats-active-profile">{activeProfileLabel}</span> is progressing. Questions that have been answered correctly are de-prioritized by the spaced repetition system, so they appear less often.
        </CardDescription>
        {profileSelector}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            icon={<Target className="h-4 w-4 text-primary" />}
            label="Total Answers"
            value={summary.totalAnswers.toString()}
            subtitle={`${summary.attemptedQuestions}/${summary.totalQuestions} questions seen`}
            testId="stat-total-answers"
          />
          <SummaryCard
            icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
            label="Correct"
            value={summary.totalCorrect.toString()}
            subtitle={hasData ? `${formatPercent(summary.accuracy)} accuracy` : "—"}
            testId="stat-correct"
          />
          <SummaryCard
            icon={<XCircle className="h-4 w-4 text-red-500" />}
            label="Incorrect"
            value={summary.totalIncorrect.toString()}
            subtitle={hasData ? `${formatPercent(1 - summary.accuracy)} of attempts` : "—"}
            testId="stat-incorrect"
          />
          <SummaryCard
            icon={<TrendingUp className="h-4 w-4 text-amber-500" />}
            label="Mastered"
            value={summary.masteredQuestions.toString()}
            subtitle="Streak ≥ 3"
            testId="stat-mastered"
          />
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Answers by Category</h3>
          {chartData.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="empty-chart">
              No questions answered yet. Play a few rounds to see results here.
            </div>
          ) : (
            <div className="h-64 w-full" data-testid="chart-category-stats">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="name"
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                    height={50}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelFormatter={(_label, payload) => {
                      const item = payload?.[0]?.payload as { fullName?: string } | undefined;
                      return item?.fullName ?? "";
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="Correct" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Incorrect" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Needs More Practice
          </h3>
          {needsPractice.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="empty-needs-practice">
              {hasData
                ? "Great work! No questions are currently struggling."
                : "Once you start playing, struggling questions will appear here."}
            </div>
          ) : (
            <ul className="space-y-2" data-testid="list-needs-practice">
              {needsPractice.map((q) => (
                <li
                  key={q.id}
                  className="rounded-md border bg-card p-3 flex flex-col sm:flex-row sm:items-center gap-2"
                  data-testid={`needs-practice-${q.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" title={q.question}>{q.question}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[q.type] ?? q.type}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{q.categoryName}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground" data-testid={`needs-practice-attempts-${q.id}`}>
                      {q.timesCorrect}/{q.timesAnswered} correct
                    </span>
                    <span
                      className={`font-semibold ${q.accuracy < 0.34 ? "text-red-500" : q.accuracy < 0.67 ? "text-amber-500" : "text-yellow-500"}`}
                      data-testid={`needs-practice-accuracy-${q.id}`}
                    >
                      {formatPercent(q.accuracy)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle: string;
  testId: string;
}

function SummaryCard({ icon, label, value, subtitle, testId }: SummaryCardProps) {
  return (
    <div className="rounded-md border bg-card p-3" data-testid={testId}>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold font-display mt-1">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}
