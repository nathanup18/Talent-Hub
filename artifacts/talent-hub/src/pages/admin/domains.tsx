import { useState } from "react";
import { 
  useListDomains, 
  useAddDomain, 
  useDeleteDomain,
  getListDomainsQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Building2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminDomains() {
  const [newDomain, setNewDomain] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [error, setError] = useState("");
  
  const queryClient = useQueryClient();
  
  const { data: domains, isLoading } = useListDomains({
    query: { queryKey: getListDomainsQueryKey() }
  });

  const addMutation = useAddDomain();
  const deleteMutation = useDeleteDomain();

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newDomain) {
      setError("Domain is required");
      return;
    }

    // Basic domain validation
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(newDomain)) {
      setError("Please enter a valid domain format (e.g., example.com)");
      return;
    }

    addMutation.mutate({
      data: {
        domain: newDomain.toLowerCase(),
        companyName: newCompany || undefined
      }
    }, {
      onSuccess: () => {
        setNewDomain("");
        setNewCompany("");
        queryClient.invalidateQueries({ queryKey: getListDomainsQueryKey() });
      },
      onError: (err: any) => {
        setError(err?.error || "Failed to add domain");
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to remove this domain? Active founders with this domain will not be deleted, but new signups will be blocked.")) {
      return;
    }
    
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDomainsQueryKey() });
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Domain Whitelist</h1>
        <p className="text-muted-foreground">Manage which company email domains are allowed to sign up as founders.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <div className="bg-card border border-card-border rounded-xl shadow-sm p-6 sticky top-24">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> Add New Domain
            </h2>
            
            {error && (
              <Alert variant="destructive" className="mb-4 py-2 px-3">
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Domain *</label>
                <Input 
                  placeholder="company.com" 
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Company Name (Optional)</label>
                <Input 
                  placeholder="Company Inc." 
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full"
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? "Adding..." : "Add to Whitelist"}
              </Button>
            </form>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-8">
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-muted rounded w-full"></div>
                  ))}
                </div>
              </div>
            ) : !domains || domains.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto text-muted mb-4" />
                <p>No domains whitelisted yet.</p>
                <p className="text-sm">Signups are currently blocked for everyone.</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-medium">Domain</th>
                    <th className="px-6 py-4 font-medium">Company</th>
                    <th className="px-6 py-4 font-medium">Added</th>
                    <th className="px-6 py-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {domains.map((domain) => (
                    <tr key={domain.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground">
                        @{domain.domain}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {domain.companyName || "—"}
                      </td>
                      <td className="px-6 py-4 font-mono text-muted-foreground">
                        {format(new Date(domain.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(domain.id)}
                          disabled={deleteMutation.isPending && deleteMutation.variables?.id === domain.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
