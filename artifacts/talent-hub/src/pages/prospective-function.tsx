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
              <div className="bg-card border border-card-border hover:border-primary/50 transition-colors rounded-lg p-5 shadow-sm h-full flex flex-col cursor-pointer group">
                <div className="flex justify-between items-start mb-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {c.roleCategory}
                  </span>
                </div>

                <h3 className="text-lg font-semibold mb-3 group-hover:text-primary transition-colors line-clamp-2">
                  {c.anonymizedHeadline}
                </h3>

                <div className="space-y-2 mb-4 flex-1">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Briefcase className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>
                      {c.seniority} · <span className="font-mono">{c.yearsExperience}</span> yrs exp
                    </span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>{c.location}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-border mt-auto">
                  <div className="flex flex-wrap gap-1.5">
                    {c.topSkills.slice(0, 3).map((skill, idx) => (
                      <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                        {skill}
                      </span>
                    ))}
                    {c.topSkills.length > 3 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                        +{c.topSkills.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
