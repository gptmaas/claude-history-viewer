mod commands;
mod config;
mod server;

use config::DesktopConfig;
use server::NextServer;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let app_handle = app.handle().clone();

            // In production, start the embedded Next.js server
            if !cfg!(debug_assertions) {
                let config_dir = app_handle
                    .path()
                    .app_data_dir()
                    .expect("Cannot get app data dir");

                let _config = DesktopConfig::load_or_create(&config_dir);

                let port = portpicker::pick_unused_port().expect("No available port found");

                match NextServer::start(&config_dir, port) {
                    Ok(_server) => {
                        log::info!("Next.js server started on port {}", port);
                        // Server will be stored in app state for cleanup
                    }
                    Err(e) => {
                        log::error!("Failed to start Next.js server: {}", e);
                    }
                }

                // Update main window URL to point at the local server
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.eval(&format!(
                        "window.location.href = 'http://127.0.0.1:{}'",
                        port
                    ));
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_desktop_config,
            commands::save_desktop_config,
            commands::detect_sources,
            commands::pick_directory,
            commands::get_config_file_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
