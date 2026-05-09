import { NavLink, Route, Routes } from "react-router-dom";
import { useChainId } from "wagmi";
import { sepolia } from "wagmi/chains";
import { ConnectButton } from "./components/ConnectButton";
import Feed from "./pages/Feed";
import Submit from "./pages/Submit";
import ReportDetail from "./pages/ReportDetail";
import CompanyAdmin from "./pages/CompanyAdmin";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";

const TABS = [
  { to: "/",       label: "Public Registry",     short: "Registry" },
  { to: "/submit", label: "Submit a Disclosure", short: "Submit"   },
  { to: "/onboarding", label: "Worker Onboarding", short: "Onboard" },
  { to: "/admin/acme.shieldpass-demo.eth", label: "Admin Console", short: "Admin" },
];

export default function App() {
  return (
    <div className="grain min-h-screen bg-ink text-paper">
      <TopNav />
      <main>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/submit" element={<Submit />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/reports/:reportHash" element={<ReportDetail />} />
          <Route path="/admin/:companyEns" element={<CompanyAdmin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

function TopNav() {
  const chainId = useChainId();
  const onSepolia = chainId === sepolia.id;

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-ink/95 backdrop-blur">
      <div className="max-w-[1340px] mx-auto px-6 lg:px-10 h-[57px] grid grid-cols-3 items-center gap-6">
        <div />

        <nav className="flex items-center justify-center gap-1">
          {TABS.map((tb) => (
            <NavLink
              key={tb.to}
              to={tb.to}
              className={({ isActive }) =>
                `relative h-[57px] px-3 lg:px-5 font-mono text-[10.5px] uppercase tracking-[0.18em] transition flex items-center ${
                  isActive ? "text-paper" : "text-paper3 hover:text-paper"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="hidden sm:inline">{tb.label}</span>
                  <span className="sm:hidden">{tb.short}</span>
                  {isActive && (
                    <span className="absolute bottom-[-1px] left-3 right-3 lg:left-5 lg:right-5 h-[2px] bg-amber" style={{ borderRadius: 0 }} />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:flex items-center justify-end gap-3 font-mono text-[10px] uppercase tracking-[0.18em]">
          <span className={`w-1.5 h-1.5 ${onSepolia ? "bg-verify" : "bg-amber"}`} style={{ borderRadius: 0 }} />
          <span className="text-paper3">{onSepolia ? "Sepolia · operational" : "wrong network"}</span>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
