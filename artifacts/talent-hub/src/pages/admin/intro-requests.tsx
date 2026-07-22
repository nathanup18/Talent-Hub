import { useState } from "react";
import { 
  useListAdminIntroRequests, 
  useUpdateIntroRequest,
  getListAdminIntroRequestsQueryKey,
  AdminIntroRequestStatus
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function AdminIntroRequests() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  
  const { data: requests, isLoading } = useListAdminIntroRequests({
    query: { queryKey: getListAdminIntroRequestsQueryKey() }
  });

  const updateMutation = useUpdateIntroRequest();

  const handleStatusChange = (id: number, status: string) => {
    updateMutation.mutate({ 
      id, 
      data: { status: status as AdminIntroRequestStatus } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminIntroRequestsQueryKey() });
      }
    });
  };

  const filteredRequests = requests?.filter(r => 
    r.candidateRealName.toLowerCase().includes(search.toLowerCase()) ||
    r.founderName.toLowerCase().includes(search.toLowerCase()) ||
    r.founderCompany?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Intro Requests Queue</h1>
          <p className="text-muted-foreground">Manage and track all founder-candidate introductions.</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search names, companies..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-muted rounded w-full"></div>
              ))}
            </div>
          </div>
        ) : !filteredRequests || filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            No intro requests found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Founder</th>
                  <th className="px-6 py-4 font-medium">Candidate</th>
                  <th className="px-6 py-4 font-medium">Requested On</th>
                  <th className="px-6 py-4 font-medium">Last Updated</th>
                  <th className="px-6 py-4 font-medium">Status Workflow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{req.founderName}</div>
                      <div className="text-xs text-muted-foreground">{req.founderCompany}</div>
                      <div className="text-xs text-muted-foreground">{req.founderEmail}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{req.candidateRealName}</div>
                      <div className="text-xs text-muted-foreground max-w-[200px] truncate" title={req.candidateHeadline}>
                        {req.candidateHeadline}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-muted-foreground">
                        {format(new Date(req.requestedAt), "MMM d, yyyy")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-muted-foreground">
                        {format(new Date(req.updatedAt), "MMM d")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        className={`h-9 px-3 py-1 text-sm rounded-md border font-medium focus:outline-none focus:ring-2 focus:ring-primary
                          ${req.status === 'requested' ? 'bg-blue-50 border-blue-200 text-blue-800' : ''}
                          ${req.status === 'offered' ? 'bg-amber-50 border-amber-200 text-amber-800' : ''}
                          ${req.status === 'intro_made' ? 'bg-green-50 border-green-200 text-green-800' : ''}
                          ${req.status === 'placed' ? 'bg-purple-50 border-purple-200 text-purple-800' : ''}
                          ${req.status === 'closed' ? 'bg-gray-100 border-gray-200 text-gray-800' : ''}
                        `}
                        value={req.status}
                        onChange={(e) => handleStatusChange(req.id, e.target.value)}
                        disabled={updateMutation.isPending && updateMutation.variables?.id === req.id}
                      >
                        <option value="requested">Requested</option>
                        <option value="offered">Offered</option>
                        <option value="intro_made">Intro Made</option>
                        <option value="placed">Placed</option>
                        <option value="closed">Closed</option>
                      </select>
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
