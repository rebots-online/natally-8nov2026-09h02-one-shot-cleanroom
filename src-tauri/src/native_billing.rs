use serde_json::Value;
use tauri::{AppHandle, Runtime};
#[cfg(target_os = "android")]
use tauri::Manager;

#[cfg(target_os = "android")]
pub struct NativeBillingHandle<R: Runtime>(tauri::plugin::PluginHandle<R>);

#[tauri::command]
pub fn native_billing_platform() -> &'static str {
  if cfg!(target_os = "android") { "android" } else { "web" }
}

#[tauri::command]
pub async fn native_billing<R: Runtime>(app: AppHandle<R>, command: String, payload: Value) -> Result<Value, String> {
  // UX-PLAY-1: bounded native SDK bridge with a strict command allowlist.
  if !["configureOwner", "quote", "purchase", "customer", "restore", "balance", "logout"].contains(&command.as_str()) {
    return Err("Unsupported billing command".into());
  }
  #[cfg(target_os = "android")]
  {
    app.state::<NativeBillingHandle<R>>().0.run_mobile_plugin_async::<Value>(&command, payload)
      .await.map_err(|error| error.to_string())
  }
  #[cfg(not(target_os = "android"))]
  {
    let _ = (app, payload);
    Err("Native billing is only supported on Android".into())
  }
}

pub fn init<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
  tauri::plugin::Builder::new("natally-billing").setup(|app, api| {
    #[cfg(target_os = "android")]
    app.manage(NativeBillingHandle(api.register_android_plugin(&app.config().identifier, "NatallyBillingPlugin")?));
    #[cfg(not(target_os = "android"))]
    let _ = (app, api);
    Ok(())
  }).build()
}
