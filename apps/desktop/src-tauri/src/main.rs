#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod analysis;

use serde::Serialize;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use tauri::Manager;
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LcuStatus {
    connected: bool,
    username: String,
}
const HISTORY_PAGE_SIZE: usize = 50;
const MAX_MATCHES: usize = 100;
type LcuConnection = lcu_client::Connection;

fn current_connection() -> Result<(LcuConnection, Value), String> {
    lcu_client::current()
}

fn display_name(summoner: &Value) -> String {
    match (
        summoner.get("gameName").and_then(Value::as_str),
        summoner.get("tagLine").and_then(Value::as_str),
    ) {
        (Some(name), Some(tag)) if !name.is_empty() => format!("{name}#{tag}"),
        _ => summoner
            .get("displayName")
            .and_then(Value::as_str)
            .unwrap_or("已登录用户")
            .to_owned(),
    }
}

fn recent_games(connection: &LcuConnection, puuid: &str) -> Result<Vec<Value>, String> {
    let mut seen_game_ids = HashSet::new();
    let mut recent_games = Vec::new();

    for begin in (0..MAX_MATCHES).step_by(HISTORY_PAGE_SIZE) {
        let end = begin + HISTORY_PAGE_SIZE - 1;
        let path = format!(
            "/lol-match-history/v1/products/lol/{puuid}/matches?begIndex={begin}&endIndex={end}"
        );
        let history = connection.get(&path)?;
        let games = history
            .pointer("/games/games")
            .and_then(Value::as_array)
            .ok_or_else(|| "LCU 未返回对局列表".to_string())?;
        if games.is_empty() {
            break;
        }

        let mut added_on_page = 0usize;
        for game in games {
            let Some(game_id) = game.get("gameId").map(Value::to_string) else {
                continue;
            };
            if seen_game_ids.insert(game_id) {
                recent_games.push(game.clone());
                added_on_page += 1;
                if recent_games.len() == MAX_MATCHES {
                    break;
                }
            }
        }

        // 部分 LCU 会在深分页时重复返回第一页；没有新增记录时立即停止。
        if games.len() < HISTORY_PAGE_SIZE
            || added_on_page == 0
            || recent_games.len() == MAX_MATCHES
        {
            break;
        }
    }

    Ok(recent_games)
}

#[tauri::command]
fn get_lcu_status() -> LcuStatus {
    match current_connection() {
        Ok((_, summoner)) => LcuStatus {
            connected: true,
            username: display_name(&summoner),
        },
        Err(_) => LcuStatus {
            connected: false,
            username: String::new(),
        },
    }
}

#[tauri::command]
fn preview_matches() -> Result<analysis::Preview, String> {
    let (connection, summoner) = current_connection()?;
    let puuid = summoner
        .get("puuid")
        .and_then(Value::as_str)
        .ok_or("当前用户缺少必要标识")?;
    let games = recent_games(&connection, puuid)?;
    let sanitized = match_sanitizer::sanitize_matches(&games, &summoner)?;
    let matches = sanitized.matches;
    let from = matches
        .iter()
        .map(|item| item.occurred_at.clone())
        .min()
        .unwrap_or_default();
    let to = matches
        .iter()
        .map(|item| item.occurred_at.clone())
        .max()
        .unwrap_or_default();
    let mut modes = HashMap::new();
    for item in &matches {
        *modes.entry(item.game_mode.clone()).or_insert(0) += 1;
    }
    Ok(analysis::Preview {
        count: matches.len(),
        from,
        to,
        modes,
        skipped: sanitized.skipped,
        skip_reasons: sanitized.skip_reasons,
        request: match_sanitizer::request(matches, env!("CARGO_PKG_VERSION")),
    })
}

#[tauri::command]
fn create_analysis(
    request: match_sanitizer::CreateAnalysisRequestV1,
    state: tauri::State<analysis::State>,
) -> Result<analysis::Status, String> {
    match_sanitizer::validate_request(&request)?;
    analysis::create(&state, &request)
}
#[tauri::command]
fn recover_analysis(
    state: tauri::State<analysis::State>,
) -> Result<Option<analysis::Status>, String> {
    analysis::recover(&state)
}
#[tauri::command]
fn analysis_status(
    id: String,
    state: tauri::State<analysis::State>,
) -> Result<analysis::Status, String> {
    analysis::status(&state, &id)
}
#[tauri::command]
fn analysis_action(
    id: String,
    kind: String,
    state: tauri::State<analysis::State>,
) -> Result<(), String> {
    analysis::action(&state, &id, &kind)
}
#[tauri::command]
fn open_report(url: String, state: tauri::State<analysis::State>) -> Result<(), String> {
    analysis::open_report(&state, &url)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let state = analysis::State::new(app.handle())?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_lcu_status,
            preview_matches,
            create_analysis,
            recover_analysis,
            analysis_status,
            analysis_action,
            open_report
        ])
        .run(tauri::generate_context!())
        .expect("无法启动 Tauri 应用");
}
