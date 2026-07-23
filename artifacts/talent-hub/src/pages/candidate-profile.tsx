import { useRoute, Link } from "wouter";
import { useState } from "react";
import {
  useGetCandidate,
  useCreateIntroRequest,
  useListIntroRequests,
  getGetCandidateQueryKey,
  getListIntroRequestsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  DollarSign,
  Calendar,
  CheckCircle2,
  GraduationCap,
  MoreHorizontal,
  Info,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { BASE_URL } from "@/lib/api";

export default function CandidateProfile() {
  const [, params] = useRoute("/candidates/:id");
  const id = params?.id ? parseInt(params.id) : 0;

  const queryClient = useQueryClient();
  const [moreInfoOpen, setMoreInfoOpen] = useState(false);
  const [moreInfoNote, setMoreInfoNote] = useState("");

  const { data: candidate, isLoading, isError } = useGetCandidate(id, {
    query: {
      enabled: !!id,
      queryKey: getGetCandidateQueryKey(id),
    },
  });

  const { data: allRequests = [] } = useListIntroRequests({
    query: { queryKey: getListIntroRequestsQueryKey() },
  });

  // Find any active (non-closed) requests for this candidate
  const activeRequests = allRequests.filter(
    (r) => r.candidateId === id && r.status !== "closed"
  );
  const introRequest = activeRequests.find((r) => (r as any).requestType !== "more_info");
  const moreInfoRequest = activeRequests.find((r) => (r as any).requestType === "more_info");

  const introMutation = useCreateIntroRequest();

  const handleRequestIntro = () => {
    if (!id) return;
    introMutation.mutate(
      { data: { candidateId: id, requestType: "intro" } },
      {
        onSuccess: () => {
          queryClient.setQueryData(getGetCandidateQueryKey(id), (old: any) =>
            old ? { ...old, hasRequestedIntro: true } : old
          );
          queryClient.invalidateQueries({ queryKey: getListIntroRequestsQueryKey() });
        },
      }
    );
  };

  const handleRequestMoreInfo = () => {
    if (!id) return;
    introMutation.mutate(
      { data: { candidateId: id, requestType: "more_info", note: moreInfoNote || undefined } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListIntroRequestsQueryKey() });
          setMoreInfoOpen(false);
          setMoreInfoNote("");
        },
      }
    );
  };

  const handleCancel = async (requestId: number) => {
    await fetch(`${BASE_URL}api/intro-requests/${requestId}`, {
      method: "DELETE",
      credentials: "include",
    });
    queryClient.invalidateQueries({ queryKey: getListIntroRequestsQueryKey() });
    queryClient.setQueryData(getGetCandidateQueryKey(id), (old: any) =>
      old ? { ...old, hasRequestedIntro: false } : old
    );
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
        </div>
      </div>
    );
  }

  if (isError || !candidate) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-semibold mb-2">Candidate Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The candidate you're looking for doesn't exist or has been removed.
        </p>
        <Link href="/dashboard" className="text-primary hover:underline">
          Return to Talent Pool
        </Link>
      </div>
    );
  }

  const isPlaced = candidate.status === "placed";
  const hasIntro = !!introRequest;
  const hasMoreInfo = !!moreInfoRequest;
  const hasAnyRequest = hasIntro || hasMoreInfo;

  return (
    <div className="max-w-4xl mx-auto w-full pb-20">
      <Link
        href="/dashboard"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Talent Pool
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
                  {candidate.location}{" "}
                  {candidate.openToRelocation && (
                    <span className="ml-1 text-primary">(Open to relocate)</span>
                  )}
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Added {format(new Date(candidate.dateAdded), "MMM d, yyyy")}
                </div>
              </div>
            </div>

            {/* CTA area — fixed width so both buttons are identical size */}
            <div className="flex-shrink-0 w-full md:w-52 flex flex-col gap-2">
              {isPlaced ? (
                <div className="bg-muted text-muted-foreground rounded-lg px-4 py-2.5 font-medium text-center text-sm border border-border">
                  Candidate already placed
                </div>
              ) : (
                <>
                  {/* Intro */}
                  {hasIntro ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        Intro Requested
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg shrink-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive cursor-pointer"
                            onClick={() => handleCancel(introRequest!.id)}
                          >
                            Cancel intro request
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : (
                    <Button
                      onClick={handleRequestIntro}
                      disabled={introMutation.isPending}
                      className="w-full"
                    >
                      {introMutation.isPending ? "Requesting…" : "Request Intro"}
                    </Button>
                  )}

                  {/* More Info */}
                  {hasMoreInfo ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-2 text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm font-medium">
                        <Info className="w-4 h-4 text-blue-600 shrink-0" />
                        More Info Requested
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg shrink-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive cursor-pointer"
                            onClick={() => handleCancel(moreInfoRequest!.id)}
                          >
                            Cancel more info request
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setMoreInfoOpen(true)}
                      disabled={introMutation.isPending}
                      className="w-full"
                    >
                      <Info className="w-4 h-4 mr-2" />
                      Request More Info
                    </Button>
                  )}
                </>
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
              <div className="font-medium text-lg font-mono">
                {candidate.yearsExperience}{" "}
                <span className="font-sans text-sm font-normal text-muted-foreground">years</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1 flex items-center">
                <DollarSign className="w-4 h-4 mr-1.5" /> Comp Expectation
              </div>
              <div className="font-medium text-lg font-mono">
                ${(candidate.compRangeMin / 1000).toFixed(0)}k – $
                {(candidate.compRangeMax / 1000).toFixed(0)}k
              </div>
            </div>
          </div>

          <div className="mb-10">
            <h3 className="text-xl font-semibold mb-4 border-b border-border pb-2">Summary</h3>
            <div className="prose prose-sm md:prose-base max-w-none text-muted-foreground">
              {candidate.summaryBlurb.split("\n").map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          </div>

          {candidate.notableCredentials && (
            <div className="mb-10">
              <h3 className="text-xl font-semibold mb-4 border-b border-border pb-2">
                Notable Credentials
              </h3>
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
                <div
                  key={idx}
                  className="bg-secondary/5 text-secondary border border-secondary/10 px-4 py-2 rounded-md font-medium text-sm"
                >
                  {skill}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* More Info dialog */}
      <Dialog open={moreInfoOpen} onOpenChange={(o) => { if (!o) { setMoreInfoOpen(false); setMoreInfoNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request More Info</DialogTitle>
            <DialogDescription>
              Let the Active Impact team know what you'd like to learn about this candidate. They'll follow up with more details.
            </DialogDescription>
          </DialogHeader>

          {candidate && (
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="font-medium">{candidate.anonymizedHeadline}</p>
              <p className="text-muted-foreground mt-0.5">
                {candidate.roleCategory} · {candidate.location}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Note <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="e.g. We're looking for someone to lead our climate data platform — curious about their experience with large-scale ML pipelines."
              rows={3}
              value={moreInfoNote}
              onChange={(e) => setMoreInfoNote(e.target.value)}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{moreInfoNote.length}/500</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setMoreInfoOpen(false); setMoreInfoNote(""); }}>
              Cancel
            </Button>
            <Button onClick={handleRequestMoreInfo} disabled={introMutation.isPending}>
              {introMutation.isPending ? "Submitting…" : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
