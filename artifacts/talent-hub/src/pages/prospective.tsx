import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
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
  MapPin,
  Briefcase,
  Star,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Search,
  X,
  Plus,
  DollarSign,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { BASE_URL } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProspectiveCandidate {
  teId: string;
  anonymizedHeadline: string;
  roleCategory: string;
  seniority: string;
  location: string;
  topSkills: string[];
  summaryBlurb: string;
  educationLevel: string | null;
  yearsExperienceEstimate: string | null;
  compExpectation: string | null;
  hasExpressedInterest: boolean;
  lastSyncedAt: string;
  screeningDate: string | null;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchProspective(): Promise<ProspectiveCandidate[]> {
  const res = await fetch(`${BASE_URL}api/prospective`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load prospective candidates");
  return res.json();
}

async function expressInterest(teId: string, note?: string) {
  const res = await fetch(`${BASE_URL}api/prospective/${teId}/interest`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) throw new Error("Failed to express interest");
  return res.json();
}

async function withdrawInterest(teId: string) {
  const res = await fetch(`${BASE_URL}api/prospective/${teId}/interest`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to withdraw interest");
  return res.json();
}

async function addProspectiveEntry(data: {
  anonymizedHeadline: string;
  roleCategory: string;
  seniority: string;
  location: string;
  topSkills: string[];
  summaryBlurb: string;
  educationLevel?: string;
  yearsExperienceEstimate?: string;
}) {
  const res = await fetch(`${BASE_URL}api/admin/prospective`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to add entry");
  return res.json();
}

async function deleteProspectiveEntry(teId: string) {
  const res = await fetch(`${BASE_URL}api/admin/prospective/${encodeURIComponent(teId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete entry");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Engineering: "bg-blue-50 text-blue-700 border-blue-200",
  Sales: "bg-orange-50 text-orange-700 border-orange-200",
  Operations: "bg-purple-50 text-purple-700 border-purple-200",
  Product: "bg-teal-50 text-teal-700 border-teal-200",
  Finance: "bg-green-50 text-green-700 border-green-200",
  Marketing: "bg-pink-50 text-pink-700 border-pink-200",
  Executive: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

function seniorityLabel(s: string) {
  return { "C-level": "C-Level", IC: "Individual Contributor" }[s] ?? s;
}

function matchesSearch(c: ProspectiveCandidate, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    c.anonymizedHeadline.toLowerCase().includes(lower) ||
    c.roleCategory.toLowerCase().includes(lower) ||
    c.location.toLowerCase().includes(lower) ||
    c.seniority.toLowerCase().includes(lower) ||
    (c.summaryBlurb?.toLowerCase().includes(lower) ?? false) ||
    c.topSkills.some((s) => s.toLowerCase().includes(lower))
  );
}

// ─── Admin Add Dialog ─────────────────────────────────────────────────────────

const ROLE_CATEGORIES = ["Engineering", "Sales", "Product", "Operations", "Finance", "Marketing", "Executive"];
const SENIORITIES = ["IC", "Manager", "Director", "VP", "C-level"];

function AddProspectiveDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    anonymizedHeadline: "",
    roleCategory: "Engineering",
    seniority: "IC",
    location: "",
    topSkills: "",
    summaryBlurb: "",
    educationLevel: "",
    yearsExperienceEstimate: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      addProspectiveEntry({
        ...form,
        topSkills: form.topSkills.split(",").map((s) => s.trim()).filter(Boolean),
        educationLevel: form.educationLevel || undefined,
        yearsExperienceEstimate: form.yearsExperienceEstimate || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospective"] });
      onClose();
      setForm({
        anonymizedHeadline: "",
        roleCategory: "Engineering",
        seniority: "IC",
        location: "",
        topSkills: "",
        summaryBlurb: "",
        educationLevel: "",
        yearsExperienceEstimate: "",
      });
    },
  });

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Prospective Candidate</DialogTitle>
          <DialogDescription>
            Manually add a candidate to the 1st Screen pipeline. This entry will appear anonymously to founders.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-sm font-medium">Anonymized Headline *</label>
            <Input
              name="anonymizedHeadline"
              required
              value={form.anonymizedHeadline}
              onChange={handle}
              placeholder="Senior Backend Engineer with climate-tech SaaS background"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Role Category *</label>
            <select name="roleCategory" value={form.roleCategory} onChange={handle}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
              {ROLE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Seniority *</label>
            <select name="seniority" value={form.seniority} onChange={handle}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
              {SENIORITIES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Location *</label>
            <Input name="location" required value={form.location} onChange={handle} placeholder="Vancouver, BC" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Years Experience Estimate</label>
            <Input name="yearsExperienceEstimate" value={form.yearsExperienceEstimate} onChange={handle} placeholder="5+ years" />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="text-sm font-medium">Top Skills (comma-separated) *</label>
            <Input name="topSkills" required value={form.topSkills} onChange={handle} placeholder="React, Node.js, AWS, Python" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Education Level</label>
            <Input name="educationLevel" value={form.educationLevel} onChange={handle} placeholder="B.Sc. Computer Science" />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="text-sm font-medium">Summary Blurb *</label>
            <Textarea
              name="summaryBlurb"
              required
              value={form.summaryBlurb}
              onChange={handle}
              rows={4}
              placeholder="Brief anonymized background of the candidate…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.anonymizedHeadline || !form.location || !form.topSkills || !form.summaryBlurb}
          >
            {mutation.isPending ? "Adding…" : "Add Candidate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function ProspectiveCard({
  candidate,
  onExpressInterest,
  isAdmin = false,
}: {
  candidate: ProspectiveCandidate;
  onExpressInterest: (c: ProspectiveCandidate) => void;
  isAdmin?: boolean;
}) {
  const qc = useQueryClient();
  const withdrawMutation = useMutation({
    mutationFn: () => withdrawInterest(candidate.teId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prospective"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteProspectiveEntry(candidate.teId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prospective"] }),
  });

  const isManual = candidate.teId.startsWith("MANUAL-");

  return (
    <div className="bg-card border border-card-border rounded-xl p-6 flex flex-col h-full hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-base leading-snug line-clamp-2">
            {candidate.anonymizedHeadline}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                CATEGORY_COLORS[candidate.roleCategory] ??
                "bg-muted text-muted-foreground border-border"
              }`}
            >
              {candidate.roleCategory}
            </span>
            <span className="text-xs text-muted-foreground">
              {seniorityLabel(candidate.seniority)}
            </span>
          </div>
        </div>
        <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
          1st Screen
        </span>
      </div>

      {/* Location + experience */}
      <div className="flex items-center gap-1.5 text-muted-foreground text-sm mb-1.5">
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{candidate.location}</span>
        {candidate.yearsExperienceEstimate && (
          <>
            <span className="text-border shrink-0">·</span>
            <span className="shrink-0">{candidate.yearsExperienceEstimate}</span>
          </>
        )}
      </div>

      {/* Comp expectation */}
      {candidate.compExpectation && (
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm mb-3">
          <DollarSign className="w-3.5 h-3.5 shrink-0" />
          <span>{candidate.compExpectation}</span>
        </div>
      )}
      {!candidate.compExpectation && <div className="mb-3" />}

      {/* Blurb — fixed 3-line height so all cards reserve the same space */}
      <div className="flex-1 mb-4">
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 min-h-[3.75rem]">
          {candidate.summaryBlurb ?? ""}
        </p>
      </div>

      {/* Skills — one row, max 4 pills */}
      <div className="flex gap-1.5 mb-4 overflow-hidden h-6">
        {candidate.topSkills.slice(0, 4).map((skill) => (
          <Badge key={skill} variant="secondary" className="text-xs font-normal shrink-0">
            {skill}
          </Badge>
        ))}
        {candidate.topSkills.length > 4 && (
          <span className="text-xs text-muted-foreground self-center shrink-0">
            +{candidate.topSkills.length - 4}
          </span>
        )}
      </div>

      {/* CTA — always at bottom */}
      <div className="border-t border-border pt-4 mt-auto space-y-2">
        {candidate.hasExpressedInterest ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Interest expressed
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground text-xs h-7"
              onClick={() => withdrawMutation.mutate()}
              disabled={withdrawMutation.isPending}
            >
              Withdraw
            </Button>
          </div>
        ) : (
          <Button className="w-full" onClick={() => onExpressInterest(candidate)}>
            Express Interest
          </Button>
        )}
        {isAdmin && isManual && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-red-500 hover:text-red-700 hover:bg-red-50 h-7"
            onClick={() => { if (confirm("Remove this entry?")) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}
          >
            Remove entry
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Interest Dialog ──────────────────────────────────────────────────────────

function InterestDialog({
  candidate,
  onClose,
}: {
  candidate: ProspectiveCandidate | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const mutation = useMutation({
    mutationFn: () => expressInterest(candidate!.teId, note || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospective"] });
      onClose();
      setNote("");
    },
  });

  return (
    <Dialog open={!!candidate} onOpenChange={() => { onClose(); setNote(""); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Express Interest</DialogTitle>
          <DialogDescription>
            Let the Active Impact team know you'd like to learn more about this
            candidate. They'll reach out to coordinate next steps.
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
            placeholder="e.g. We're hiring a senior engineer for our climate platform — this profile fits well."
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground text-right">{note.length}/500</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setNote(""); }}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Submitting…" : "Submit Interest"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  "All", "Engineering", "Sales", "Product", "Operations",
  "Finance", "Marketing", "Executive",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Prospective() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const qc = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<ProspectiveCandidate | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const { data: candidates = [], isLoading, error } = useQuery({
    queryKey: ["prospective"],
    queryFn: fetchProspective,
    staleTime: 5 * 60 * 1000,
  });

  const filtered = candidates
    .filter((c) => selectedCategory === "All" || c.roleCategory === selectedCategory)
    .filter((c) => matchesSearch(c, searchQuery));

  const expressedCount = candidates.filter((c) => c.hasExpressedInterest).length;

  // Tally per-category counts for the overview card
  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of candidates) {
      counts[c.roleCategory] = (counts[c.roleCategory] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }));
  }, [candidates]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`${BASE_URL}api/admin/te-sync`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) qc.invalidateQueries({ queryKey: ["prospective"] });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Prospective Talent</h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-xl">
            Candidates at the first screening stage of our pipeline, shown anonymously. These are potential future introductions. Express interest and the Active Impact team will coordinate next steps.
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Entry
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              Sync from TE
            </Button>
          </div>
        )}
      </div>

      {/* Search + category filters */}
      {!isLoading && candidates.length > 0 && (
        <div className="space-y-3">
          {/* Search + Filters button row */}
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by role, location, skill…"
                className="pl-9 pr-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {(searchQuery || selectedCategory !== "All") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setSelectedCategory("All"); }} className="text-muted-foreground">
                <X className="w-3.5 h-3.5 mr-1" /> Clear
              </Button>
            )}
          </div>

          {/* Category pills — no "All" button */}
          <div className="flex flex-wrap gap-2">
            {categoryBreakdown.map((item) => (
              <button
                key={item.category}
                onClick={() =>
                  setSelectedCategory(
                    selectedCategory === item.category ? "All" : item.category
                  )
                }
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  selectedCategory === item.category
                    ? "bg-primary text-white border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {item.category}
                <span className={`ml-1.5 text-xs ${selectedCategory === item.category ? "opacity-80" : "opacity-60"}`}>
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-6 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>Failed to load prospective candidates.</AlertDescription>
        </Alert>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">
            {candidates.length === 0
              ? "No prospective candidates at 1st screen right now"
              : searchQuery
              ? `No results for "${searchQuery}"`
              : `No ${selectedCategory} candidates at this stage`}
          </p>
          <p className="text-sm mt-1">
            {candidates.length === 0
              ? "Check back soon — candidates are added as they progress through screening."
              : "Try adjusting your search or category."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((c) => (
            <ProspectiveCard
              key={c.teId}
              candidate={c}
              onExpressInterest={setSelectedCandidate}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      <InterestDialog
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
      />

      <AddProspectiveDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />
    </div>
  );
}
