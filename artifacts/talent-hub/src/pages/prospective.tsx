import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Briefcase, X, SlidersHorizontal } from "lucide-react";
import { BASE_URL } from "@/lib/api";

interface ProspectiveCandidate {
  id: number;
  anonymizedHeadline: string;
  roleCategory: string;
  seniority: string;
  yearsExperience: number;
  location: string;
  topSkills: string[];
  notableCredentials: string | null;
}

async function fetchProspective(): Promise<ProspectiveCandidate[]> {
  const res = await fetch(`${BASE_URL}api/prospective/candidates`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load prospective candidates");
  return res.json();
}

export default function Prospective() {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    roleCategory: "",
    seniority: "",
    yearsExpMin: "",
    location: "",
  });

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["prospective-all"],
    queryFn: fetchProspective,
    staleTime: 5 * 60 * 1000,
  });

  // Function counts for the pills (from the full set, not the filtered view).
  const byRoleCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of candidates) counts[c.roleCategory] = (counts[c.roleCategory] ?? 0) + 1;
    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [candidates]);

  const handleFilterChange = (key: string, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const clearFilters = () => {
    setFilters({ roleCategory: "", seniority: "", yearsExpMin: "", location: "" });
    setSearch("");
  };

  const activeFilterCount =
    (filters.roleCategory ? 1 : 0) +
    (filters.seniority ? 1 : 0) +
    (filters.yearsExpMin ? 1 : 0) +
    (filters.location ? 1 : 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const minExp = filters.yearsExpMin ? parseInt(filters.yearsExpMin) : 0;
    const loc = filters.location.trim().toLowerCase();
    return candidates.filter((c) => {
      if (filters.roleCategory && c.roleCategory !== filters.roleCategory) return false;
      if (filters.seniority && c.seniority !== filters.seniority) return false;
      if (minExp && c.yearsExperience < minExp) return false;
      if (loc && !c.location.toLowerCase().includes(loc)) return false;
      if (q) {
        const hay = [c.anonymizedHeadline, c.location, ...(c.topSkills || [])]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [candidates, search, filters]);

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Prospective Talent</h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-xl">
            Candidates earlier in our recruiting funnel, shown anonymously. Browse profiles and
            express interest, and the Active Impact team will take it from there.
          </p>
        </div>
      </div>

      {/* Search + Filters bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search roles, skills, locations…"
            className="pl-9 pr-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          onClick={() => setShowFilters(!showFilters)}
          className="shrink-0 gap-2"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 bg-white/20 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {activeFilterCount}
            </span>
          )}
        </Button>
        {(activeFilterCount > 0 || search) && (
          <Button variant="ghost" size="icon" onClick={clearFilters} title="Clear all filters">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Category pills */}
      {byRoleCategory.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {byRoleCategory.map((item) => (
            <button
              key={item.category}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  roleCategory: prev.roleCategory === item.category ? "" : item.category,
                }))
              }
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                filters.roleCategory === item.category
                  ? "bg-primary text-white border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {item.category}
              <span
                className={`ml-1.5 text-xs ${
                  filters.roleCategory === item.category ? "opacity-80" : "opacity-60"
                }`}
              >
                {item.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-card border border-card-border rounded-lg p-5 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Function</label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={filters.roleCategory}
              onChange={(e) => handleFilterChange("roleCategory", e.target.value)}
            >
              <option value="">Any</option>
              <option value="Engineering">Engineering</option>
              <option value="Sales">Sales</option>
              <option value="Operations">Operations</option>
              <option value="Product">Product</option>
              <option value="Finance">Finance</option>
              <option value="Marketing">Marketing</option>
              <option value="Executive">Executive</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Seniority</label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={filters.seniority}
              onChange={(e) => handleFilterChange("seniority", e.target.value)}
            >
              <option value="">Any</option>
              <option value="IC">Individual Contributor</option>
              <option value="Manager">Manager</option>
              <option value="Director">Director</option>
              <option value="VP">VP</option>
              <option value="C-level">C-level</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Min Experience: <span className="font-mono text-foreground">{filters.yearsExpMin || 0}yr</span>
            </label>
            <input
              type="range" min="0" max="20" step="1"
              className="w-full accent-primary mt-1"
              value={filters.yearsExpMin || 0}
              onChange={(e) => handleFilterChange("yearsExpMin", e.target.value === "0" ? "" : e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</label>
            <Input
              placeholder="e.g. Toronto, ON"
              className="h-9"
              value={filters.location}
              onChange={(e) => handleFilterChange("location", e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Candidate grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-card border border-card-border rounded-lg p-6 h-64 animate-pulse">
              <div className="h-6 bg-muted rounded w-3/4 mb-4"></div>
              <div className="space-y-2 mb-6">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
              </div>
              <div className="flex gap-2">
                <div className="h-6 bg-muted rounded w-16"></div>
                <div className="h-6 bg-muted rounded w-16"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-card-border rounded-lg p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No candidates found</h3>
          <p className="text-muted-foreground">Try adjusting your filters or search terms.</p>
          <Button variant="outline" className="mt-6" onClick={clearFilters}>Clear Filters</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((c) => (
            <Link key={c.id} href={`/candidates/${c.id}`}>
              <div className="bg-card border border-card-border hover:border-primary/50 transition-colors rounded-lg p-5 shadow-sm h-full flex flex-col cursor-pointer group">
                <div className="flex justify-between items-start mb-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {c.roleCategory}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-3 group-hover:text-primary transition-colors line-clamp-2">
                  {c.anonymizedHeadline}
                </h3>
                <div className="space-y-2 mb-4 flex-1">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Briefcase className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>{c.seniority} · <span className="font-mono">{c.yearsExperience}</span> yrs exp</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>{c.location}</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-border mt-auto">
                  <div className="flex flex-wrap gap-1.5">
                    {c.topSkills.slice(0, 3).map((skill, idx) => (
                      <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                        {skill}
                      </span>
                    ))}
                    {c.topSkills.length > 3 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                        +{c.topSkills.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
