import { useListIntroRequests, getListIntroRequestsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Briefcase, Link as LinkIcon, Clock, CheckCircle2, UserCheck, XCircle } from "lucide-react";

export default function MyRequests() {
  const { data: requests, isLoading } = useListIntroRequests({
    query: {
      queryKey: getListIntroRequestsQueryKey()
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'requested':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"><Clock className="w-3 h-3" /> Requested</span>;
      case 'offered':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"><CheckCircle2 className="w-3 h-3" /> Offered</span>;
      case 'intro_made':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200"><UserCheck className="w-3 h-3" /> Intro Made</span>;
      case 'placed':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200"><Briefcase className="w-3 h-3" /> Placed</span>;
      case 'closed':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200"><XCircle className="w-3 h-3" /> Closed</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">{status}</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">My Intro Requests</h1>
        <p className="text-muted-foreground">Track the status of candidates you want to meet.</p>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg w-full"></div>
            ))}
          </div>
        ) : !requests || requests.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <LinkIcon className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No requests yet</h3>
            <p className="text-muted-foreground mb-6">You haven't requested any intros to candidates.</p>
            <Link href="/dashboard" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
              Browse Talent Pool
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Candidate</th>
                  <th className="px-6 py-4 font-medium">Role Category</th>
                  <th className="px-6 py-4 font-medium">Requested On</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground max-w-[300px] truncate" title={request.candidateHeadline}>
                        {request.candidateHeadline}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-muted-foreground">{request.candidateRoleCategory}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-muted-foreground">
                        {format(new Date(request.requestedAt), "MMM d, yyyy")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(request.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/candidates/${request.candidateId}`}
                        className="text-primary hover:underline font-medium"
                      >
                        View Profile
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
