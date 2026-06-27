use std::process::{Child, Command};
use std::sync::{Arc, Mutex};
use tauri::{Manager, WindowEvent};
use std::collections::HashMap;

mod epg;

struct AppState {
    mpv_process: Mutex<Option<Child>>,
}

struct ActiveDownloads(Arc<Mutex<HashMap<String, u32>>>);

#[derive(Clone, serde::Serialize)]
struct DownloadProgress {
    url: String,
    progress: f64,
    downloaded: u64,
    total: u64,
}

#[tauri::command]
async fn download_direct(url: String, save_path: String, app: tauri::AppHandle) -> Result<(), String> {
    use std::io::Write;
    use futures_util::StreamExt;
    use tauri::Emitter;

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;
        
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    
    // Check for HTTP errors
    let res = res.error_for_status().map_err(|e| format!("HTTP Error: {}", e))?;

    // Check if it's actually an HLS stream (M3U8) disguised as an MP4
    if let Some(content_type) = res.headers().get(reqwest::header::CONTENT_TYPE) {
        let ct_str = content_type.to_str().unwrap_or("").to_lowercase();
        if ct_str.contains("mpegurl") || ct_str.contains("m3u8") {
            return Err("STREAM_IS_HLS".to_string());
        }
    }

    let total_size = res.content_length().unwrap_or(0);
    
    if total_size > 0 && total_size < 1_000_000 {
        return Err("STREAM_IS_TOO_SMALL_PROBABLY_HLS".to_string());
    }

    // Реєструємо HTTP-завантаження з sentinel PID=0 для підтримки скасування
    if let Some(state) = app.try_state::<ActiveDownloads>() {
        state.0.lock().unwrap().insert(url.clone(), 0);
    }

    let mut file = std::fs::File::create(&save_path).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;

    let mut stream = res.bytes_stream();
    let mut last_emit = std::time::Instant::now();

    while let Some(chunk) = stream.next().await {
        // Перевіряємо чи завантаження не було скасоване
        let canceled = if let Some(state) = app.try_state::<ActiveDownloads>() {
            !state.0.lock().unwrap().contains_key(&url)
        } else {
            false
        };
        if canceled {
            drop(file);
            let _ = std::fs::remove_file(&save_path);
            return Err("canceled".to_string());
        }

        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        if last_emit.elapsed().as_millis() > 500 {
            let progress = if total_size > 0 {
                (downloaded as f64 / total_size as f64) * 100.0
            } else {
                0.0
            };

            let _ = app.emit("download-progress", DownloadProgress {
                url: url.clone(),
                progress,
                downloaded,
                total: total_size,
            });
            last_emit = std::time::Instant::now();
        }
    }
    
    // Explicitly drop file so we can delete it if needed
    drop(file);

    if downloaded < 1_000_000 {
        let _ = std::fs::remove_file(&save_path);
        return Err("FILE_TOO_SMALL".to_string());
    }

    // Видаляємо запис з ActiveDownloads після успішного завершення
    if let Some(state) = app.try_state::<ActiveDownloads>() {
        state.0.lock().unwrap().remove(&url);
    }

    // Emit 100% when done
    let _ = app.emit("download-progress", DownloadProgress {
        url: url.clone(),
        progress: 100.0,
        downloaded,
        total: total_size,
    });

    Ok(())
}

