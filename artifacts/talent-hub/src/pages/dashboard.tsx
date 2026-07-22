import { useState } from "react";
import { Link } from "wouter";
import { useListCandidates } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Briefcase, DollarSign, Filter, X, SlidersHorizontal } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    roleCategory: "",
    seniority: "",
    yearsExpMin: "",
    location: "",
    openToRelocation: false,
  });

  const { data: candidates, isLoading } = useListCandidates({
    search: debouncedSearch || undefined,
    roleCategory: filters.roleCategory || undefined,
    seniority: filters.seniority || undefined,
    yearsExpMin: filters.yearsExpMin ? parseInt(filters.yearsExpMin) : undefined,
    location: filters.location || undefined,
    openToRelocation: filters.openToRelocation ? true : undefined,
  });

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ roleCategory: "", seniority: "", yearsExpMin: "", location: "", openToRelocation: false });
    setSearch("");
  };

  const activeFilterCount =
    (filters.roleCategory ? 1 : 0) +
    (filters.seniority ? 1 : 0) +
    (filters.yearsExpMin ? 1 : 0) +
    (filters.location ? 1 : 0) +
    (filters.openToRelocation ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Talent Pool</h1>
        <p className="text-muted-foreground mt-1 text-sm max-w-xl">
          Pre-vetted candidates from our network. Browse anonymized profiles and request an intro or more information.
        </p>
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

      {/* Filter panel — shown inline below the bar */}
      {showFilters && (
        <div className="bg-card border border-card-border rounded-lg p-5 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Role Category</label>
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

          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox" id="relocation"
              className="h-4 w-4 accent-primary"
              checked={filters.openToRelocation}
              onChange={(e) => handleFilterChange("openToRelocation", e.target.checked)}
            />
            <label htmlFor="relocation" className="text-sm font-medium cursor-pointer">Open to relocation</label>
          </div>
        </div>
      )}

      {/* Candidate Grid */}
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
      ) : candidates?.length === 0 ? (
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
          {candidates?.map((candidate) => (
            <Link key={candidate.id} href={`/candidates/${candidate.id}`}>
              <div className="bg-card border border-card-border hover:border-primary/50 transition-colors rounded-lg p-5 shadow-sm h-full flex flex-col cursor-pointer group">
                <div className="flex justify-between items-start mb-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {candidate.roleCategory}
                  </span>
                  {candidate.status === "placed" && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      Placed
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-semibold mb-3 group-hover:text-primary transition-colors line-clamp-2">
                  {candidate.anonymizedHeadline}
                </h3>

                <div className="space-y-2 mb-4 flex-1">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Briefcase className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>{candidate.seniority} · <span className="font-mono">{candidate.yearsExperience}</span> yrs exp</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>{candidate.location}{candidate.openToRelocation && " (Open to move)"}</span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <DollarSign className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="font-mono">
                      ${(candidate.compRangeMin / 1000).toFixed(0)}k – ${(candidate.compRangeMax / 1000).toFixed(0)}k
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-border mt-auto">
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.topSkills.slice(0, 3).map((skill, idx) => (
                      <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                        {skill}
                      </span>
                    ))}
                    {candidate.topSkills.length > 3 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                        +{candidate.topSkills.length - 3}
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
