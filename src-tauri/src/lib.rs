mod native_billing;

#[cfg(desktop)]
mod native_auth;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default().plugin(native_billing::init());
  #[cfg(desktop)]
  let builder = builder.invoke_handler(tauri::generate_handler![
    native_auth::native_sign_in,
    native_auth::cancel_native_sign_in,
    native_billing::native_billing_platform,
    native_billing::native_billing
  ]);
  #[cfg(mobile)]
  let builder = builder.invoke_handler(tauri::generate_handler![
    native_billing::native_billing_platform,
    native_billing::native_billing
  ]);
  builder
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
