import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { namehash, type Hex } from "viem";
import { api } from "../lib/api";
import { SEPOLIA_ADDRESSES, SEPOLIA_CONFIG } from "@shieldpass/shared/chain";
import { CompanyRegistryAbi, BadgeTreeManagerAbi, ShieldPassResolverAbi } from "@shieldpass/shared/abis";
import { Btn, Modal, SectionHead, CategoryBadge, fmtRelative, TxLink } from "../components/shared";
import { ConnectButton } from "../components/ConnectButton";
import { buildTree } from "../lib/merkle";
import type { ReportCategory } from "@shieldpass/shared/enums";

export default function CompanyAdmin() {
  const { companyEns } = useParams<{ companyEns: string }>();
  const { address } = useAccount();
  const ensNode = companyEns ? namehash(companyEns) : undefined;

  const { data: admin, isLoading: adminLoading, error: adminError } = useReadContract({
    address: SEPOLIA_ADDRESSES.CompanyRegistry,
    abi: CompanyRegistryAbi as any,
    functionName: "adminOf",
    args: ensNode ? [ensNode] : undefined,
    query: { enabled: !!ensNode },
  });

  const isAdmin: boolean = !!(admin && address && (admin as string).toLowerCase() === address.toLowerCase());
  const [showRotate, setShowRotate] = useState(false);

  const reportsQ = useQuery({
    queryKey: ["admin-reports", companyEns],
    queryFn: async () => {
      const { data } = await api.GET("/reports", { params: { query: { company: companyEns!, limit: 50 } } });
      return data?.items ?? [];
    },
    enabled: !!companyEns,
  });

  return (
    <div className="page-enter">
      <div className="border-b border-rule">
        <div className="max-w-[1240px] mx-auto px-6 lg:px-10 py-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 mb-3">Admin Console · {companyEns}</div>
            <h1 className="font-serif-disp text-[56px] md:text-[72px] leading-[0.95] text-paper">{companyEns?.split(".")[0]}</h1>
            <div className="mt-3 font-mono text-[11px] text-paper3">
              admin: <span className="text-paper2">{adminLoading ? "loading…" : admin ? String(admin) : "—"}</span>
            </div>
            {adminError && (
              <div className="mt-1 font-mono text-[10px] text-alert">rpc error: {adminError.message.slice(0, 120)}</div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ConnectButton />
            {isAdmin && <Btn kind="primary" size="md" onClick={() => setShowRotate(true)}>Rotate badge tree</Btn>}
          </div>
        </div>
      </div>

      {!address && (
        <div className="max-w-[1240px] mx-auto px-6 lg:px-10 py-16 font-mono text-[11px] text-paper3 uppercase tracking-[0.18em]">
          Connect a wallet to manage this organization.
        </div>
      )}
      {address && !adminLoading && !isAdmin && (
        <div className="max-w-[1240px] mx-auto px-6 lg:px-10 py-16 space-y-2">
          <div className="font-mono text-[11px] text-alert uppercase tracking-[0.18em]">
            This wallet is not the admin for {companyEns}.
          </div>
          <div className="font-mono text-[10px] text-paper3">
            connected: {address}<br />
            on-chain admin: {admin ? String(admin) : "not registered"}
          </div>
        </div>
      )}

      {isAdmin && companyEns && ensNode && (
        <div className="max-w-[1240px] mx-auto px-6 lg:px-10 py-10">
          <SectionHead kicker="01 — Reports" title="Inbound disclosures for this company" />
          <div className="space-y-3">
            {(reportsQ.data ?? []).map((r) => (
              <div key={r.reportHash} className="border border-rule2 bg-panel p-5" style={{ borderRadius: 0 }}>
                <div className="flex items-center justify-between mb-3">
                  <CategoryBadge category={r.category as ReportCategory} size="sm" />
                </div>
                <div className="font-serif-disp text-xl leading-tight text-paper mb-2">
                  {r.payload?.title ?? r.reportHash}
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-rule font-mono text-[10.5px] text-paper3">
                  <span className="tnum">{r.reportHash.slice(0, 16)}…</span>
                  <span>{fmtRelative(new Date(r.submittedAt * 1000).toISOString())}</span>
                </div>
              </div>
            ))}
            {(reportsQ.data ?? []).length === 0 && (
              <div className="border border-dashed border-rule2 p-10 text-center font-mono text-[11px] text-paper3 uppercase tracking-[0.18em]">
                No reports filed yet.
              </div>
            )}
          </div>

          <RotateModal
            open={showRotate}
            onClose={() => setShowRotate(false)}
            companyEns={companyEns}
            ensNode={ensNode}
          />
        </div>
      )}
    </div>
  );
}

function RotateModal({ open, onClose, companyEns, ensNode }: { open: boolean; onClose: () => void; companyEns: string; ensNode: Hex }) {
  const [csv, setCsv] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ leafCount: number; root: Hex } | null>(null);

  const parentNode = namehash(SEPOLIA_CONFIG.shieldpassParentEns);

  const { writeContract: writeRotate, data: rotateTx, isPending: rotating } = useWriteContract();
  const { writeContract: writeText, data: textTx, isPending: textWriting } = useWriteContract();

  const onCsvChange = (next: string) => {
    setCsv(next); setParseError(null); setPreview(null);
    const lines = next.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    if (!lines.every((l) => /^0x[0-9a-fA-F]{64}$/.test(l))) {
      setParseError("Each line must be a 32-byte hex (0x… 64 hex chars).");
      return;
    }
    if (lines.length > 65536) {
      setParseError("Too many leaves for depth-16 tree (max 65536).");
      return;
    }
    const tree = buildTree(lines as Hex[], 16);
    setPreview({ leafCount: lines.length, root: tree.root });
  };

  const rotate = () => {
    if (!preview) return;
    writeRotate({
      address: SEPOLIA_ADDRESSES.BadgeTreeManager,
      abi: BadgeTreeManagerAbi as any,
      functionName: "rotateRoot",
      args: [ensNode, preview.root],
    });
  };

  const writeRootTextRecord = () => {
    if (!preview) return;
    writeText({
      address: SEPOLIA_ADDRESSES.ShieldPassResolver,
      abi: ShieldPassResolverAbi as any,
      functionName: "setText",
      args: [parentNode, "shieldpass.badge-tree-root", preview.root],
    });
  };

  return (
    <Modal open={open} onClose={onClose} width="max-w-[760px]" label="Rotate badge tree">
      <div className="px-8 pt-7 pb-6 border-b border-rule2">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-amber mb-2">Rotate badge tree</div>
        <h3 className="font-serif-disp text-[36px] leading-none text-paper">Issue a new root for {companyEns}</h3>
      </div>
      <div className="px-8 py-7 space-y-6">
        <div>
          <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper3 block mb-2">Badge leaves (one hex per line, 32 bytes each)</label>
          <textarea
            rows={10}
            value={csv}
            onChange={(e) => onCsvChange(e.target.value)}
            placeholder="0x...&#10;0x...&#10;..."
            className="w-full bg-ink border border-rule2 text-paper text-[12px] p-3 font-mono focus:outline-none focus:border-paper3"
            style={{ borderRadius: 0 }}
          />
          {parseError && <div className="mt-2 font-mono text-[11px] text-alert">{parseError}</div>}
          {preview && (
            <div className="mt-3 font-mono text-[11px] text-paper3">
              {preview.leafCount} leaves · depth 16 · root <span className="text-paper">{preview.root}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Btn kind="primary" size="lg" disabled={!preview || rotating} onClick={rotate}>
            {rotating ? "Confirm in wallet…" : "1) rotateRoot"}
          </Btn>
          <Btn kind="primary" size="lg" disabled={!preview || textWriting || !rotateTx} onClick={writeRootTextRecord}>
            {textWriting ? "Confirm in wallet…" : "2) setText badge-tree-root"}
          </Btn>
        </div>

        {rotateTx && <div className="font-mono text-[11px] text-verify">rotate tx: <TxLink hash={rotateTx} /></div>}
        {textTx && <div className="font-mono text-[11px] text-verify">setText tx: <TxLink hash={textTx} /></div>}
      </div>
    </Modal>
  );
}
