use std::path::PathBuf;
use std::process::{Child, Command};
use std::time::Duration;

pub struct NextServer {
    pub port: u16,
    child: Option<Child>,
}

impl NextServer {
    pub fn start(
        config_dir: &std::path::Path,
        port: u16,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let server_path = Self::find_server_path()?;
        let node_path = Self::find_node()?;

        let child = Command::new(&node_path)
            .arg(&server_path)
            .env("PORT", port.to_string())
            .env("HOSTNAME", "127.0.0.1")
            .env("DATA_SOURCE_MODE", "local-desktop")
            .env("DESKTOP_CONFIG_DIR", config_dir.to_string_lossy().to_string())
            .spawn()?;

        // Wait for server to be ready
        Self::wait_for_ready(port)?;

        Ok(Self {
            port,
            child: Some(child),
        })
    }

    fn find_server_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
        // In dev mode, we don't need a standalone server
        if cfg!(debug_assertions) {
            return Err("Dev mode uses tauri devUrl, no standalone server needed".into());
        }

        // Look for standalone server relative to the executable
        let exe_dir = std::env::current_exe()?;
        let exe_dir = exe_dir.parent().ok_or("Cannot determine exe directory")?;

        // Try resource directory first
        let candidates = vec![
            exe_dir.join("../resources/standalone/server.js"),
            exe_dir.join("standalone/server.js"),
            PathBuf::from("../.next/standalone/server.js"),
        ];

        for candidate in &candidates {
            if candidate.exists() {
                return Ok(candidate.canonicalize()?);
            }
        }

        Err(format!(
            "Cannot find standalone server.js. Tried: {:?}",
            candidates
                .iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect::<Vec<_>>()
        )
        .into())
    }

    fn find_node() -> Result<PathBuf, Box<dyn std::error::Error>> {
        match which::which("node") {
            Ok(path) => Ok(path),
            Err(_) => Err(
                "Node.js is not installed. Please install Node.js to run CodeMemory.".into(),
            ),
        }
    }

    fn wait_for_ready(port: u16) -> Result<(), Box<dyn std::error::Error>> {
        let url = format!("http://127.0.0.1:{}/api/health", port);
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(2))
            .build()?;

        for _ in 0..60 {
            match client.get(&url).send() {
                Ok(resp) if resp.status().is_success() => return Ok(()),
                _ => std::thread::sleep(Duration::from_millis(500)),
            }
        }

        Err(format!("Server at {} did not become ready within 30 seconds", url).into())
    }

    pub fn stop(&mut self) {
        if let Some(ref mut child) = self.child {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

impl Drop for NextServer {
    fn drop(&mut self) {
        self.stop();
    }
}
