use tauri::{Manager, WindowEvent};
use std::process::{Command, Child};
use std::sync::Mutex;

struct AppState {
    mpv_process: Mutex<Option<Child>>,
}

#[tauri::command]
fn mpv_check() -> serde_json::Value {
    serde_json::json!({ "available": true, "version": "0.37.0" })
}

#[tauri::command]
fn mpv_state() -> serde_json::Value {
    use std::io::{BufRead, Write};
    
    let mut position = 0.0;
    let mut duration = 0.0;
    let mut volume = 100.0;
    let mut paused = false;
    let mut is_running = false;

    if let Ok(mut pipe) = std::fs::OpenOptions::new().read(true).write(true).open(r#"\\.\pipe\iptv-mpv-pipe"#) {
        is_running = true;
        let req = "{\"command\": [\"get_property\", \"time-pos\"], \"request_id\": 1}\n\
                   {\"command\": [\"get_property\", \"duration\"], \"request_id\": 2}\n\
                   {\"command\": [\"get_property\", \"volume\"], \"request_id\": 3}\n\
                   {\"command\": [\"get_property\", \"pause\"], \"request_id\": 4}\n";
        
        if pipe.write_all(req.as_bytes()).is_ok() {
            let mut reader = std::io::BufReader::new(pipe);
            let mut line = String::new();
            let mut successes = 0;
            
            for _ in 0..20 {
                line.clear();
                if reader.read_line(&mut line).is_err() || line.is_empty() {
                    break;
                }
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                    if let Some(req_id) = json.get("request_id").and_then(|v| v.as_u64()) {
                        if let Some(data) = json.get("data") {
                            match req_id {
                                1 => position = data.as_f64().unwrap_or(0.0),
                                2 => duration = data.as_f64().unwrap_or(0.0),
                                3 => volume = data.as_f64().unwrap_or(100.0),
                                4 => paused = data.as_bool().unwrap_or(false),
                                _ => {}
                            }
                        }
                        successes += 1;
                        if successes >= 4 {
                            break;
                        }
                    }
                }
            }
        }
    }

    serde_json::json!({
        "position": position,
        "duration": duration,
        "volume": volume,
        "paused": paused,
        "isRunning": is_running
    })
}

fn send_mpv_command(cmd: &str) {
    use std::io::Write;
    match std::fs::OpenOptions::new().write(true).open(r#"\\.\pipe\iptv-mpv-pipe"#) {
        Ok(mut pipe) => {
            log_debug(&format!("Writing to MPV pipe: {}", cmd));
            println!("Writing to MPV pipe: {}", cmd);
            let _ = writeln!(pipe, "{}", cmd);
        }
        Err(e) => {
            log_debug(&format!("Failed to open MPV pipe: {}", e));
            eprintln!("Failed to open MPV pipe: {}", e);
        }
    }
}

fn log_debug(msg: &str) {
    use std::io::Write;
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open("app_debug.log") {
        let _ = writeln!(file, "{}", msg);
    }
}

#[tauri::command]
fn mpv_load(url: String) {
    log_debug(&format!("MPV LOAD CALLED WITH URL: {}", url));
    println!("MPV LOAD CALLED WITH URL: {}", url);
    send_mpv_command(&format!("loadfile \"{}\"", url));
    send_mpv_command("set pause no");
}

#[tauri::command]
fn mpv_play(url: String) {
    log_debug(&format!("MPV PLAY CALLED WITH URL: {}", url));
    println!("MPV PLAY CALLED WITH URL: {}", url);
    send_mpv_command(&format!("loadfile \"{}\"", url));
    send_mpv_command("set pause no");
}

#[tauri::command]
fn mpv_stop() {
    send_mpv_command("stop");
}

#[tauri::command]
fn mpv_pause(paused: bool) {
    send_mpv_command(&format!("set pause {}", if paused { "yes" } else { "no" }));
}

#[tauri::command]
fn mpv_seek(position: f64) {
    send_mpv_command(&format!("seek {} absolute", position));
}

#[tauri::command]
fn mpv_volume(volume: f64) {
    send_mpv_command(&format!("set volume {}", volume));
}

#[tauri::command]
fn window_minimize(window: tauri::Window) { window.minimize().unwrap(); }

