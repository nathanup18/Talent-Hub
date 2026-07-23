import { useListIntroRequests, getListIntroRequestsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  Link as LinkIcon,
  Clock,
  CheckCircle2,
  UserCheck,
  XCircle,
  MoreHorizontal,
  Info,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { BASE_URL } from "@/lib/api";

export default function MyRequests() {
  const queryClient = useQueryClient();
  const { data: requests, isLoading } = useListIntroRequests({
    query: { queryKey: getListIntroRequestsQueryKey() },
  });

  const handleCancel = async (id: number) => {
    // Optimistic removal — remove instantly from the list
    queryClient.setQueryData(getListIntroRequestsQueryKey(), (old: any) =>
      Array.isArray(old) ? old.filter((r: any) => r.id !== id) : old
    );
    // Fire-and-forget the DELETE; refetch in the background to reconcile
    fetch(`${BASE_URL}api/intro-requests/${id}`, {
      method: "DELETE",
      credentials: "include",
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: getListIntroRequestsQueryKey() });
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "requested":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case "offered":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <CheckCircle2 className="w-3 h-3" /> Offered
          </span>
        );
      case "intro_made":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            <UserCheck className="w-3 h-3" /> Intro Made
          </span>
        );
      case "placed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            <Briefcase className="w-3 h-3" /> Placed
          </span>
        );
      case "closed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3 h-3" /> Declined
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            {status}
          </span>
        );
    }
  };

  const getTypeBadge = (requestType: string) => {
    if (requestType === "more_info") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <Info className="w-3 h-3" /> More Info
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
        <LinkIcon className="w-3 h-3" /> Intro
      </span>
    );
  };

  // Show all requests, including admin-declined ones ("closed" = declined by team)
  const sortedRequests = requests ?? [];

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">My Requests</h1>
        <p className="text-muted-foreground">Track intro and more-info requests you've sent.</p>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg w-full"></div>
            ))}
          </div>
        ) : !requests || requests.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <LinkIcon className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No requests yet</h3>
            <p className="text-muted-foreground mb-6">
              You haven't requested any intros or info on candidates.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Browse Talent Pool
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Candidate</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Sent</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedRequests.map((request) => {
                  const isClosed = request.status === "closed";
                  const requestType = (request as any).requestType ?? "intro";
                  return (
                    <tr
                      key={request.id}
                      className={`transition-colors ${isClosed ? "opacity-50" : "hover:bg-muted/30"}`}
                    >
                      <td className="px-6 py-4">
                        <div
                          className="font-medium text-foreground max-w-[280px] truncate"
                          title={request.candidateHeadline}
                        >
                          {request.candidateHeadline}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {request.candidateRoleCategory}
                        </div>
                      </td>
                      <td className="px-6 py-4">{getTypeBadge(requestType)}</td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-muted-foreground">
                          {format(new Date(request.requestedAt), "MMM d, yyyy")}
                        </span>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(request.status)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/candidates/${request.candidateId}?from=my-requests`}
                            className="text-primary hover:underline font-medium text-sm"
                          >
                            View
                          </Link>
                          {!isClosed && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive cursor-pointer"
                                  onClick={() => handleCancel(request.id)}
                                >
                                  Cancel request
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
