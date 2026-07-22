import { useRoute, Link } from "wouter";
import { 
  useGetCandidate, 
  useCreateIntroRequest, 
  getGetCandidateQueryKey,
  getListIntroRequestsQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Briefcase, MapPin, DollarSign, Calendar, CheckCircle2, GraduationCap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function CandidateProfile() {
  const [, params] = useRoute("/candidates/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  
  const queryClient = useQueryClient();
  const { data: candidate, isLoading, isError } = useGetCandidate(id, {
    query: {
      enabled: !!id,
      queryKey: getGetCandidateQueryKey(id)
    }
  });

  const introMutation = useCreateIntroRequest();

  const handleRequestIntro = () => {
    if (!id) return;
    introMutation.mutate({ data: { candidateId: id } }, {
      onSuccess: () => {
        // Optimistically update the candidate's hasRequestedIntro flag
        queryClient.setQueryData(getGetCandidateQueryKey(id), (old: any) => 
          old ? { ...old, hasRequestedIntro: true } : old
        );
        queryClient.invalidateQueries({ queryKey: getListIntroRequestsQueryKey() });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="animate-pulse max-w-4xl mx-auto w-full">
        <div className="h-8 bg-muted rounded w-24 mb-8"></div>
        <div className="bg-card border border-card-border rounded-xl p-8 mb-6">
          <div className="h-10 bg-muted rounded w-3/4 mb-6"></div>
          <div className="h-4 bg-muted rounded w-1/4 mb-10"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
            <div className="h-16 bg-muted rounded"></div>
            <div className="h-16 bg-muted rounded"></div>
            <div className="h-16 bg-muted rounded"></div>
            <div className="h-16 bg-muted rounded"></div>
          </div>
          <div className="space-y-4">
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !candidate) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-semibold mb-2">Candidate Not Found</h2>
        <p className="text-muted-foreground mb-6">The candidate you're looking for doesn't exist or has been removed.</p>
        <Link href="/dashboard" className="text-primary hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full pb-20">
      <Link href="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Discover
      </Link>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="p-8 md:p-10 border-b border-border">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary mb-4">
                {candidate.roleCategory}
              </div>
              <h1 className="text-3xl font-bold leading-tight mb-4 text-foreground">
                {candidate.anonymizedHeadline}
              </h1>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  {candidate.location} {candidate.openToRelocation && <span className="ml-1 text-primary">(Open to relocate)</span>}
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Added {format(new Date(candidate.dateAdded), "MMM d, yyyy")}
                </div>
              </div>
            </div>

            <div className="flex-shrink-0">
              {candidate.hasRequestedIntro ? (
                <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-6 py-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="font-medium">Intro Requested</div>
                    <div className="text-xs opacity-80">Our team will be in touch shortly.</div>
                  </div>
                </div>
              ) : candidate.status === 'placed' ? (
                <div className="bg-muted text-muted-foreground rounded-lg px-6 py-4 font-medium text-center border border-border">
                  Candidate already placed
                </div>
              ) : (
                <Button 
                  size="lg" 
                  className="w-full md:w-auto px-8"
                  onClick={handleRequestIntro}
                  disabled={introMutation.isPending}
                >
                  {introMutation.isPending ? "Requesting..." : "Request Intro"}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="p-8 md:p-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            <div>
              <div className="text-sm text-muted-foreground mb-1 flex items-center">
                <Briefcase className="w-4 h-4 mr-1.5" /> Seniority
              </div>
              <div className="font-medium text-lg">{candidate.seniority}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1 flex items-center">
                <Calendar className="w-4 h-4 mr-1.5" /> Experience
              </div>
              <div className="font-medium text-lg font-mono">{candidate.yearsExperience} <span className="font-sans text-sm font-normal text-muted-foreground">years</span></div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1 flex items-center">
                <DollarSign className="w-4 h-4 mr-1.5" /> Comp Expectation
              </div>
              <div className="font-medium text-lg font-mono">
                ${(candidate.compRangeMin / 1000).toFixed(0)}k - ${(candidate.compRangeMax / 1000).toFixed(0)}k
              </div>
            </div>
          </div>

          <div className="mb-10">
            <h3 className="text-xl font-semibold mb-4 border-b border-border pb-2">Summary</h3>
            <div className="prose prose-sm md:prose-base max-w-none text-muted-foreground">
              {candidate.summaryBlurb.split('\n').map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          </div>

          {candidate.notableCredentials && (
            <div className="mb-10">
              <h3 className="text-xl font-semibold mb-4 border-b border-border pb-2">Notable Credentials</h3>
              <div className="flex items-start gap-3 bg-muted/50 p-4 rounded-lg">
                <GraduationCap className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-foreground">{candidate.notableCredentials}</p>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xl font-semibold mb-4 border-b border-border pb-2">Top Skills</h3>
            <div className="flex flex-wrap gap-2">
              {candidate.topSkills.map((skill, idx) => (
                <div key={idx} className="bg-secondary/5 text-secondary border border-secondary/10 px-4 py-2 rounded-md font-medium text-sm">
                  {skill}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
