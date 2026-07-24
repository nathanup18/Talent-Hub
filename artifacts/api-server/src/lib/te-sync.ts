// Maps candidates returned by the TE sync bridge (the te-recruit-mcp Cloudflare
// Worker's GET /sync/prospective endpoint) onto te_prospective_cache rows.
// The bridge strips candidate PII before the data reaches this server; this
// module only shapes what's left into the anonymized fields founders see.

export interface BridgeCandidate {
  te_id: string;
  job_id: string | null;
  job_title: string | null;
  stage_name: string;
  added_to_pipeline: string | null;
  person: Record<string, any> | null;
}

export interface ProspectiveCacheRow {
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
  screeningDate: Date | null;
}

const ROLE_RULES: [RegExp, string][] = [
  [/\b(ceo|chief executive|president|managing director|general manager|executive director|founder)\b/i, "Executive"],
  [/\b(cfo|chief financial|finance|financial|accounting|controller|treasurer|investment)\b/i, "Finance"],
  [/\b(cto|chief technology|engineer|engineering|developer|software|hardware|scientist|technical|r&d|data)\b/i, "Engineering"],
  [/\b(cpo|chief product|product|design)\b/i, "Product"],
  [/\b(cmo|chief marketing|marketing|growth|brand|communications|content)\b/i, "Marketing"],
  [/\b(cro|chief revenue|sales|business development|account executive|partnerships|customer success)\b/i, "Sales"],
  [/\b(coo|chief operating|operations|supply chain|logistics|people|talent|hr|program|project|chief of staff)\b/i, "Operations"],
];

export function mapRoleCategory(personTitle: string | null, jobTitle: string | null): string {
  for (const source of [personTitle, jobTitle]) {
    if (!source) continue;
    for (const [pattern, category] of ROLE_RULES) {
      if (pattern.test(source)) return category;
    }
  }
  return "Operations";
}

export function mapSeniority(title: string | null): string {
  if (!title) return "IC";
  if (/\b(chief|ceo|cfo|cto|coo|cmo|cpo|cro|founder|president|partner)\b/i.test(title)) return "C-level";
  if (/\b(vp|vice president|svp|evp)\b/i.test(title)) return "VP";
  if (/\b(director|head of)\b/i.test(title)) return "Director";
  if (/\b(manager|lead)\b/i.test(title)) return "Manager";
  return "IC";
}

function countryLabel(country: any): string | null {
  if (!country?.name) return null;
  return country.alpha_two_code === "US" ? "USA" : String(country.name);
}

export function mapLocation(person: Record<string, any>): string {
  const parts = [person.city, person.state?.name, countryLabel(person.country)].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  return parts.length ? parts.join(", ") : "Not specified";
}

const DEGREE_RANK: Record<string, number> = {
  doctorate: 5,
  masters: 4,
  bachelors: 3,
  associates: 2,
  diploma: 1,
  certificate: 1,
};
const DEGREE_LABEL: Record<string, string> = {
  doctorate: "PhD / Doctorate",
  masters: "Master's",
  bachelors: "Bachelor's",
  associates: "Associate",
  diploma: "Diploma",
  certificate: "Certificate",
};

export function mapEducationLevel(educations: any[] | null | undefined): string | null {
  let best: string | null = null;
  for (const edu of educations ?? []) {
    const degree = String(edu?.degree ?? "").toLowerCase();
    if (DEGREE_RANK[degree] && (!best || DEGREE_RANK[degree] > DEGREE_RANK[best])) {
      best = degree;
    }
  }
  return best ? DEGREE_LABEL[best] : null;
}

export function mapTopSkills(taggings: any[] | null | undefined, max = 8): string[] {
  const skills: string[] = [];
  const seen = new Set<string>();
  for (const t of taggings ?? []) {
    const name = t?.tag?.name;
    if (typeof name !== "string" || !name.trim()) continue;
    const key = name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    skills.push(name.trim());
    if (skills.length >= max) break;
  }
  return skills;
}

export function mapCompExpectation(person: Record<string, any>): string | null {
  const amount = person.desired_compensation;
  if (amount == null || amount === "") return null;
  const num = Number(amount);
  const formatted = Number.isFinite(num) ? `$${num.toLocaleString("en-US")}` : String(amount);
  const type = String(person.desired_compensation_type ?? "");
  const suffix = type.includes("hour") ? " per hour" : type.includes("year") ? " per year" : "";
  return `${formatted}${suffix}`;
}

export function mapBridgeCandidate(c: BridgeCandidate): ProspectiveCacheRow {
  const person = c.person ?? {};
  const title: string | null =
    person.current_position_title ?? person.desired_title ?? c.job_title ?? null;
  const years: number | null =
    typeof person.years_of_experience === "number" ? person.years_of_experience : null;
  const educationLevel = mapEducationLevel(person.educations);

  const blurbParts: string[] = [];
  if (title) blurbParts.push(title);
  if (years) blurbParts.push(`${years} years of experience`);
  if (educationLevel) blurbParts.push(educationLevel);

  return {
    teId: c.te_id,
    anonymizedHeadline: title ?? "Pre-vetted candidate",
    roleCategory: mapRoleCategory(person.current_position_title ?? person.desired_title, c.job_title),
    seniority: mapSeniority(title),
    location: mapLocation(person),
    topSkills: mapTopSkills(person.taggings),
    summaryBlurb: blurbParts.join(" · "),
    educationLevel,
    yearsExperienceEstimate: years != null ? String(years) : null,
    compExpectation: mapCompExpectation(person),
    screeningDate: c.added_to_pipeline ? new Date(c.added_to_pipeline) : null,
  };
}
