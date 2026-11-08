use std::{io::{Read, Write}, net::{TcpListener, TcpStream}, sync::atomic::{AtomicBool, Ordering}, time::{Duration, Instant}};
use serde::{Deserialize, Serialize};

const ORIGIN: &str = "https://natally.robin.mba";
const LIMIT: usize = 32768;
static ACTIVE: AtomicBool = AtomicBool::new(false);
static CANCELLED: AtomicBool = AtomicBool::new(false);

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Credentials {
    #[serde(skip_serializing)]
    state: String,
    provider: String,
    id_token: Option<String>,
    access_token: Option<String>,
    verification_id: Option<String>,
    code: Option<String>,
}

fn validate(body: &str, state: &str, provider: &str) -> Result<Credentials, String> {
    let value: Credentials = serde_json::from_str(body).map_err(|_| "Invalid callback body")?;
    if value.state != state || value.provider != provider { return Err("Invalid sign-in state".into()); }
    let valid = match provider {
        "google" => value.id_token.as_ref().is_some_and(|v| !v.is_empty() && v.len() < 16384)
            && value.verification_id.is_none() && value.code.is_none(),
        "phone" => value.verification_id.as_ref().is_some_and(|v| !v.is_empty() && v.len() < 8192)
            && value.code.as_ref().is_some_and(|v| v.len() == 6 && v.bytes().all(|b| b.is_ascii_digit()))
            && value.id_token.is_none() && value.access_token.is_none(),
        _ => false,
    };
    if !valid { return Err("Invalid provider credential".into()); }
    Ok(value)
}

fn receive(stream: &mut TcpStream, port: u16, state: &str, provider: &str) -> Result<Credentials, String> {
    stream.set_read_timeout(Some(Duration::from_secs(3))).map_err(|_| "Socket timeout failed")?;
    let mut bytes = Vec::new();
    let header_end;
    loop {
        let mut b = [0u8; 1024];
        let n = stream.read(&mut b).map_err(|_| "Incomplete callback")?;
        if n == 0 || bytes.len() + n > LIMIT { return Err("Invalid callback size".into()); }
        bytes.extend_from_slice(&b[..n]);
        if let Some(end) = bytes.windows(4).position(|w| w == b"\r\n\r\n") { header_end = end + 4; break; }
    }
    let header = std::str::from_utf8(&bytes[..header_end]).map_err(|_| "Invalid headers")?;
    let mut lines = header.split("\r\n");
    if lines.next() != Some("POST /natally-auth HTTP/1.1") { return Err("Invalid callback route".into()); }
    let mut headers = std::collections::HashMap::new();
    for line in lines.filter(|l| !l.is_empty()) {
        let (name, value) = line.split_once(':').ok_or("Invalid header")?;
        if headers.insert(name.to_ascii_lowercase(), value.trim()).is_some() { return Err("Duplicate header".into()); }
    }
    let host = format!("127.0.0.1:{port}");
    if headers.get("host") != Some(&host.as_str()) || headers.get("origin") != Some(&ORIGIN)
        || headers.contains_key("transfer-encoding")
        || !headers.get("content-type").is_some_and(|v| v.starts_with("application/x-www-form-urlencoded")) {
        return Err("Untrusted callback".into());
    }
    let size: usize = headers.get("content-length").ok_or("Missing length")?.parse().map_err(|_| "Invalid length")?;
    if size == 0 || size + header_end > LIMIT { return Err("Callback too large".into()); }
    while bytes.len() < header_end + size {
        let mut chunk = [0; 1024];
        let remaining = (header_end + size - bytes.len()).min(chunk.len());
        let n = stream.read(&mut chunk[..remaining]).map_err(|_| "Incomplete callback")?;
        if n == 0 { return Err("Incomplete callback".into()); }
        bytes.extend_from_slice(&chunk[..n]);
    }
    let form = std::str::from_utf8(&bytes[header_end..header_end + size]).map_err(|_| "Invalid body")?;
    let fields: Vec<_> = url::form_urlencoded::parse(form.as_bytes()).collect();
    if fields.len() != 1 || fields[0].0 != "credential" { return Err("Invalid callback fields".into()); }
    validate(&fields[0].1, state, provider)
}

fn respond(stream: &mut TcpStream, valid: bool) {
    let config: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json")).expect("projected application configuration");
    let name = config["productName"].as_str().expect("required configured application name")
        .replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&#39;");
    let message = if valid { format!("Sign-in returned to {name}. Return to the app to see the result. You can close this tab.") }
        else { format!("This sign-in callback was rejected. Return to {name} and try again.") };
    let body = format!("<!doctype html><html lang=\"en\"><meta name=\"viewport\" content=\"width=device-width\"><title>{name} sign-in</title><h1>{name}</h1><p>{message}</p></html>");
    let status = if valid { "200 OK" } else { "400 Bad Request" };
    let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
    let _ = write!(stream, "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'none'; frame-ancestors 'none'\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}", body.len(), body);
}

