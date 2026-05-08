import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import { sepolia } from "wagmi/chains";
import { Btn, Modal, truncHash } from "./shared";

export function ConnectButton() {
  const { address, status } = useAccount();
  const { connectors, connect, error } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [open, setOpen] = useState(false);
  const wrongNetwork = address && chainId !== sepolia.id;

  if (status === "connected" && address) {
    return (
      <div className="flex items-center gap-3">
        {wrongNetwork && (
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-alert">
            wrong network — switch to Sepolia
          </span>
        )}
        <button
          onClick={() => disconnect()}
          className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper3 hover:text-paper"
          style={{ borderRadius: 0 }}
        >
          {truncHash(address, 6, 4)} · disconnect
        </button>
      </div>
    );
  }

  return (
    <>
      <Btn kind="primary" size="sm" onClick={() => setOpen(true)}>
        Connect Wallet
      </Btn>
      <Modal open={open} onClose={() => setOpen(false)} width="max-w-[420px]" label="Connect wallet">
        <div className="px-6 pt-6 pb-4 border-b border-rule2">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber mb-1">Connect</div>
          <h3 className="font-serif-disp text-[28px] leading-none text-paper">Choose a wallet</h3>
        </div>
        <div className="px-6 py-5 space-y-2">
          {connectors.map((c) => (
            <button
              key={c.uid}
              onClick={() => { connect({ connector: c }); setOpen(false); }}
              className="w-full text-left px-4 py-3 border border-rule2 hover:border-paper3 transition flex items-center justify-between"
              style={{ borderRadius: 0 }}
            >
              <span className="font-mono text-[12.5px] text-paper">{c.name}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper3">{c.type}</span>
            </button>
          ))}
          {error && (
            <div className="font-mono text-[11px] text-alert mt-3">{error.message}</div>
          )}
        </div>
      </Modal>
    </>
  );
}
