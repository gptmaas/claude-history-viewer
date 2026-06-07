use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const CONFIG_FILENAME: &str = "desktop-config.json";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SourceConfig {
    #[serde(rename = "type")]
    pub source_type: String,
    pub path: String,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DesktopConfig {
    pub mode: String,
    pub sources: Vec<SourceConfig>,
    #[serde(rename = "lastOpenedAt")]
    pub last_opened_at: Option<String>,
}

impl DesktopConfig {
    pub fn load(config_dir: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        let config_path = config_dir.join(CONFIG_FILENAME);
        let content = fs::read_to_string(&config_path)?;
        let config: DesktopConfig = serde_json::from_str(&content)?;
        Ok(config)
    }

    pub fn save(&self, config_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
        fs::create_dir_all(config_dir)?;
        let config_path = config_dir.join(CONFIG_FILENAME);
        let content = serde_json::to_string_pretty(self)?;
        fs::write(&config_path, content)?;
        Ok(())
    }

    pub fn default_with_detection() -> Self {
        let mut sources = Vec::new();

        if let Some(home) = dirs_home() {
            let claude_dir = home.join(".claude");
            if claude_dir.is_dir() {
                sources.push(SourceConfig {
                    source_type: "claude-code".to_string(),
                    path: claude_dir.to_string_lossy().to_string(),
                    enabled: true,
                });
            }

            let codex_dir = home.join(".codex");
            if codex_dir.is_dir() {
                sources.push(SourceConfig {
                    source_type: "codex-cli".to_string(),
                    path: codex_dir.to_string_lossy().to_string(),
                    enabled: true,
                });
            }
        }

        DesktopConfig {
            mode: "local-desktop".to_string(),
            sources,
            last_opened_at: None,
        }
    }

    pub fn load_or_create(config_dir: &Path) -> Self {
        match Self::load(config_dir) {
            Ok(config) => config,
            Err(_) => {
                let config = Self::default_with_detection();
                let _ = config.save(config_dir);
                config
            }
        }
    }
}

fn dirs_home() -> Option<PathBuf> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .ok()
        .map(PathBuf::from)
}