#[tauri::command]
fn window_maximize(window: tauri::Window) { 
    if window.is_maximized().unwrap() {
        window.unmaximize().unwrap();
    } else {
        window.maximize().unwrap();
    }
}

#[tauri::command]
fn window_close(window: tauri::Window) { window.close().unwrap(); }

#[tauri::command]
fn window_fullscreen(window: tauri::Window, fullscreen: bool) { 
    window.set_fullscreen(fullscreen).unwrap(); 
}

#[tauri::command]
fn mpv_geometry(window: tauri::Window, x: f64, y: f64, width: f64, height: f64) {
    if let Ok(size) = window.inner_size() {
        let win_w = size.width as f64;
        let win_h = size.height as f64;
        
        let mut ratio_left = x / win_w;
        let mut ratio_top = y / win_h;
        let mut ratio_right = (win_w - (x + width)) / win_w;
        let mut ratio_bottom = (win_h - (y + height)) / win_h;

        // Clamp to 0..1
        ratio_left = ratio_left.clamp(0.0, 1.0);
        ratio_top = ratio_top.clamp(0.0, 1.0);
        ratio_right = ratio_right.clamp(0.0, 1.0);
        ratio_bottom = ratio_bottom.clamp(0.0, 1.0);

        send_mpv_command(&format!("set video-margin-ratio-left {:.4}", ratio_left));
        send_mpv_command(&format!("set video-margin-ratio-top {:.4}", ratio_top));
        send_mpv_command(&format!("set video-margin-ratio-right {:.4}", ratio_right));
        send_mpv_command(&format!("set video-margin-ratio-bottom {:.4}", ratio_bottom));
    }
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_http::init())
    .manage(AppState {
        mpv_process: Mutex::new(None),
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      
      let window = app.get_webview_window("main").unwrap();
      window.show().unwrap();
      
      #[cfg(debug_assertions)]
      window.open_devtools();
      
      let hwnd_ptr = window.hwnd().unwrap().0 as isize;
      println!("Webview HWND: {}", hwnd_ptr);
      
      let mut mpv_path = String::from("mpv");
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let p1 = exe_dir.join("resources/mpv/mpv.exe");
                let p2 = exe_dir.join("../../../resources/mpv/mpv.exe");
                let p3 = std::path::Path::new("../resources/mpv/mpv.exe");
                let p4 = std::path::Path::new("I:/antigraviti google/iptv_player/resources/mpv/mpv.exe");
                
                if p1.exists() { mpv_path = p1.to_string_lossy().to_string(); }
                else if p2.exists() { mpv_path = p2.to_string_lossy().to_string(); }
                else if p3.exists() { mpv_path = p3.to_string_lossy().to_string(); }
                else if p4.exists() { mpv_path = p4.to_string_lossy().to_string(); }
            }
        }
        
        log_debug(&format!("Starting MPV from path: {}", mpv_path));

        let mpv_child = Command::new(&mpv_path)
          .arg(format!("--wid={}", hwnd_ptr))
          .arg("--no-osc")
          .arg("--no-input-default-bindings")
          .arg("--idle=yes")
          .arg("--force-window=yes")
          .arg("--hwdec=auto-safe")
          .arg("--vo=gpu-next")
          .arg("--input-ipc-server=\\\\.\\pipe\\iptv-mpv-pipe")
          .arg("--log-file=mpv_debug.log")
          .spawn();
                if let Ok(child) = mpv_child {
            log_debug("Successfully spawned MPV");
            let state: tauri::State<AppState> = app.state();
            *state.mpv_process.lock().unwrap() = Some(child);
        } else {
            log_debug("FAILED TO SPAWN MPV!");
            eprintln!("Failed to start MPV process. Is mpv in PATH?");
        }

      Ok(())
    })
    .on_window_event(|_window, event| match event {
        WindowEvent::Resized(_) | WindowEvent::Moved(_) => {}
        _ => {}
    })
    .invoke_handler(tauri::generate_handler![
        mpv_check, mpv_state, mpv_load, mpv_play, mpv_stop, mpv_pause, mpv_seek, mpv_volume, mpv_geometry,
        window_minimize, window_maximize, window_close, window_fullscreen
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
