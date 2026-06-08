import { ThemeToggle } from "@/components/ThemeToggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-bg flex min-h-screen items-center justify-center p-4">
      {/* Theme toggle — fixed in corner */}
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">DataPulse</h1>
          <p className="mt-1 text-sm text-white/70">
            Multi-Channel Web Scraping Platform
          </p>
        </div>

        {/* Glass card container */}
        <div className="glass rounded-2xl p-8 shadow-lg"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          {children}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-white/50">
          © {new Date().getFullYear()} DataPulse. Built for business.
        </p>
      </div>
    </div>
  );
}