#[tauri::command]
async fn download_hls(url: String, save_path: String, duration_sec: f64, app: tauri::AppHandle) -> Result<(), String> {
    use std::process::{Command, Stdio};
    use std::io::{BufRead, BufReader};
    use tauri::Emitter;

    let mut ffmpeg_path = String::from("ffmpeg");
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let p1 = exe_dir.join("resources/ffmpeg/ffmpeg.exe");
            let p2 = exe_dir.join("../../../resources/ffmpeg/ffmpeg.exe");
            let p3 = std::path::Path::new("../resources/ffmpeg/ffmpeg.exe");

            if p1.exists() { ffmpeg_path = p1.to_string_lossy().to_string(); }
            else if p2.exists() { ffmpeg_path = p2.to_string_lossy().to_string(); }
            else if p3.exists() { ffmpeg_path = p3.to_string_lossy().to_string(); }
        }
    }

    let user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    let mut cmd = Command::new(&ffmpeg_path);
    cmd.args(&[
        "-y", 
        "-user_agent", user_agent,
        "-i", &url, 
        "-c", "copy", 
        &save_path
    ])
    .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

    let pid = child.id();
    if let Some(state) = app.try_state::<ActiveDownloads>() {
        state.0.lock().unwrap().insert(url.clone(), pid);
    }

    let stderr = child.stderr.take().unwrap();
    let reader = BufReader::new(stderr);
    let mut last_emit = std::time::Instant::now();
    let mut last_error_line = String::new();

    for line_res in reader.split(b'\r') {
        if let Ok(line_bytes) = line_res {
            let s = String::from_utf8_lossy(&line_bytes);
            
            // Зберігаємо можливі повідомлення про помилку (все, що не є прогресом і не пусте)
            let trimmed = s.trim();
            if !trimmed.is_empty() && !trimmed.starts_with("frame=") && !trimmed.starts_with("size=") {
                // Якщо рядок містить переноси рядків (\n), беремо останній значущий
                if let Some(last_part) = trimmed.lines().last() {
                    let cleaned = last_part.trim();
                    if !cleaned.is_empty() && !cleaned.starts_with("frame=") {
                        last_error_line = cleaned.to_string();
                    }
                }
            }

            let mut current_size_bytes: u64 = 0;
            if let Some(size_idx) = s.find("size=") {
                let size_str = &s[size_idx + 5..];
                let end_idx = size_str.find("kB").unwrap_or(size_str.len());
                let size_num_str = size_str[0..end_idx].trim();
                if let Ok(size_kb) = size_num_str.parse::<u64>() {
                    current_size_bytes = size_kb * 1024;
                }
            }

            if let Some(time_idx) = s.find("time=") {
                let time_str = &s[time_idx + 5..];
                if time_str.len() >= 11 {
                    let h: f64 = time_str[0..2].parse().unwrap_or(0.0);
                    let m: f64 = time_str[3..5].parse().unwrap_or(0.0);
                    let s_sec: f64 = time_str[6..8].parse().unwrap_or(0.0);
                    let current_sec = h * 3600.0 + m * 60.0 + s_sec;

                    if last_emit.elapsed().as_millis() > 500 {
                        let progress = if duration_sec > 0.0 {
                            (current_sec / duration_sec) * 100.0
                        } else {
                            -1.0
                        };

                        let _ = app.emit("download-progress", DownloadProgress {
                            url: url.clone(),
                            progress,
                            downloaded: current_size_bytes,
                            total: 0,
                        });
                        last_emit = std::time::Instant::now();
                    }
                }
            }
        }
    }

    let status = child.wait().map_err(|e| e.to_string())?;
    
    let was_canceled = if let Some(state) = app.try_state::<ActiveDownloads>() {
        // remove returns None if it was already removed by cancel_download
        state.0.lock().unwrap().remove(&url).is_none()
    } else {
        false
    };

    if was_canceled {
        return Err("canceled".to_string());
    }

    if !status.success() {
        let err_msg = if last_error_line.is_empty() {
            "Unknown ffmpeg error".to_string()
        } else {
            last_error_line
        };
        return Err(format!("ffmpeg failed: {}", err_msg));
    }

    let file_size = std::fs::metadata(&save_path).map(|m| m.len()).unwrap_or(0);
    let _ = app.emit("download-progress", DownloadProgress {
        url: url.clone(),
        progress: 100.0,
        downloaded: file_size,
        total: file_size,
    });

    Ok(())
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

    if let Ok(mut pipe) = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(r#"\\.\pipe\iptv-mpv-pipe"#)
    {
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
    match std::fs::OpenOptions::new()
        .write(true)
        .open(r#"\\.\pipe\iptv-mpv-pipe"#)
    {
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
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open("app_debug.log")
    {
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
fn window_minimize(window: tauri::Window) {
    window.minimize().unwrap();
}

#[tauri::command]
fn window_maximize(window: tauri::Window) {
    if window.is_maximized().unwrap() {
        window.unmaximize().unwrap();
    } else {
        window.maximize().unwrap();
    }
}

#[tauri::command]
fn window_close(window: tauri::Window) {
    window.close().unwrap();
}

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
        send_mpv_command(&format!(
            "set video-margin-ratio-bottom {:.4}",
            ratio_bottom
        ));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .manage(AppState {
            mpv_process: Mutex::new(None),
        })
        .setup(|app| {
            app.manage(ActiveDownloads(std::sync::Arc::new(std::sync::Mutex::new(HashMap::new()))));
            app.manage(epg::EpgState(std::sync::Arc::new(std::sync::RwLock::new(HashMap::new()))));
            
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

                    if p1.exists() {
                        mpv_path = p1.to_string_lossy().to_string();
                    } else if p2.exists() {
                        mpv_path = p2.to_string_lossy().to_string();
                    } else if p3.exists() {
                        mpv_path = p3.to_string_lossy().to_string();
                    }
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
            mpv_check,
            mpv_state,
            mpv_load,
            mpv_play,
            mpv_stop,
            mpv_pause,
            mpv_seek,
            mpv_volume,
            mpv_geometry,
            window_minimize,
            window_maximize,
            window_close,
            window_fullscreen,
            download_direct,
            download_hls,
            cancel_download,
            epg::sync_epg,
            epg::get_current_programs,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            tauri::RunEvent::Exit => {
                // Зупиняємо MPV процес
                if let Some(state) = app_handle.try_state::<AppState>() {
                    if let Some(mut child) = state.mpv_process.lock().unwrap().take() {
                        let _ = child.kill();
                    }
                }
                // Зупиняємо активні завантаження (ffmpeg)
                if let Some(state) = app_handle.try_state::<ActiveDownloads>() {
                    let pids: Vec<u32> = state.0.lock().unwrap().values().cloned().collect();
                    for pid in pids {
                        // Sentinel PID=0 — це HTTP-завантаження, taskkill не потрібен
                        if pid == 0 {
                            continue;
                        }
                        #[cfg(target_os = "windows")]
                        let _ = std::process::Command::new("taskkill")
                            .args(&["/F", "/T", "/PID", &pid.to_string()])
                            .spawn();
                            
                        #[cfg(not(target_os = "windows"))]
                        let _ = std::process::Command::new("kill")
                            .args(&["-9", &pid.to_string()])
                            .spawn();
                    }
                }
            }
            _ => {}
        });
}

#[tauri::command]
fn cancel_download(url: String, app: tauri::AppHandle) -> Result<(), String> {
    if let Some(state) = app.try_state::<ActiveDownloads>() {
        let pid_opt = state.0.lock().unwrap().remove(&url);
        if let Some(pid) = pid_opt {
            // Sentinel PID=0 — HTTP-завантаження, taskkill не потрібен (цикл сам зупиниться)
            if pid > 0 {
                #[cfg(target_os = "windows")]
                let _ = std::process::Command::new("taskkill")
                    .args(&["/F", "/T", "/PID", &pid.to_string()])
                    .spawn();
                    
                #[cfg(not(target_os = "windows"))]
                let _ = std::process::Command::new("kill")
                    .args(&["-9", &pid.to_string()])
                    .spawn();
            }
        }
    }
    Ok(())
}
