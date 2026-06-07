use crate::config::{DesktopConfig, SourceConfig};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn get_desktop_config(app: AppHandle) -> Result<DesktopConfig, String> {
    let config_dir = get_config_dir(&app)?;
    DesktopConfig::load(&config_dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_desktop_config(
    app: AppHandle,
    config: DesktopConfig,
) -> Result<(), String> {
    let config_dir = get_config_dir(&app)?;
    config.save(&config_dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn detect_sources() -> Result<Vec<SourceConfig>, String> {
    let default_config = DesktopConfig::default_with_detection();
    Ok(default_config.sources)
}

#[tauri::command]
pub async fn pick_directory(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app
        .dialog()
        .file()
        .add_filter("Directories", &["*"])
        .blocking_pick_folder();
    Ok(path.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn get_config_file_path(app: AppHandle) -> Result<String, String> {
    let config_dir = get_config_dir(&app)?;
    Ok(config_dir
        .join("desktop-config.json")
        .to_string_lossy()
        .to_string())
}

fn get_config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Cannot get app data dir: {}", e))
}
