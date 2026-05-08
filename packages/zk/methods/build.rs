fn main() {
    // Trigger rebuild when methods change
    println!("cargo:rerun-if-changed=guest");
}
