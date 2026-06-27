use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use serde::{Deserialize, Serialize};
use quick_xml::events::Event;
use quick_xml::Reader;
use chrono::DateTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpgProgram {
    pub title: String,
    #[serde(rename = "description")]
    pub desc: String,
    #[serde(rename = "startTime")]
    pub start: i64,
    #[serde(rename = "endTime")]
    pub stop: i64,
}

pub struct EpgState(pub Arc<RwLock<HashMap<String, Vec<EpgProgram>>>>);

#[tauri::command]
pub async fn sync_epg(url: String, state: tauri::State<'_, EpgState>) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0")
        .build()
        .map_err(|e| e.to_string())?;
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let xml_text = res.text().await.map_err(|e| e.to_string())?;

    let parsed = parse_xmltv(&xml_text);
    
    let mut cache = state.0.write().unwrap();
    *cache = parsed;
    
    Ok(())
}

#[tauri::command]
pub async fn get_current_programs(
    channel_ids: Vec<String>,
    state: tauri::State<'_, EpgState>,
) -> Result<HashMap<String, Vec<EpgProgram>>, String> {
    let cache = state.0.read().unwrap();
    let mut result = HashMap::new();
    let now = chrono::Utc::now().timestamp();

    for id in channel_ids {
        if let Some(programs) = cache.get(&id) {
            // Фільтруємо поточні та майбутні програми (беремо ту, що йде зараз, і наступну)
            let mut relevant = Vec::new();
            for p in programs {
                if p.stop > now {
                    relevant.push(p.clone());
                }
                if relevant.len() >= 2 {
                    break;
                }
            }
            if !relevant.is_empty() {
                result.insert(id.clone(), relevant);
            }
        }
    }

    Ok(result)
}

fn parse_xmltv(xml: &str) -> HashMap<String, Vec<EpgProgram>> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut map: HashMap<String, Vec<EpgProgram>> = HashMap::new();
    let mut buf = Vec::new();
    
    let mut current_channel = String::new();
    let mut current_start = 0;
    let mut current_stop = 0;
    let mut current_title = String::new();
    let mut current_desc = String::new();
    
    let mut in_programme = false;
    let mut in_title = false;
    let mut in_desc = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                match e.name().as_ref() {
                    b"programme" => {
                        in_programme = true;
                        current_title.clear();
                        current_desc.clear();
                        current_channel.clear();
                        current_start = 0;
                        current_stop = 0;
                        
                        for attr in e.attributes().filter_map(Result::ok) {
                            match attr.key.as_ref() {
                                b"channel" => {
                                    if let Ok(v) = std::str::from_utf8(attr.value.as_ref()) {
                                        current_channel = v.to_string();
                                    }
                                }
                                b"start" => {
                                    if let Ok(v) = std::str::from_utf8(attr.value.as_ref()) {
                                        current_start = parse_time(v);
                                    }
                                }
                                b"stop" => {
                                    if let Ok(v) = std::str::from_utf8(attr.value.as_ref()) {
                                        current_stop = parse_time(v);
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                    b"title" if in_programme => in_title = true,
                    b"desc" if in_programme => in_desc = true,
                    _ => {}
                }
            }
            Ok(Event::Text(e)) => {
                if in_title {
                    if let Ok(t) = std::str::from_utf8(&e) {
                        current_title = t.to_string();
                    }
                } else if in_desc {
                    if let Ok(t) = std::str::from_utf8(&e) {
                        current_desc = t.to_string();
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                match e.name().as_ref() {
                    b"programme" => {
                        in_programme = false;
                        if !current_channel.is_empty() {
                            let prog = EpgProgram {
                                title: current_title.clone(),
                                desc: current_desc.clone(),
                                start: current_start,
                                stop: current_stop,
                            };
                            map.entry(current_channel.clone()).or_default().push(prog);
                        }
                    }
                    b"title" => in_title = false,
                    b"desc" => in_desc = false,
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break, // Skip malformed XML gracefully
            _ => {}
        }
        buf.clear();
    }

    // Сортуємо програми за часом початку для кожного каналу
    for programs in map.values_mut() {
        programs.sort_by_key(|p| p.start);
    }

    map
}

fn parse_time(time_str: &str) -> i64 {
    // XMLTV format: "20080715003000 -0600" or "20080715003000"
    if let Ok(dt) = DateTime::parse_from_str(time_str, "%Y%m%d%H%M%S %z") {
        return dt.timestamp() * 1000;
    }
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(time_str, "%Y%m%d%H%M%S") {
        return dt.and_utc().timestamp() * 1000;
    }
    
    let cleaned = time_str.split(' ').next().unwrap_or("");
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(cleaned, "%Y%m%d%H%M%S") {
         return dt.and_utc().timestamp() * 1000;
    }

    0
}
