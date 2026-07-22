import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useListCandidates, useGetCandidateBreakdown } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Briefcase, DollarSign, Filter, X } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);

  const [filters, setFilters] = useState({
    roleCategory: "",
    seniority: "",
    yearsExpMin: "",
    location: "",
    openToRelocation: false,
  });

  const [showFilters, setShowFilters] = useState(false);

  const { data: candidates, isLoading } = useListCandidates({
    search: debouncedSearch || undefined,
    roleCategory: filters.roleCategory || undefined,
    seniority: filters.seniority || undefined,
    yearsExpMin: filters.yearsExpMin ? parseInt(filters.yearsExpMin) : undefined,
    location: filters.location || undefined,
    openToRelocation: filters.openToRelocation ? true : undefined,
  });

  const { data: breakdown } = useGetCandidateBreakdown();

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      roleCategory: "",
      seniority: "",
      yearsExpMin: "",
      location: "",
      openToRelocation: false,
    });
    setSearch("");
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== "" && v !== false) || search !== "";

  const jumpToCategory = (category: string) => {
    setFilters(prev => ({ ...prev, roleCategory: category }));
    setSearch("");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Stats Bar */}
      <div className="bg-card border border-card-border rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Talent Pool Overview</h2>
        <div className="flex flex-wrap gap-6 items-center">
          {/* Total — always black */}
          <div className="bg-primary/10 rounded-lg p-4 min-w-[140px]">
            <div className="text-sm text-primary font-medium mb-1">Total Candidates</div>
            <div className="text-3xl font-mono font-semibold text-foreground">
              {breakdown?.total ?? 0}
            </div>
          </div>

          {/* Per-category segments — click to filter */}
          <div className="flex-1 flex gap-3 overflow-x-auto pb-2 no-scrollbar flex-wrap">
            {breakdown?.byRoleCategory?.map((item) => (
              <button
                key={item.category}
                onClick={() => jumpToCategory(item.category)}
                className={`flex-shrink-0 rounded-lg px-4 py-3 min-w-[110px] text-left transition-all border ${
                  filters.roleCategory === item.category
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-muted border-border hover:border-primary/50 hover:bg-primary/5"
                }`}
              >
                <div className={`text-xs mb-1 font-medium ${
                  filters.roleCategory === item.category ? "text-white/80" : "text-muted-foreground"
                }`}>
                  {item.category}
                </div>
                <div className={`text-xl font-mono font-semibold ${
                  filters.roleCategory === item.category ? "text-white" : "text-foreground"
                }`}>
                  {item.count}
                </div>
              </button>
            ))}
          </div>
        </div>
        {filters.roleCategory && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Showing <strong className="text-foreground">{filters.roleCategory}</strong>
            </span>
            <button
              onClick={() => setFilters(prev => ({ ...prev, roleCategory: "" }))}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Mobile Filter Toggle */}
        <div className="w-full flex lg:hidden gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search roles, skills..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>

        {/* Filters Sidebar */}
        <div className={`w-full lg:w-64 flex-shrink-0 bg-card border border-card-border rounded-lg p-5 shadow-sm space-y-6 ${showFilters ? "block" : "hidden lg:block"}`}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filters
            </h3>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground flex items-center">
                <X className="w-3 h-3 mr-1" /> Clear
              </button>
            )}
          </div>

          <div className="hidden lg:block space-y-2">
            <label className="text-sm font-medium">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Keywords..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Role Category</label>
            <select
              className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={filters.roleCategory}
              onChange={(e) => handleFilterChange("roleCategory", e.target.value)}
            >
              <option value="">Any Role</option>
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
            <label className="text-sm font-medium">Seniority</label>
            <select
              className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={filters.seniority}
              onChange={(e) => handleFilterChange("seniority", e.target.value)}
            >
              <option value="">Any Seniority</option>
              <option value="IC">Individual Contributor</option>
              <option value="Manager">Manager</option>
              <option value="Director">Director</option>
              <option value="VP">VP</option>
              <option value="C-level">C-level</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Min Years Experience: <span className="font-mono">{filters.yearsExpMin || 0}</span>
            </label>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              className="w-full accent-primary"
              value={filters.yearsExpMin || 0}
              onChange={(e) =>
                handleFilterChange("yearsExpMin", e.target.value === "0" ? "" : e.target.value)
              }
            />
            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <span>0</span>
              <span>20+</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Location</label>
            <Input
              placeholder="e.g. Toronto, ON"
              value={filters.location}
              onChange={(e) => handleFilterChange("location", e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="relocation"
              className="rounded border-input text-primary focus:ring-primary h-4 w-4 accent-primary"
              checked={filters.openToRelocation}
              onChange={(e) => handleFilterChange("openToRelocation", e.target.checked)}
            />
            <label htmlFor="relocation" className="text-sm font-medium cursor-pointer">
              Open to relocation
            </label>
          </div>
        </div>

        {/* Candidate Grid */}
        <div className="flex-1">
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
              <p className="text-muted-foreground">
                Try adjusting your filters or search terms to find more candidates.
              </p>
              <Button variant="outline" className="mt-6" onClick={clearFilters}>
                Clear Filters
              </Button>
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
                        <span>
                          {candidate.seniority} •{" "}
                          <span className="font-mono">{candidate.yearsExperience}</span> yrs exp
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>
                          {candidate.location}{" "}
                          {candidate.openToRelocation && "(Open to move)"}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <DollarSign className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span className="font-mono">
                          ${(candidate.compRangeMin / 1000).toFixed(0)}k –{" "}
                          ${(candidate.compRangeMax / 1000).toFixed(0)}k
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border mt-auto">
                      <div className="flex flex-wrap gap-1.5">
                        {candidate.topSkills.slice(0, 3).map((skill, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground"
                          >
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
      </div>
    </div>
  );
}
