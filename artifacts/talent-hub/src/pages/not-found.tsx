export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
      <div className="font-mono text-primary mb-4 text-sm font-semibold tracking-wider uppercase">Error 404</div>
      <h1 className="text-4xl font-bold mb-4">Page not found</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        The resource you are looking for doesn't exist or has been moved to a new location.
      </p>
      <a href="/" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-8 py-2">
        Return Home
      </a>
    </div>
  );
}