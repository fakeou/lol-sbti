#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::{Local, TimeZone};
use reqwest::blocking::Client;
use serde::Serialize;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    ffi::c_void,
    fs::File,
    io::{self, Write},
    mem::{size_of, zeroed},
    path::PathBuf,
    ptr::null_mut,
    slice,
};
use windows_sys::Win32::{
    Foundation::{CloseHandle, INVALID_HANDLE_VALUE},
    System::{
        Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
            TH32CS_SNAPPROCESS,
        },
        Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION},
    },
};

const PROCESS_COMMAND_LINE_INFORMATION: u32 = 60;
const HISTORY_PAGE_SIZE: usize = 50;
const MAX_MATCHES: usize = 100;

#[link(name = "ntdll")]
extern "system" {
    fn NtQueryInformationProcess(
        process_handle: *mut c_void,
        process_information_class: u32,
        process_information: *mut c_void,
        process_information_length: u32,
        return_length: *mut u32,
    ) -> i32;
}

#[repr(C)]
struct UnicodeString {
    length: u16,
    maximum_length: u16,
    buffer: *const u16,
}

#[derive(Clone)]
struct LcuConnection {
    port: u16,
    token: String,
    client: Client,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LcuStatus {
    connected: bool,
    username: String,
}

#[derive(Serialize)]
struct ExportResult {
    path: String,
    count: usize,
}

#[derive(Serialize)]
struct CsvMatch {
    match_time: String,
    queue: String,
    game_mode: String,
    result: String,
    champion: String,
    kills: i64,
    deaths: i64,
    assists: i64,
    kill_participation_percent: Option<f64>,
    cs: i64,
    gold: i64,
    champion_damage: i64,
    damage_share_percent: Option<f64>,
    damage_taken: i64,
    healing: i64,
    vision_score: i64,
    wards_placed: i64,
    wards_killed: i64,
    position: String,
    items: String,
    duration_minutes: f64,
}

impl LcuConnection {
    fn get(&self, path: &str) -> Result<Value, String> {
        if !path.starts_with('/') {
            return Err("LCU 路径无效".into());
        }
        let url = format!("https://127.0.0.1:{}{}", self.port, path);
        self.client
            .get(url)
            .basic_auth("riot", Some(&self.token))
            .send()
            .map_err(|_| "LCU 请求失败".to_string())?
            .error_for_status()
            .map_err(|_| "LCU 返回错误状态".to_string())?
            .json()
            .map_err(|_| "LCU 返回的数据格式无效".to_string())
    }
}

fn process_ids_by_name(expected: &str) -> Result<Vec<u32>, String> {
    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if snapshot == INVALID_HANDLE_VALUE {
        return Err("无法枚举进程".into());
    }

    let mut ids = Vec::new();
    let mut entry: PROCESSENTRY32W = unsafe { zeroed() };
    entry.dwSize = size_of::<PROCESSENTRY32W>() as u32;
    let mut ok = unsafe { Process32FirstW(snapshot, &mut entry) } != 0;
    while ok {
        let end = entry
            .szExeFile
            .iter()
            .position(|value| *value == 0)
            .unwrap_or(entry.szExeFile.len());
        let name = String::from_utf16_lossy(&entry.szExeFile[..end]);
        if name.eq_ignore_ascii_case(expected) {
            ids.push(entry.th32ProcessID);
        }
        ok = unsafe { Process32NextW(snapshot, &mut entry) } != 0;
    }
    unsafe { CloseHandle(snapshot) };
    Ok(ids)
}

fn read_process_command_line(pid: u32) -> Result<String, String> {
    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
    if handle.is_null() {
        return Err("无法打开客户端进程".into());
    }

    let result = (|| {
        let mut required = 0u32;
        unsafe {
            NtQueryInformationProcess(
                handle,
                PROCESS_COMMAND_LINE_INFORMATION,
                null_mut(),
                0,
                &mut required,
            );
        }
        if required == 0 {
            return Err("无法读取客户端连接参数".into());
        }

        let mut storage = vec![0u8; required as usize];
        let status = unsafe {
            NtQueryInformationProcess(
                handle,
                PROCESS_COMMAND_LINE_INFORMATION,
                storage.as_mut_ptr().cast(),
                required,
                &mut required,
            )
        };
        if status != 0 {
            return Err("无法读取客户端连接参数".into());
        }

        let value = unsafe { &*(storage.as_ptr().cast::<UnicodeString>()) };
        if value.buffer.is_null() || value.length == 0 {
            return Err("客户端连接参数为空".into());
        }
        let wide = unsafe { slice::from_raw_parts(value.buffer, (value.length / 2) as usize) };
        Ok(String::from_utf16_lossy(wide))
    })();

    unsafe { CloseHandle(handle) };
    result
}

fn command_argument(command_line: &str, name: &str) -> Option<String> {
    let marker = format!("--{name}=");
    let start = command_line.find(&marker)? + marker.len();
    let rest = &command_line[start..];
    if let Some(quoted) = rest.strip_prefix('"') {
        return quoted.split('"').next().map(ToOwned::to_owned);
    }
    Some(
        rest.split(|character: char| character.is_whitespace() || character == '"')
            .next()?
            .to_owned(),
    )
}

fn discover_connections() -> Result<Vec<LcuConnection>, String> {
    let mut connections = Vec::new();
    for pid in process_ids_by_name("LeagueClientUx.exe")? {
        let Ok(command_line) = read_process_command_line(pid) else {
            continue;
        };
        let Some(port) =
            command_argument(&command_line, "app-port").and_then(|value| value.parse::<u16>().ok())
        else {
            continue;
        };
        let Some(token) = command_argument(&command_line, "remoting-auth-token") else {
            continue;
        };
        let client = Client::builder()
            .danger_accept_invalid_certs(true)
            .no_proxy()
            .build()
            .map_err(|_| "无法创建本地 LCU 客户端".to_string())?;
        connections.push(LcuConnection {
            port,
            token,
            client,
        });
    }
    if connections.is_empty() {
        Err("未检测到已登录的英雄联盟客户端".into())
    } else {
        Ok(connections)
    }
}

fn current_connection() -> Result<(LcuConnection, Value), String> {
    for connection in discover_connections()? {
        if let Ok(summoner) = connection.get("/lol-summoner/v1/current-summoner") {
            if summoner.get("puuid").and_then(Value::as_str).is_some() {
                return Ok((connection, summoner));
            }
        }
    }
    Err("客户端尚未完成登录".into())
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

fn value_i64(value: &Value, key: &str) -> i64 {
    value.get(key).and_then(Value::as_i64).unwrap_or(0)
}

fn player_participant_id(game: &Value, summoner: &Value) -> Option<i64> {
    let expected = ["puuid", "accountId", "summonerId"];
    game.get("participantIdentities")?
        .as_array()?
        .iter()
        .find_map(|identity| {
            let player = identity.get("player")?;
            let matched = expected.iter().any(|key| {
                let left = player.get(*key).map(Value::to_string);
                let right = summoner.get(*key).map(Value::to_string);
                left.is_some() && left == right
            });
            matched
                .then(|| identity.get("participantId")?.as_i64())
                .flatten()
        })
}

fn participant_by_id<'a>(game: &'a Value, participant_id: i64) -> Option<&'a Value> {
    game.get("participants")?
        .as_array()?
        .iter()
        .find(|item| item.get("participantId").and_then(Value::as_i64) == Some(participant_id))
}

