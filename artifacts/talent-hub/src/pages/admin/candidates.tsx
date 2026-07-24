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
import { Plus, Search, Edit2, Trash2, X, Link2, Mail, CheckCircle2, Loader2 } from "lucide-react";
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

interface CandidateContact {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  teId: string | null;
  source: string;
}

// Private "connected record": the real identity behind the anonymized candidate,
// used to auto-make an introduction. Admin-only; never shown to founders.
function ConnectedRecord({ candidateId }: { candidateId: number }) {
  const { toast } = useToast();
  const [contact, setContact] = useState<CandidateContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", linkedin: "", teId: "" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BASE_URL}api/admin/candidates/${candidateId}/contact`, {
          credentials: "include",
        });
        const data = res.ok ? await res.json() : null;
        if (cancelled) return;
        setContact(data);
        if (data) {
          setForm({
            fullName: data.fullName ?? "",
            email: data.email ?? "",
            phone: data.phone ?? "",
            linkedin: data.linkedin ?? "",
            teId: data.teId ?? "",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}api/admin/candidates/${candidateId}/contact`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName || null,
          email: form.email || null,
          phone: form.phone || null,
          linkedin: form.linkedin || null,
          teId: form.teId || null,
        }),
      });
      if (res.ok) {
        setContact(await res.json());
        toast({ title: "Connected record saved" });
      } else {
        const b = await res.json().catch(() => ({}));
        toast({ title: "Could not save", description: b.error ?? `HTTP ${res.status}`, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const linkTe = async () => {
    if (!form.teId.trim()) {
      toast({ title: "Enter a Top Echelon ID first", variant: "destructive" });
      return;
    }
    setLinking(true);
    try {
      const res = await fetch(`${BASE_URL}api/admin/candidates/${candidateId}/link-te`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teId: form.teId.trim() }),
      });
      const b = await res.json().catch(() => ({}));
      if (res.ok) {
        setContact(b);
        setForm({
          fullName: b.fullName ?? "",
          email: b.email ?? "",
          phone: b.phone ?? "",
          linkedin: b.linkedin ?? "",
          teId: b.teId ?? "",
        });
        toast({ title: "Pulled from Top Echelon", description: b.email ?? "No email on file in TE." });
      } else {
        toast({ title: "TE lookup failed", description: b.error ?? `HTTP ${res.status}`, variant: "destructive" });
      }
    } finally {
      setLinking(false);
    }
  };

  const introReady = !!contact?.email;

  return (
    <div className="md:col-span-2 border-t border-border pt-5 mt-1">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-semibold">Connected record</h3>
        {!loading &&
          (introReady ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
              <CheckCircle2 className="w-3 h-3" /> Intro-ready
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              No email — intro can't auto-send
            </span>
          ))}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Private. Never shown to founders. Used to auto-make the introduction when a founder requests an intro.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Real name</label>
            <Input
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="Defaults to the candidate's real name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Email (for the intro)</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="candidate@email.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Phone</label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">LinkedIn</label>
            <Input
              value={form.linkedin}
              onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Top Echelon ID</label>
            <div className="flex gap-2">
              <Input
                value={form.teId}
                onChange={(e) => setForm((f) => ({ ...f, teId: e.target.value }))}
                placeholder="TE person id — pull name/email/phone automatically"
              />
              <Button type="button" variant="outline" onClick={linkTe} disabled={linking} className="shrink-0 gap-1.5">
                {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Pull from TE
              </Button>
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="button" onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Save connected record
            </Button>
          </div>
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
