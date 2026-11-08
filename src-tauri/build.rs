fn main() {
  assert_eq!(std::env::var("NATALLY_CANONICAL_BUILD").as_deref(), Ok("1"),
    "Native packaging must run through build_all.sh");
  println!("cargo:rerun-if-env-changed=NATALLY_CANONICAL_BUILD");
  let stamp: serde_json::Value = serde_json::from_str(
    &std::fs::read_to_string("../version.json").expect("canonical version.json"),
  ).expect("valid canonical version");
  let package_version = stamp["semverVersion"].as_str().or_else(|| stamp["version"].as_str()).unwrap();
  assert_eq!(package_version, std::env::var("CARGO_PKG_VERSION").unwrap());
  println!("cargo:rerun-if-changed=../version.json");
  // Android's linker does not otherwise emit a GNU build ID here. Preserve
  // one in the application and debug sections for exact symbol matching.
  if std::env::var("CARGO_CFG_TARGET_OS").ok().as_deref() == Some("android") {
    println!("cargo:rustc-link-arg=-Wl,--build-id=sha1");
  }
  tauri_build::build()
}
