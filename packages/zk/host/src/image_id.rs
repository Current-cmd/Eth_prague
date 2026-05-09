use shieldpass_methods::SHIELDPASS_GUEST_ELF;

fn main() {
    let image_id = risc0_zkvm::compute_image_id(SHIELDPASS_GUEST_ELF).expect("Failed to compute IMAGE_ID");
    println!("0x{}", hex::encode(image_id.as_bytes()));
}
