import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Briefcase, MapPin } from "lucide-react";
import { BASE_URL } from "@/lib/api";

interface ProspectiveListItem {
  id: number;
  anonymizedHeadline: string;
  roleCategory: string;
  seniority: string;
  yearsExperience: number;
  location: string;
  topSkills: string[];
  notableCredentials: string | null;
}

async function fetchByFunction(fn: string): Promise<ProspectiveListItem[]> {
  const res = await fetch(
    `${BASE_URL}api/prospective/candidates?function=${encodeURIComponent(fn)}`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error("Failed to load candidates");
  return res.json();
}

export default function ProspectiveFunction() {
  const [, params] = useRoute("/prospective/:function");
  const fn = params?.function ? decodeURIComponent(params.function) : "";

  const { data: candidates = [], isLoading, error } = useQuery({
    queryKey: ["prospective-function", fn],
    queryFn: () => fetchByFunction(fn),
    enabled: !!fn,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-6">
      <Link
        href="/prospective"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> All functions
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">{fn}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Prospective candidates in {fn}, shown anonymously. Click a profile for the full details.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Couldn't load candidates. Please try again.</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No candidates in this function.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {candidates.map((c) => (
            <Link key={c.id} href={`/candidates/${c.id}`}>
              <div className="bg-card border border-card-border rounded-xl p-6 flex flex-col h-full hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
                <h3 className="font-semibold text-foreground text-base leading-snug line-clamp-2 mb-2">
                  {c.anonymizedHeadline}
                </h3>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
                  <Briefcase className="w-4 h-4 shrink-0" />
                  <span>
                    {c.seniority} · <span className="font-mono">{c.yearsExperience}</span> yrs
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span className="truncate">{c.location}</span>
                </div>
                {c.notableCredentials && (
                  <p className="text-sm text-foreground/80 line-clamp-2 mb-3">{c.notableCredentials}</p>
                )}
                <div className="mt-auto flex flex-wrap gap-1.5 pt-3 border-t border-border">
                  {c.topSkills.slice(0, 3).map((s, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
