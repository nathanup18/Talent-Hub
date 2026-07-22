import { useGetAdminStats } from "@workspace/api-client-react";
import { Users, Link as LinkIcon, Briefcase, Handshake } from "lucide-react";
import { Link } from "wouter";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminStats();

  const cards = [
    {
      title: "Total Candidates",
      value: stats?.totalCandidates || 0,
      icon: Users,
      link: "/admin/candidates",
      color: "text-blue-600",
      bg: "bg-blue-100"
    },
    {
      title: "Candidates Offered",
      value: stats?.candidatesOffered || 0,
      icon: Handshake,
      link: "/admin/candidates?status=placed", // just conceptual
      color: "text-amber-600",
      bg: "bg-amber-100"
    },
    {
      title: "Intros Made",
      value: stats?.introsMade || 0,
      icon: LinkIcon,
      link: "/admin/intro-requests",
      color: "text-green-600",
      bg: "bg-green-100"
    },
    {
      title: "Placements",
      value: stats?.placements || 0,
      icon: Briefcase,
      link: "/admin/intro-requests",
      color: "text-purple-600",
      bg: "bg-purple-100"
    }
  ];

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Platform overview and quick actions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card, i) => (
          <Link key={i} href={card.link}>
            <div className="bg-card border border-card-border hover:border-primary/50 transition-colors rounded-xl p-6 shadow-sm cursor-pointer group h-full">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg ${card.bg} ${card.color}`}>
                  <card.icon className="w-6 h-6" />
                </div>
              </div>
              <div className="text-sm font-medium text-muted-foreground mb-1">{card.title}</div>
              {isLoading ? (
                <div className="h-10 bg-muted animate-pulse rounded w-16 mt-2"></div>
              ) : (
                <div className="text-4xl font-mono font-semibold text-foreground group-hover:text-primary transition-colors">
                  {card.value}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-card-border rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/admin/candidates" className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors group">
              <div className="flex items-center">
                <Users className="w-5 h-5 text-primary mr-3" />
                <span className="font-medium">Manage Candidates</span>
              </div>
              <div className="text-muted-foreground group-hover:text-primary transition-colors">→</div>
            </Link>
            <Link href="/admin/intro-requests" className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors group">
              <div className="flex items-center">
                <LinkIcon className="w-5 h-5 text-primary mr-3" />
                <span className="font-medium">Process Intro Requests</span>
              </div>
              <div className="text-muted-foreground group-hover:text-primary transition-colors">→</div>
            </Link>
            <Link href="/admin/domains" className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors group">
              <div className="flex items-center">
                <Briefcase className="w-5 h-5 text-primary mr-3" />
                <span className="font-medium">Manage Whitelisted Domains</span>
              </div>
              <div className="text-muted-foreground group-hover:text-primary transition-colors">→</div>
            </Link>
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/10 rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-2">Welcome back, Admin</h2>
          <p className="text-muted-foreground mb-6">
            Review new candidates, approve domain whitelists, and manage founder intro requests to keep the talent pipeline moving.
          </p>
          <div className="bg-white rounded-lg p-4 border border-border">
            <div className="text-sm font-medium mb-2 flex items-center">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
              System Status: Healthy
            </div>
            <p className="text-xs text-muted-foreground">All services are operating normally. Emails are being delivered.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
