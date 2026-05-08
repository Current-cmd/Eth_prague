import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { mock } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Submit from "./Submit";

const cfg = createConfig({
  chains: [sepolia],
  transports: { [sepolia.id]: http() },
  connectors: [mock({ accounts: ["0x1111111111111111111111111111111111111111"] })],
});
const qc = new QueryClient();

describe("Submit page", () => {
  it("renders the stepper and Step 1 content", () => {
    render(
      <WagmiProvider config={cfg}>
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={["/submit"]}>
            <Submit />
          </MemoryRouter>
        </QueryClientProvider>
      </WagmiProvider>
    );
    expect(screen.getByText(/file a disclosure/i)).toBeInTheDocument();
    expect(screen.getByText(/01 — Authenticate/i)).toBeInTheDocument();
  });
});
