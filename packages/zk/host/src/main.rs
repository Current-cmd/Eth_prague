use anyhow::Result;
use clap::Parser;
use risc0_zkvm::{default_prover, sha::Digestible, ExecutorEnv};
use serde::{Deserialize, Serialize};
use shieldpass_methods::SHIELDPASS_GUEST_ELF;
use std::io::{self, Read};

/// Local prover CLI for ShieldPass ZK circuit
#[derive(Parser, Debug)]
#[command(name = "shieldpass-prove")]
#[command(about = "Generate ZK proofs for ShieldPass reports", long_about = None)]
struct Args {
    /// Input JSON file with proof request data
    #[arg(short, long)]
    input: Option<String>,

    /// Output file for proof receipt (JSON)
    #[arg(short, long)]
    output: Option<String>,

    /// Pretty print JSON output
    #[arg(long)]
    pretty: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ProofRequest {
    badge: String,
    merklePath: Vec<String>,
    merkleIndices: Vec<u8>,
    root: String,
    reportHash: String,
    periodId: u64,
    ensNode: String,
}

#[derive(Debug, Serialize)]
struct ProofReceipt {
    seal: String,
    journal: JournalOutput,
    imageId: String,
}

#[derive(Debug, Serialize)]
struct JournalOutput {
    root: String,
    reportHash: String,
    nullifier: String,
    periodId: u64,
    ensNode: String,
}

fn parse_hex(s: &str) -> Result<[u8; 32]> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    let bytes = hex::decode(s)?;
    if bytes.len() != 32 {
        anyhow::bail!("Invalid hex length: expected 32 bytes, got {}", bytes.len());
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(arr)
}

fn bytes_to_hex(b: &[u8]) -> String {
    format!("0x{}", hex::encode(b))
}

fn run_proof(req: ProofRequest) -> Result<ProofReceipt> {
    // Parse inputs
    let badge = parse_hex(&req.badge)?;
    let merkle_path: Vec<[u8; 32]> = req
        .merklePath
        .iter()
        .map(|s| parse_hex(s))
        .collect::<Result<Vec<_>>>()?;
    let merkle_indices = req.merkleIndices;
    let root = parse_hex(&req.root)?;
    let report_hash = parse_hex(&req.reportHash)?;
    let ens_node = parse_hex(&req.ensNode)?;
    let period_id = req.periodId;

    // Build executor environment
    let mut env_builder = ExecutorEnv::builder();

    // Write inputs (serde-serialized, matching guest env::read::<T>() calls)
    env_builder.write(&badge).unwrap();
    env_builder.write(&merkle_path).unwrap();
    env_builder.write(&merkle_indices).unwrap();
    env_builder.write(&root).unwrap();
    env_builder.write(&report_hash).unwrap();
    env_builder.write(&period_id).unwrap();
    env_builder.write(&ens_node).unwrap();

    // Build environment
    let env = env_builder.build()?;

    let prove_info = default_prover().prove(env, SHIELDPASS_GUEST_ELF)?;

    // Get the journal bytes (the committed data from guest)
    let journal_bytes = prove_info.receipt.journal.bytes.clone();

    // Verify journal length
    if journal_bytes.len() != 160 {
        anyhow::bail!(
            "Unexpected journal length: expected 160 bytes (5 x 32), got {}",
            journal_bytes.len()
        );
    }

    // Parse the ABI-encoded journal
    // Layout: root(32) + reportHash(32) + nullifier(32) + periodId(32) + ensNode(32)
    let mut root_arr = [0u8; 32];
    let mut report_hash_arr = [0u8; 32];
    let mut nullifier_arr = [0u8; 32];
    let mut period_id_arr = [0u8; 32];
    let mut ens_node_arr = [0u8; 32];

    root_arr.copy_from_slice(&journal_bytes[0..32]);
    report_hash_arr.copy_from_slice(&journal_bytes[32..64]);
    nullifier_arr.copy_from_slice(&journal_bytes[64..96]);
    period_id_arr.copy_from_slice(&journal_bytes[96..128]);
    ens_node_arr.copy_from_slice(&journal_bytes[128..160]);

    // periodId is uint64, stored in big-endian in last 8 bytes
    let period_id_val = u64::from_be_bytes(
        period_id_arr[24..32]
            .try_into()
            .map_err(|_| anyhow::anyhow!("Failed to parse periodId"))?,
    );

    // Extract seal (bincode-serialize the inner receipt for on-chain use)
    let seal_bytes = bincode::serialize(&prove_info.receipt.inner)?;

    // Extract image ID from receipt claim (pre-state digest = image ID)
    let image_id_digest = prove_info.receipt.claim()?.value()?.pre.digest();

    let proof_receipt = ProofReceipt {
        seal: bytes_to_hex(&seal_bytes),
        journal: JournalOutput {
            root: bytes_to_hex(&root_arr),
            reportHash: bytes_to_hex(&report_hash_arr),
            nullifier: bytes_to_hex(&nullifier_arr),
            periodId: period_id_val,
            ensNode: bytes_to_hex(&ens_node_arr),
        },
        imageId: bytes_to_hex(image_id_digest.as_bytes()),
    };

    Ok(proof_receipt)
}

fn main() -> Result<()> {
    let args = Args::parse();

    // Read input
    let input_json = if let Some(path) = args.input {
        std::fs::read_to_string(&path)?
    } else {
        let mut buf = String::new();
        io::stdin().read_to_string(&mut buf)?;
        buf
    };

    let req: ProofRequest = serde_json::from_str(&input_json)?;

    // Run proof
    let receipt = run_proof(req)?;

    // Output
    let output_json = if args.pretty {
        serde_json::to_string_pretty(&receipt)?
    } else {
        serde_json::to_string(&receipt)?
    };

    if let Some(path) = args.output {
        std::fs::write(&path, output_json)?;
        eprintln!("Proof receipt written to: {}", path);
    } else {
        println!("{}", output_json);
    }

    Ok(())
}
