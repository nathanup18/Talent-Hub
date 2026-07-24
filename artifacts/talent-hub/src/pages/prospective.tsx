import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, ChevronRight, Sparkles } from "lucide-react";
import { BASE_URL } from "@/lib/api";

interface FunctionCount {
  roleCategory: string;
  count: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  Engineering: "bg-blue-50 text-blue-700 border-blue-200",
  Sales: "bg-orange-50 text-orange-700 border-orange-200",
  Operations: "bg-purple-50 text-purple-700 border-purple-200",
  Product: "bg-teal-50 text-teal-700 border-teal-200",
  Finance: "bg-green-50 text-green-700 border-green-200",
  Marketing: "bg-pink-50 text-pink-700 border-pink-200",
  Executive: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

async function fetchFunctions(): Promise<FunctionCount[]> {
  const res = await fetch(`${BASE_URL}api/prospective/functions`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load functions");
  return res.json();
}

export default function Prospective() {
  const { data: functions = [], isLoading, error } = useQuery({
    queryKey: ["prospective-functions"],
    queryFn: fetchFunctions,
    staleTime: 5 * 60 * 1000,
  });

  const total = functions.reduce((sum, f) => sum + f.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" /> Prospective Talent
        </h1>
        <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
          Candidates earlier in our recruiting funnel, shown anonymously and organized by function.
          Choose a function to browse profiles, then express interest and the Active Impact team will
          take it from there.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Couldn't load prospective talent. Please try again.</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : functions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No prospective candidates yet.
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {total} candidate{total === 1 ? "" : "s"} across {functions.length} function
            {functions.length === 1 ? "" : "s"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {functions.map((f) => (
              <Link key={f.roleCategory} href={`/prospective/${encodeURIComponent(f.roleCategory)}`}>
                <div className="group bg-card border border-card-border rounded-xl p-6 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer flex items-center justify-between">
                  <div>
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full border font-medium mb-3 ${
                        CATEGORY_COLORS[f.roleCategory] ?? "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {f.roleCategory}
                    </span>
                    <div className="flex items-center gap-1.5 text-foreground">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-2xl font-semibold">{f.count}</span>
                      <span className="text-sm text-muted-foreground">
                        candidate{f.count === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
