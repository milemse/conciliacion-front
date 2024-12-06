use serde_json::json;
use tauri_plugin_http::reqwest;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn get_enviroment_variable(name: &str) -> String {
    std::env::var(name).unwrap_or_else(|_| "".to_string())
}

#[tauri::command]
async fn export_consumptions(path: String, data: Vec<serde_json::Value>, linker: String) -> String {
    let body = json!({
        "path": path,
        "data": data,
        "linker": linker
    });

    let reponse = reqwest::Client::new()
        .post("http://localhost:3000/")
        .header("Content-Type", "application/json")
        .body(body.to_string())
        .send().await.unwrap()
        .text().await.unwrap();
    
    return reponse
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![get_enviroment_variable, export_consumptions])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