fn queue_name(queue_id: i64) -> String {
    match queue_id {
        420 => "单双排".into(),
        430 => "匹配模式".into(),
        440 => "灵活排位".into(),
        450 => "极地大乱斗".into(),
        1700 => "斗魂竞技场".into(),
        2400 => "特殊模式".into(),
        value => format!("队列 {value}"),
    }
}

fn champion_names(connection: &LcuConnection) -> HashMap<i64, String> {
    connection
        .get("/lol-game-data/assets/v1/champion-summary.json")
        .ok()
        .and_then(|value| value.as_array().cloned())
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| {
            Some((
                item.get("id")?.as_i64()?,
                item.get("name")?.as_str()?.to_owned(),
            ))
        })
        .collect()
}

fn csv_row(
    list_game: &Value,
    detail: Option<&Value>,
    summoner: &Value,
    champions: &HashMap<i64, String>,
) -> Result<CsvMatch, String> {
    let participant_id = player_participant_id(list_game, summoner)
        .ok_or_else(|| "无法在对局中定位当前用户".to_string())?;
    let participant = detail
        .and_then(|game| participant_by_id(game, participant_id))
        .or_else(|| participant_by_id(list_game, participant_id))
        .ok_or_else(|| "对局缺少当前用户统计".to_string())?;
    let stats = participant.get("stats").unwrap_or(&Value::Null);

    let team_id = participant.get("teamId").and_then(Value::as_i64);
    let team = detail
        .and_then(|game| game.get("participants"))
        .and_then(Value::as_array)
        .map(|participants| {
            participants
                .iter()
                .filter(|item| item.get("teamId").and_then(Value::as_i64) == team_id)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let team_kills: i64 = team
        .iter()
        .map(|item| value_i64(item.get("stats").unwrap_or(&Value::Null), "kills"))
        .sum();
    let team_damage: i64 = team
        .iter()
        .map(|item| {
            value_i64(
                item.get("stats").unwrap_or(&Value::Null),
                "totalDamageDealtToChampions",
            )
        })
        .sum();

    let kills = value_i64(stats, "kills");
    let assists = value_i64(stats, "assists");
    let champion_damage = value_i64(stats, "totalDamageDealtToChampions");
    let game_creation = value_i64(list_game, "gameCreation");
    let match_time = Local
        .timestamp_millis_opt(game_creation)
        .single()
        .map(|time| time.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_default();
    let champion_id = participant
        .get("championId")
        .and_then(Value::as_i64)
        .unwrap_or_default();
    let timeline = participant.get("timeline").unwrap_or(&Value::Null);
    let lane = timeline.get("lane").and_then(Value::as_str).unwrap_or("");
    let role = timeline.get("role").and_then(Value::as_str).unwrap_or("");
    let position = [lane, role]
        .into_iter()
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join("/");
    let items = (0..=6)
        .map(|index| value_i64(stats, &format!("item{index}")))
        .filter(|item| *item > 0)
        .map(|item| item.to_string())
        .collect::<Vec<_>>()
        .join("|");

    Ok(CsvMatch {
        match_time,
        queue: queue_name(value_i64(list_game, "queueId")),
        game_mode: list_game
            .get("gameMode")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_owned(),
        result: if stats.get("win").and_then(Value::as_bool).unwrap_or(false) {
            "胜利".into()
        } else {
            "失败".into()
        },
        champion: champions
            .get(&champion_id)
            .cloned()
            .unwrap_or_else(|| champion_id.to_string()),
        kills,
        deaths: value_i64(stats, "deaths"),
        assists,
        kill_participation_percent: (team_kills > 0)
            .then(|| ((kills + assists) as f64 * 1000.0 / team_kills as f64).round() / 10.0),
        cs: value_i64(stats, "totalMinionsKilled") + value_i64(stats, "neutralMinionsKilled"),
        gold: value_i64(stats, "goldEarned"),
        champion_damage,
        damage_share_percent: (team_damage > 0)
            .then(|| (champion_damage as f64 * 1000.0 / team_damage as f64).round() / 10.0),
        damage_taken: value_i64(stats, "totalDamageTaken"),
        healing: value_i64(stats, "totalHeal"),
        vision_score: value_i64(stats, "visionScore"),
        wards_placed: value_i64(stats, "wardsPlaced"),
        wards_killed: value_i64(stats, "wardsKilled"),
        position,
        items,
        duration_minutes: (value_i64(list_game, "gameDuration") as f64 / 6.0).round() / 10.0,
    })
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

fn export_matches_to(directory: PathBuf) -> Result<ExportResult, String> {
    let (connection, summoner) = current_connection()?;
    let puuid = summoner
        .get("puuid")
        .and_then(Value::as_str)
        .ok_or_else(|| "当前用户缺少必要标识".to_string())?;
    let games = recent_games(&connection, puuid)?;
    if games.is_empty() {
        return Err("没有可导出的近期对局".into());
    }

    let champions = champion_names(&connection);
    let output_path = directory.join("lcu-recent-matches.csv");
    let mut file = File::create(&output_path).map_err(|_| "无法创建 CSV 文件".to_string())?;
    file.write_all(&[0xEF, 0xBB, 0xBF])
        .map_err(|_| "无法初始化 CSV 文件".to_string())?;
    let mut writer = csv::WriterBuilder::new()
        .has_headers(true)
        .from_writer(file);
    let mut count = 0usize;

    for game in &games {
        let detail = game
            .get("gameId")
            .map(Value::to_string)
            .and_then(|game_id| {
                connection
                    .get(&format!("/lol-match-history/v1/games/{game_id}"))
                    .ok()
            });
        let row = csv_row(game, detail.as_ref(), &summoner, &champions)?;
        writer
            .serialize(row)
            .map_err(|_| "写入 CSV 失败".to_string())?;
        count += 1;
    }
    writer.flush().map_err(|_| "保存 CSV 失败".to_string())?;

    Ok(ExportResult {
        path: output_path.to_string_lossy().into_owned(),
        count,
    })
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
fn export_recent_matches() -> Result<ExportResult, String> {
    let directory = std::env::current_dir().map_err(|_| "无法确定当前目录".to_string())?;
    export_matches_to(directory)
}

fn main() {
    if std::env::args().any(|argument| argument == "--export-once") {
        let result = std::env::current_dir()
            .map_err(|error| io::Error::new(error.kind(), "无法确定当前目录"))
            .and_then(|directory| export_matches_to(directory).map_err(io::Error::other));
        match result {
            Ok(exported) => println!("{}", serde_json::to_string(&exported).unwrap_or_default()),
            Err(error) => {
                eprintln!("导出失败：{error}");
                std::process::exit(1);
            }
        }
        return;
    }

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_lcu_status,
            export_recent_matches
        ])
        .run(tauri::generate_context!())
        .expect("无法启动 Tauri 应用");
}
