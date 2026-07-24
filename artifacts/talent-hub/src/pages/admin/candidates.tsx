import { useState, useEffect } from "react";
import {
  useListCandidates,
  useCreateCandidate, 
  useUpdateCandidate, 
  useDeleteCandidate,
  getListCandidatesQueryKey,
  AdminCandidate
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Search, Edit2, Trash2, X, Link2, Mail, CheckCircle2, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BASE_URL } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function AdminCandidates() {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<AdminCandidate | null>(null);
  
  const queryClient = useQueryClient();
  
  // Note: For admins, useListCandidates could return AdminCandidate[] 
  // since the backend determines payload based on user role.
  const { data: candidates, isLoading } = useListCandidates({
    search: search || undefined
  });

  const deleteMutation = useDeleteCandidate();
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);

  const handleImportFromTe = async () => {
    if (
      !confirm(
        "Import the current 1st-Screen candidates from Top Echelon into the Talent Pool, and remove the old seed candidates? This replaces unlinked seed rows."
      )
    )
      return;
    setImporting(true);
    try {
      const res = await fetch(`${BASE_URL}api/admin/candidates/import-from-te`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replaceSeed: true }),
      });
      const b = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: "Imported from Top Echelon",
          description: `${b.imported} added, ${b.skipped} already present, ${b.cleared} seed removed.`,
        });
        queryClient.invalidateQueries({ queryKey: getListCandidatesQueryKey() });
      } else {
        toast({ title: "Import failed", description: b.error ?? `HTTP ${res.status}`, variant: "destructive" });
      }
    } finally {
      setImporting(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingCandidate(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (candidate: any) => {
    setEditingCandidate(candidate);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this candidate? This cannot be undone.")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCandidatesQueryKey() });
      }
    });
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCandidate(null);
  };

  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Candidate Management</h1>
          <p className="text-muted-foreground">Add, update, or remove candidates from the talent pool.</p>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search real names, IDs..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={handleImportFromTe} disabled={importing}>
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Import from TE
          </Button>
          <Button onClick={handleOpenAdd}>
            <Plus className="w-4 h-4 mr-2" /> Add Candidate
          </Button>
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
        ) : !candidates || candidates.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            No candidates found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Candidate</th>
                  <th className="px-6 py-4 font-medium">Internal ID</th>
                  <th className="px-6 py-4 font-medium">Role & Level</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Date Added</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {candidates.map((cand: any) => (
                  <tr key={cand.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{cand.realName || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground max-w-[200px] truncate" title={cand.anonymizedHeadline}>
                        {cand.anonymizedHeadline}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{cand.internalId || `CID-${cand.id}`}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>{cand.roleCategory}</div>
                      <div className="text-xs text-muted-foreground">{cand.seniority} • {cand.yearsExperience} yrs</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
                        ${cand.status === 'opted_in' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                        ${cand.status === 'paused' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                        ${cand.status === 'placed' ? 'bg-purple-50 text-purple-700 border-purple-200' : ''}
                        ${cand.status === 'withdrawn' ? 'bg-gray-50 text-gray-700 border-gray-200' : ''}
                      `}>
                        {cand.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-muted-foreground">
                      {format(new Date(cand.dateAdded), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleOpenEdit(cand)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(cand.id)} disabled={deleteMutation.isPending && deleteMutation.variables?.id === cand.id}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <CandidateFormModal 
          candidate={editingCandidate} 
          onClose={closeModal} 
        />
      )}
    </div>
  );
}

interface TeContact {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  currentTitle: string | null;
}
interface ContactResponse {
  teId: string | null;
  linked: boolean;
  contact: TeContact | null;
  error?: string;
}

// Connected record: links the anonymized candidate to a Top Echelon person.
// The real identity/contact is read LIVE from TE (never stored) and used to
// auto-make an introduction. Admin-only; never shown to founders.
function ConnectedRecord({ candidateId }: { candidateId: number }) {
  const { toast } = useToast();
  const [data, setData] = useState<ContactResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teId, setTeId] = useState("");

  const fetchContact = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}api/admin/candidates/${candidateId}/contact`, {
        credentials: "include",
      });
      const body: ContactResponse = await res.json();
      setData(body);
      setTeId(body.teId ?? "");
      return body;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}api/admin/candidates/${candidateId}/contact`, {
          credentials: "include",
        });
        const body: ContactResponse = await res.json();
        if (cancelled) return;
        setData(body);
        setTeId(body.teId ?? "");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  // Save the TE link, then immediately read the live contact back.
  const saveLink = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}api/admin/candidates/${candidateId}/te-link`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teId: teId.trim() || null }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        toast({ title: "Could not save link", description: b.error ?? `HTTP ${res.status}`, variant: "destructive" });
        return;
      }
      const body = await fetchContact();
      if (!teId.trim()) {
        toast({ title: "Link cleared" });
      } else if (body?.error) {
        toast({ title: "Linked, but TE lookup failed", description: body.error, variant: "destructive" });
      } else if (body?.contact?.email) {
        toast({ title: "Linked to Top Echelon", description: body.contact.email });
      } else {
        toast({ title: "Linked", description: "No email on file in TE for this person." });
      }
    } finally {
      setSaving(false);
    }
  };

  const contact = data?.contact ?? null;
  const introReady = !!contact?.email;

  return (
    <div className="md:col-span-2 border-t border-border pt-5 mt-1">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-semibold">Connected record</h3>
        {!loading && data?.linked &&
          (introReady ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
              <CheckCircle2 className="w-3 h-3" /> Intro-ready
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              {data?.error ? "TE lookup failed" : "No email in TE — intro can't auto-send"}
            </span>
          ))}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Link this candidate to their Top Echelon record. Contact details are read live from TE (never stored) and
        used to auto-make the introduction when a founder requests an intro. Never shown to founders.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Top Echelon person ID</label>
            <div className="flex gap-2">
              <Input
                value={teId}
                onChange={(e) => setTeId(e.target.value)}
                placeholder="e.g. f2f0c20d-87e4-49a2-add7-47d12030defc"
              />
              <Button type="button" onClick={saveLink} disabled={saving} className="shrink-0 gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                {teId.trim() ? "Link & preview" : "Clear link"}
              </Button>
            </div>
          </div>

          {data?.linked && data.error && (
            <p className="text-xs text-red-600">Couldn't reach Top Echelon: {data.error}</p>
          )}

          {contact && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Mail className="w-3.5 h-3.5" /> Live from Top Echelon
              </div>
              <div><span className="text-muted-foreground">Name:</span> {contact.fullName ?? "—"}</div>
              <div><span className="text-muted-foreground">Email:</span> {contact.email ?? "—"}</div>
              <div><span className="text-muted-foreground">Phone:</span> {contact.phone ?? "—"}</div>
              {contact.currentTitle && (
                <div><span className="text-muted-foreground">Title:</span> {contact.currentTitle}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CandidateFormModal({ candidate, onClose }: { candidate: any | null, onClose: () => void }) {
  const queryClient = useQueryClient();
  const createMutation = useCreateCandidate();
  const updateMutation = useUpdateCandidate();
  
  const isEditing = !!candidate;

  const [formData, setFormData] = useState({
    internalId: candidate?.internalId || "",
    realName: candidate?.realName || "",
    anonymizedHeadline: candidate?.anonymizedHeadline || "",
    roleCategory: candidate?.roleCategory || "Engineering",
    seniority: candidate?.seniority || "IC",
    yearsExperience: candidate?.yearsExperience || 0,
    location: candidate?.location || "",
    openToRelocation: candidate?.openToRelocation || false,
    compRangeMin: candidate?.compRangeMin || 100000,
    compRangeMax: candidate?.compRangeMax || 150000,
    topSkills: candidate?.topSkills?.join(", ") || "",
    summaryBlurb: candidate?.summaryBlurb || "",
    notableCredentials: candidate?.notableCredentials || "",
    status: candidate?.status || "opted_in",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      topSkills: formData.topSkills.split(",").map((s: string) => s.trim()).filter(Boolean),
    };

    if (isEditing) {
      updateMutation.mutate({ id: candidate.id, data: payload as any }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCandidatesQueryKey() });
          onClose();
        }
      });
    } else {
      createMutation.mutate({ data: payload as any }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCandidatesQueryKey() });
          onClose();
        }
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-card border border-card-border rounded-xl shadow-xl w-full max-w-3xl my-8 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">{isEditing ? "Edit Candidate" : "Add New Candidate"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <form id="candidate-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Internal ID *</label>
              <Input required name="internalId" value={formData.internalId} onChange={handleChange} placeholder="e.g. C-1234" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Real Name *</label>
              <Input required name="realName" value={formData.realName} onChange={handleChange} placeholder="John Doe" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Anonymized Headline *</label>
              <Input required name="anonymizedHeadline" value={formData.anonymizedHeadline} onChange={handleChange} placeholder="Senior Backend Engineer with ex-Stripe experience" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Role Category *</label>
              <select name="roleCategory" value={formData.roleCategory} onChange={handleChange} className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm">
                <option value="Engineering">Engineering</option>
                <option value="Sales">Sales</option>
                <option value="Operations">Operations</option>
                <option value="Product">Product</option>
                <option value="Finance">Finance</option>
                <option value="Marketing">Marketing</option>
                <option value="Executive">Executive</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Seniority *</label>
              <select name="seniority" value={formData.seniority} onChange={handleChange} className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm">
                <option value="IC">IC</option>
                <option value="Manager">Manager</option>
                <option value="Director">Director</option>
                <option value="VP">VP</option>
                <option value="C-level">C-level</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Years Experience *</label>
              <Input required type="number" name="yearsExperience" value={formData.yearsExperience} onChange={handleChange} min={0} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Location *</label>
              <Input required name="location" value={formData.location} onChange={handleChange} placeholder="e.g. Vancouver, BC" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Comp Min ($) *</label>
              <Input required type="number" name="compRangeMin" value={formData.compRangeMin} onChange={handleChange} step={1000} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Comp Max ($) *</label>
              <Input required type="number" name="compRangeMax" value={formData.compRangeMax} onChange={handleChange} step={1000} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Top Skills (comma separated) *</label>
              <Input required name="topSkills" value={formData.topSkills} onChange={handleChange} placeholder="React, Node.js, AWS" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Notable Credentials</label>
              <Input name="notableCredentials" value={formData.notableCredentials} onChange={handleChange} placeholder="Stanford CS, YC Alum" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Summary Blurb *</label>
              <textarea 
                required 
                name="summaryBlurb" 
                value={formData.summaryBlurb} 
                onChange={handleChange} 
                className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-background text-sm"
                placeholder="Candidate background details..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status *</label>
              <select name="status" value={formData.status} onChange={handleChange} className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm">
                <option value="opted_in">Opted In</option>
                <option value="paused">Paused</option>
                <option value="placed">Placed</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 pt-8">
              <input type="checkbox" id="openToRelocation" name="openToRelocation" checked={formData.openToRelocation} onChange={handleChange} className="rounded border-input text-primary h-4 w-4" />
              <label htmlFor="openToRelocation" className="text-sm font-medium">Open to Relocation</label>
            </div>

            {isEditing && candidate?.id != null && <ConnectedRecord candidateId={candidate.id} />}

          </form>
        </div>
        
        <div className="p-6 border-t border-border bg-muted/10 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="candidate-form" disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Candidate"}
          </Button>
        </div>
      </div>
    </div>
  );
}