fn flow(provider: String) -> Result<Credentials, String> {
    if provider != "google" && provider != "phone" { return Err("Unsupported sign-in provider".into()); }
    let listener = loop {
        let candidate = TcpListener::bind("127.0.0.1:0").map_err(|_| "Cannot start secure sign-in callback")?;
        if candidate.local_addr().map_err(|_| "Cannot read callback address")?.port() >= 30000 { break candidate; }
    };
    listener.set_nonblocking(true).map_err(|_| "Cannot configure sign-in callback")?;
    let port = listener.local_addr().map_err(|_| "Cannot read callback address")?.port();
    let mut random = [0u8; 32];
    getrandom::fill(&mut random).map_err(|_| "Cannot generate secure sign-in state")?;
    let state: String = random.iter().map(|v| format!("{v:02x}")).collect();
    let url = format!("{ORIGIN}/auth/native.html#port={port}&state={state}&provider={provider}");
    open::that(&url).map_err(|_| "Cannot open your system browser. Check the default browser setting.")?;
    wait_for_callback(listener, &state, &provider, Duration::from_secs(300), &CANCELLED)
}

fn wait_for_callback(listener: TcpListener, state: &str, provider: &str, timeout: Duration, cancelled: &AtomicBool) -> Result<Credentials, String> {
    let port = listener.local_addr().map_err(|_| "Cannot read callback address")?.port();
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline && !cancelled.load(Ordering::Acquire) {
        match listener.accept() {
            Ok((mut stream, peer)) => {
                if !peer.ip().is_loopback() { continue; }
                let result = receive(&mut stream, port, state, provider);
                respond(&mut stream, result.is_ok());
                if let Ok(value) = result { return Ok(value); }
            },
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => std::thread::sleep(Duration::from_millis(50)),
            Err(_) => return Err("Sign-in callback failed".into()),
        }
    }
    Err(if cancelled.load(Ordering::Acquire) { "Sign-in cancelled" } else { "Sign-in expired. Please try again." }.into())
}

#[cfg(not(test))]
#[tauri::command]
pub async fn native_sign_in(provider: String) -> Result<Credentials, String> {
    if ACTIVE.swap(true, Ordering::AcqRel) { return Err("A sign-in is already running".into()); }
    CANCELLED.store(false, Ordering::Release);
    let result = tauri::async_runtime::spawn_blocking(move || flow(provider)).await;
    ACTIVE.store(false, Ordering::Release);
    result.map_err(|_| "Sign-in task failed".to_string())?
}

#[cfg(not(test))]
#[tauri::command]
pub fn cancel_native_sign_in() { CANCELLED.store(true, Ordering::Release); }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn credentials_bind_state_and_provider() {
        let body = r#"{"state":"nonce","provider":"google","idToken":"token"}"#;
        assert!(validate(body, "nonce", "google").is_ok());
        assert!(validate(body, "wrong", "google").is_err());
        assert!(validate(body, "nonce", "phone").is_err());
        assert!(validate(r#"{"state":"nonce","provider":"phone","verificationId":"id","code":"123456"}"#, "nonce", "phone").is_ok());
        assert!(validate(r#"{"state":"nonce","provider":"phone","verificationId":"id","code":"12x456"}"#, "nonce", "phone").is_err());
    }
    #[test]
    fn rejects_credentials_for_unknown_provider() { assert!(validate(r#"{"state":"n","provider":"email","idToken":"t"}"#, "n", "email").is_err()); }

    fn request(origin: &str, host_override: Option<&str>, state: &str, route: &str) -> bool {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let body = format!("credential={}", url::form_urlencoded::byte_serialize(format!(r#"{{"state":"{state}","provider":"google","idToken":"token"}}"#).as_bytes()).collect::<String>());
        let host = host_override.map(String::from).unwrap_or(format!("127.0.0.1:{port}"));
        let wire = format!("POST {route} HTTP/1.1\r\nHost: {host}\r\nOrigin: {origin}\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: {}\r\n\r\n{body}", body.len());
        let sender = std::thread::spawn(move || { let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap(); s.write_all(wire.as_bytes()).unwrap(); });
        let (mut stream, _) = listener.accept().unwrap();
        let valid = receive(&mut stream, port, "nonce", "google").is_ok();
        sender.join().unwrap(); valid
    }
    #[test]
    fn trusted_loopback_post_is_accepted() { assert!(request(ORIGIN, None, "nonce", "/natally-auth")); }
    #[test]
    fn rejects_cross_origin_null_origin_dns_rebinding_and_wrong_path() {
        assert!(!request("https://evil.example", None, "nonce", "/natally-auth"));
        assert!(!request("null", None, "nonce", "/natally-auth"));
        assert!(!request(ORIGIN, Some("evil.example"), "nonce", "/natally-auth"));
        assert!(!request(ORIGIN, None, "nonce", "/other"));
        assert!(!request(ORIGIN, None, "wrong", "/natally-auth"));
    }
    #[test]
    fn timeout_and_cancellation_close_listener() {
        for cancelled in [false, true] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let address = listener.local_addr().unwrap();
            listener.set_nonblocking(true).unwrap();
            let flag = AtomicBool::new(cancelled);
            let result = wait_for_callback(listener, "n", "google", Duration::ZERO, &flag);
            assert!(result.is_err());
            assert!(TcpStream::connect(address).is_err());
        }
    }
}
