import { useState } from "react";
import {
  useListAdminIntroRequests,
  useUpdateIntroRequest,
  getListAdminIntroRequestsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, CheckCircle2, XCircle, Clock, Link as LinkIcon, Info, Briefcase, UserCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Request = NonNullable<ReturnType<typeof useListAdminIntroRequests>["data"]>[number];

function statusBadge(status: string) {
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
          <UserCheck className="w-3 h-3" /> Accepted
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
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
          {status}
        </span>
      );
  }
}

function typeBadge(requestType: string) {
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
}

// Next-step actions available from each pipeline status. The primary action
// advances the request; the secondary either closes it or reopens a closed one.
const NEXT_ACTIONS: Record<
  string,
  { primary?: { status: string; label: string }; secondary?: { status: string; label: string } }
> = {
  requested: {
    primary: { status: "offered", label: "Offer Intro" },
    secondary: { status: "closed", label: "Decline" },
  },
  offered: {
    primary: { status: "intro_made", label: "Mark Accepted" },
    secondary: { status: "closed", label: "Decline" },
  },
  intro_made: {
    primary: { status: "placed", label: "Mark Placed" },
    secondary: { status: "closed", label: "Close" },
  },
  placed: {},
  closed: {
    secondary: { status: "requested", label: "Reopen" },
  },
};

function RequestRow({ req, onAction, isActioning }: { req: Request; onAction: (id: number, status: string) => void; isActioning: boolean }) {
  const isResolved = ["placed", "closed"].includes(req.status);
  const actions = NEXT_ACTIONS[req.status] ?? {};

  return (
    <tr className={`transition-colors hover:bg-muted/30 ${isResolved ? "opacity-70" : ""}`}>
      {/* Founder */}
      <td className="px-5 py-4">
        <div className="font-medium text-foreground text-sm">{req.founderName}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{req.founderEmail}</div>
        {req.founderCompany && (
          <div className="text-xs text-muted-foreground">{req.founderCompany}</div>
        )}
      </td>

      {/* Type */}
      <td className="px-5 py-4">
        {typeBadge((req as any).requestType ?? "intro")}
      </td>

      {/* Candidate */}
      <td className="px-5 py-4">
        <div className="font-medium text-foreground text-sm">{req.candidateRealName}</div>
        <div
          className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate"
          title={req.candidateHeadline}
        >
          {req.candidateHeadline}
        </div>
      </td>

      {/* Date */}
      <td className="px-5 py-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
        {format(new Date(req.requestedAt), "MMM d, yyyy")}
      </td>

      {/* Status */}
      <td className="px-5 py-4">{statusBadge(req.status)}</td>

      {/* Actions */}
      <td className="px-5 py-4">
        {actions.primary || actions.secondary ? (
          <div className="flex items-center gap-2">
            {actions.primary && (
              <Button
                size="sm"
                disabled={isActioning}
                className="h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0"
                onClick={() => onAction(req.id, actions.primary!.status)}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {actions.primary.label}
              </Button>
            )}
            {actions.secondary && (
              <Button
                size="sm"
                variant="outline"
                disabled={isActioning}
                className={`h-8 gap-1.5 ${
                  actions.secondary.status === "closed"
                    ? "text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    : "text-muted-foreground"
                }`}
                onClick={() => onAction(req.id, actions.secondary!.status)}
              >
                {actions.secondary.status === "closed" ? (
                  <XCircle className="w-3.5 h-3.5" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
                {actions.secondary.label}
              </Button>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "requested", label: "Pending" },
  { key: "offered", label: "Offered" },
  { key: "intro_made", label: "Accepted" },
  { key: "placed", label: "Placed" },
  { key: "closed", label: "Declined" },
];

export default function AdminIntroRequests() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("requested");
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useListAdminIntroRequests({
    query: { queryKey: getListAdminIntroRequestsQueryKey() },
  });

  const updateMutation = useUpdateIntroRequest();

  const handleAction = (id: number, status: string) => {
    updateMutation.mutate(
      { id, data: { status: status as any } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAdminIntroRequestsQueryKey() }),
      }
    );
  };

  const filtered = (requests ?? []).filter((r) => {
    const matchesSearch =
      !search ||
      r.candidateRealName.toLowerCase().includes(search.toLowerCase()) ||
      r.founderName.toLowerCase().includes(search.toLowerCase()) ||
      r.founderEmail.toLowerCase().includes(search.toLowerCase()) ||
      (r.founderCompany?.toLowerCase().includes(search.toLowerCase()) ?? false);

    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const countFor = (key: string) =>
    key === "all"
      ? (requests ?? []).length
      : (requests ?? []).filter((r) => r.status === key).length;
  const pendingCount = countFor("requested");

  return (
    <div className="max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">All Requests</h1>
          <p className="text-muted-foreground text-sm">
            Every request across the app — intros, more-info, and prospective interest — from all founders. Accepting notifies the founder that an intro is being coordinated.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search names, emails, companies…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-1 mb-4 border-b border-border">
        {STATUS_FILTERS.map((f) => {
          const count = countFor(f.key);
          const active = statusFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              {count > 0 && (
                <span
                  className={`ml-2 text-xs rounded-full px-1.5 py-0.5 ${
                    f.key === "requested" && count > 0
                      ? "bg-primary text-primary-foreground font-bold"
                      : "text-muted-foreground font-normal"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-lg w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            {statusFilter === "requested" && !search ? (
              <>
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No pending requests</p>
                <p className="text-sm mt-1">All caught up! Switch to "All" to see history.</p>
              </>
            ) : (
              <p>No requests found{search ? ` matching "${search}"` : ""}.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border">
                <tr>
                  <th className="px-5 py-3 font-medium">Founder</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Candidate</th>
                  <th className="px-5 py-3 font-medium">Requested</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((req) => (
                  <RequestRow
                    key={req.id}
                    req={req}
                    onAction={handleAction}
                    isActioning={updateMutation.isPending && updateMutation.variables?.id === req.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
