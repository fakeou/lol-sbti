use chrono::{SecondsFormat, TimeZone, Timelike, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

pub const MIN_MATCHES: usize = 5;
pub const MAX_MATCHES: usize = 100;
pub const MAX_HISTORY_MATCHES: usize = 1000;
const MODES: [&str; 4] = ["CLASSIC", "ARAM", "URF", "CHERRY"];
const POSITIONS: [&str; 5] = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateAnalysisRequestV1 {
    pub schema_version: u8,
    pub locale: String,
    pub generated_at: String,
    pub client_version: String,
    pub matches: Vec<UploadMatchV1>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UploadMatchV1 {
    pub occurred_at: String,
    pub queue_id: u16,
    pub game_mode: String,
    pub duration_seconds: u32,
    pub champion_id: u16,
    pub position: Option<String>,
    pub won: bool,
    pub kills: u16,
    pub deaths: u16,
    pub assists: u16,
    pub cs: u16,
    pub gold: u32,
    pub champion_damage: u32,
    pub damage_taken: u32,
    pub healing: u32,
    pub vision_score: u16,
    pub wards_placed: u16,
    pub wards_killed: u16,
    pub items: Vec<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HistoryMatchV1 {
    #[serde(flatten)]
    pub matched: UploadMatchV1,
    pub match_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HistorySyncRequestV1 {
    pub schema_version: u8,
    pub matches: Vec<HistoryMatchV1>,
}

pub fn match_key(value: &UploadMatchV1) -> String {
    use sha2::{Digest, Sha256};
    let mut digest = Sha256::new();
    digest.update(serde_json::to_vec(value).unwrap_or_default());
    digest
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SanitizationResult {
    pub matches: Vec<UploadMatchV1>,
    pub skipped: usize,
    pub skip_reasons: BTreeMap<String, usize>,
}

#[derive(Debug, Clone, Copy)]
enum SkipReason {
    UserNotFound,
    UnsupportedMode,
    CorruptMatch,
}
impl SkipReason {
    fn label(self) -> &'static str {
        match self {
            Self::UserNotFound => "无法定位当前用户",
            Self::UnsupportedMode => "不支持的模式",
            Self::CorruptMatch => "对局数据损坏或不完整",
        }
    }
}

pub fn sanitize_matches(games: &[Value], summoner: &Value) -> Result<SanitizationResult, String> {
    let mut matches = Vec::new();
    let mut skip_reasons = BTreeMap::new();
    for game in games {
        match sanitize_match(game, summoner) {
            Ok(item) if matches.len() < MAX_MATCHES => matches.push(item),
            Ok(_) => *skip_reasons.entry("超过 100 场上限".into()).or_insert(0) += 1,
            Err(reason) => *skip_reasons.entry(reason.label().into()).or_insert(0) += 1,
        }
    }
    if matches.len() < MIN_MATCHES {
        return Err(format!(
            "成功脱敏的可分析对局不足 {MIN_MATCHES} 场（当前 {} 场，已跳过 {} 场）",
            matches.len(),
            skip_reasons.values().sum::<usize>()
        ));
    }
    Ok(SanitizationResult {
        skipped: skip_reasons.values().sum(),
        matches,
        skip_reasons,
    })
}

pub fn sanitize_history(
    games: &[Value],
    summoner: &Value,
) -> Result<(Vec<HistoryMatchV1>, usize), String> {
    let mut matches = Vec::new();
    let mut skipped = 0usize;
    for game in games {
        match sanitize_match(game, summoner) {
            Ok(item) if matches.len() < MAX_HISTORY_MATCHES => matches.push(HistoryMatchV1 {
                match_key: match_key(&item),
                matched: item,
            }),
            Ok(_) | Err(_) => skipped += 1,
        }
    }
    Ok((matches, skipped))
}

pub fn sync_request(matches: Vec<HistoryMatchV1>) -> HistorySyncRequestV1 {
    HistorySyncRequestV1 {
        schema_version: 1,
        matches,
    }
}

pub fn validate_history_request(value: &HistorySyncRequestV1) -> Result<(), String> {
    if value.schema_version != 1
        || value.matches.is_empty()
        || value.matches.len() > MAX_HISTORY_MATCHES
    {
        return Err("上传数据不符合历史同步 V1 契约".into());
    }
    for item in &value.matches {
        if !valid_match_key(&item.match_key)
            || !valid_utc(&item.matched.occurred_at)
            || item.matched.queue_id > 10_000
            || !MODES.contains(&item.matched.game_mode.as_str())
            || !(1..=10_800).contains(&item.matched.duration_seconds)
            || !(1..=10_000).contains(&item.matched.champion_id)
            || item
                .matched
                .position
                .as_deref()
                .is_some_and(|position| !POSITIONS.contains(&position))
            || item.matched.kills > 100
            || item.matched.deaths > 100
            || item.matched.assists > 200
            || item.matched.cs > 2_000
            || item.matched.gold > 100_000
            || item.matched.champion_damage > 1_000_000
            || item.matched.damage_taken > 1_000_000
            || item.matched.healing > 1_000_000
            || item.matched.vision_score > 1_000
            || item.matched.wards_placed > 1_000
            || item.matched.wards_killed > 1_000
            || item.matched.items.len() > 10
            || item
                .matched
                .items
                .iter()
                .any(|id| *id > 10_000)
        {
            return Err("上传数据不符合历史同步 V1 契约".into());
        }
    }
    Ok(())
}

fn valid_match_key(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
}

pub fn request(matches: Vec<UploadMatchV1>, client_version: &str) -> CreateAnalysisRequestV1 {
    CreateAnalysisRequestV1 {
        schema_version: 1,
        locale: "zh-CN".into(),
        generated_at: Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true),
        client_version: client_version.into(),
        matches,
    }
}

pub fn validate_request(value: &CreateAnalysisRequestV1) -> Result<(), String> {
    if value.schema_version != 1
        || !matches!(value.locale.as_str(), "zh-CN" | "en-US")
        || !valid_utc(&value.generated_at)
        || value.client_version.is_empty()
        || value.client_version.len() > 64
        || !value
            .client_version
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._+-".contains(&b))
        || !(MIN_MATCHES..=MAX_MATCHES).contains(&value.matches.len())
    {
        return Err("上传数据不符合 V1 契约".into());
    }
    for item in &value.matches {
        if !valid_utc(&item.occurred_at)
            || item.queue_id > 10_000
            || !MODES.contains(&item.game_mode.as_str())
            || !(1..=10_800).contains(&item.duration_seconds)
            || !(1..=10_000).contains(&item.champion_id)
            || item
                .position
                .as_deref()
                .is_some_and(|position| !POSITIONS.contains(&position))
            || item.kills > 100
            || item.deaths > 100
            || item.assists > 200
            || item.cs > 2_000
            || item.gold > 100_000
            || item.champion_damage > 1_000_000
            || item.damage_taken > 1_000_000
            || item.healing > 1_000_000
            || item.vision_score > 1_000
            || item.wards_placed > 1_000
            || item.wards_killed > 1_000
            || item.items.len() > 10
            || item.items.iter().any(|id| *id > 10_000)
        {
            return Err("上传数据不符合 V1 契约".into());
        }
    }
    Ok(())
}

fn valid_utc(value: &str) -> bool {
    value.len() <= 30
        && value.ends_with('Z')
        && chrono::DateTime::parse_from_rfc3339(value)
            .map(|parsed| parsed.offset().local_minus_utc() == 0)
            .unwrap_or(false)
}

fn sanitize_match(game: &Value, summoner: &Value) -> Result<UploadMatchV1, SkipReason> {
    let participant_id = participant_id(game, summoner).ok_or(SkipReason::UserNotFound)?;
    let participant = game
        .get("participants")
        .and_then(Value::as_array)
        .and_then(|items| {
            items.iter().find(|item| {
                item.get("participantId").and_then(Value::as_i64) == Some(participant_id)
            })
        })
        .ok_or(SkipReason::CorruptMatch)?;
    let stats = participant.get("stats").ok_or(SkipReason::CorruptMatch)?;
    let timestamp = required_i64(game, "gameCreation")?;
    let occurred_at = Utc
        .timestamp_millis_opt(timestamp)
        .single()
        .ok_or(SkipReason::CorruptMatch)?
        .with_second(0)
        .and_then(|v| v.with_nanosecond(0))
        .ok_or(SkipReason::CorruptMatch)?
        .to_rfc3339_opts(SecondsFormat::Secs, true);
    let raw_mode = game
        .get("gameMode")
        .and_then(Value::as_str)
        .ok_or(SkipReason::CorruptMatch)?;
    if !MODES.contains(&raw_mode) {
        return Err(SkipReason::UnsupportedMode);
    }
    let timeline = participant.get("timeline").unwrap_or(&Value::Null);
    let position = normalize_position(
        timeline.get("lane").and_then(Value::as_str),
        timeline.get("role").and_then(Value::as_str),
    );
    let integer = |key: &str, max: i64| -> Result<u32, SkipReason> {
        let value = required_i64(stats, key)?;
        (0..=max)
            .contains(&value)
            .then_some(value as u32)
            .ok_or(SkipReason::CorruptMatch)
    };
    let champion_id = required_i64(participant, "championId")?;
    let queue_id = required_i64(game, "queueId")?;
    let duration = required_i64(game, "gameDuration")?;
    if !(1..=10_000).contains(&champion_id)
        || !(0..=10_000).contains(&queue_id)
        || !(1..=10_800).contains(&duration)
    {
        return Err(SkipReason::CorruptMatch);
    }
    let minions = integer("totalMinionsKilled", 2000)? + integer("neutralMinionsKilled", 2000)?;
    if minions > 2000 {
        return Err(SkipReason::CorruptMatch);
    }
    let items = (0..=6)
        .filter_map(|index| stats.get(format!("item{index}")).and_then(Value::as_i64))
        .filter(|item| *item > 0 && *item <= 10_000)
        .map(|item| item as u16)
        .collect();
    Ok(UploadMatchV1 {
        occurred_at,
        queue_id: queue_id as u16,
        game_mode: raw_mode.into(),
        duration_seconds: duration as u32,
        champion_id: champion_id as u16,
        position,
        won: stats
            .get("win")
            .and_then(Value::as_bool)
            .ok_or(SkipReason::CorruptMatch)?,
        kills: integer("kills", 100)? as u16,
        deaths: integer("deaths", 100)? as u16,
        assists: integer("assists", 200)? as u16,
        cs: minions as u16,
        gold: integer("goldEarned", 100_000)?,
        champion_damage: integer("totalDamageDealtToChampions", 1_000_000)?,
        damage_taken: integer("totalDamageTaken", 1_000_000)?,
        healing: integer("totalHeal", 1_000_000)?,
        vision_score: integer("visionScore", 1000)? as u16,
        wards_placed: integer("wardsPlaced", 1000)? as u16,
        wards_killed: integer("wardsKilled", 1000)? as u16,
        items,
    })
}
fn required_i64(value: &Value, key: &str) -> Result<i64, SkipReason> {
    value
        .get(key)
        .and_then(Value::as_i64)
        .ok_or(SkipReason::CorruptMatch)
}
fn participant_id(game: &Value, summoner: &Value) -> Option<i64> {
    game.get("participantIdentities")?
        .as_array()?
        .iter()
        .find_map(|identity| {
            let player = identity.get("player")?;
            ["puuid", "accountId", "summonerId"]
                .iter()
                .any(|key| {
                    let left = player.get(key).and_then(Value::as_str);
                    let right = summoner.get(key).and_then(Value::as_str);
                    left.is_some() && left == right && left != Some("")
                })
                .then(|| identity.get("participantId")?.as_i64())
                .flatten()
        })
}
fn normalize_position(lane: Option<&str>, role: Option<&str>) -> Option<String> {
    match (lane.unwrap_or(""), role.unwrap_or("")) {
        ("TOP", _) => Some("TOP".into()),
        ("JUNGLE", _) => Some("JUNGLE".into()),
        ("MIDDLE", _) | ("MID", _) => Some("MIDDLE".into()),
        ("BOTTOM", "DUO_SUPPORT") | ("BOTTOM", "SUPPORT") => Some("UTILITY".into()),
        ("BOTTOM", _) => Some("BOTTOM".into()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn game(index: usize) -> Value {
        json!({
            "gameId":format!("secret-{index}"),"gameCreation":1753351200123i64,"queueId":420,"gameMode":"CLASSIC","gameDuration":1800,
            "participantIdentities":[{"participantId":1,"player":{"puuid":"private-puuid","accountId":"private-account"}}],
            "participants":[{"participantId":1,"championId":22,"timeline":{"lane":"BOTTOM","role":"DUO_CARRY"},"stats":{"win":true,"kills":5,"deaths":2,"assists":8,"totalMinionsKilled":150,"neutralMinionsKilled":5,"goldEarned":12000,"totalDamageDealtToChampions":22000,"totalDamageTaken":15000,"totalHeal":1000,"visionScore":25,"wardsPlaced":8,"wardsKilled":2,"item0":1001}}]
        })
    }
    fn summoner() -> Value {
        json!({"puuid":"private-puuid","accountId":"private-account","summonerId":"private-summoner"})
    }
    #[test]
    fn boundaries_and_success_cap_work() {
        for count in [5, 50, 100] {
            assert_eq!(
                sanitize_matches(&(0..count).map(game).collect::<Vec<_>>(), &summoner())
                    .unwrap()
                    .matches
                    .len(),
                count
            );
        }
        assert!(sanitize_matches(&(0..4).map(game).collect::<Vec<_>>(), &summoner()).is_err());
        let result =
            sanitize_matches(&(0..101).map(game).collect::<Vec<_>>(), &summoner()).unwrap();
        assert_eq!(result.matches.len(), 100);
        assert_eq!(result.skipped, 1);
    }
    #[test]
    fn mixed_history_skips_per_match_without_identifiers() {
        let mut games = (0..7).map(game).collect::<Vec<_>>();
        games[1]["gameMode"] = json!("TUTORIAL");
        games[3]["participants"] = json!([]);
        let result = sanitize_matches(&games, &summoner()).unwrap();
        assert_eq!(result.matches.len(), 5);
        assert_eq!(result.skipped, 2);
        let summary = serde_json::to_string(&result.skip_reasons).unwrap();
        assert!(!summary.contains("secret-") && !summary.contains("private-"));
    }
    #[test]
    fn serialized_dto_is_sanitized_and_valid() {
        let dto = request(
            sanitize_matches(&(0..5).map(game).collect::<Vec<_>>(), &summoner())
                .unwrap()
                .matches,
            "0.1.0",
        );
        validate_request(&dto).unwrap();
        let text = serde_json::to_string(&dto).unwrap();
        for forbidden in [
            "gameId",
            "puuid",
            "accountId",
            "summonerId",
            "private-",
            "secret-",
        ] {
            assert!(!text.contains(forbidden));
        }
        assert!(text.contains("2025-07-24T10:00:00Z"));
    }
    #[test]
    fn strict_deserialization_and_semantics() {
        let dto = request(
            sanitize_matches(&(0..5).map(game).collect::<Vec<_>>(), &summoner())
                .unwrap()
                .matches,
            "0.1.0",
        );
        let mut value = serde_json::to_value(&dto).unwrap();
        value["unknown"] = json!(true);
        assert!(serde_json::from_value::<CreateAnalysisRequestV1>(value).is_err());
        let mut invalid = dto;
        invalid.locale = "xx".into();
        assert!(validate_request(&invalid).is_err());
    }
    #[test]
    fn history_sync_includes_all_modes_and_stable_match_keys() {
        let mut aram = game(0);
        aram["gameMode"] = json!("ARAM");
        aram["queueId"] = json!(450);
        let mut urf = game(1);
        urf["gameMode"] = json!("URF");
        let (items, skipped) =
            sanitize_history(&[game(0), aram, urf], &summoner()).unwrap();
        assert_eq!(items.len(), 3);
        assert_eq!(skipped, 0);
        let modes = items
            .iter()
            .map(|item| item.matched.game_mode.as_str())
            .collect::<Vec<_>>();
        assert!(modes.contains(&"CLASSIC") && modes.contains(&"ARAM") && modes.contains(&"URF"));
        assert!(items.iter().all(|item| valid_match_key(&item.match_key)));
        assert_eq!(items[0].match_key, items[0].match_key);
        let (again, _) = sanitize_history(&[game(0)], &summoner()).unwrap();
        assert_eq!(again[0].match_key, items[0].match_key, "去重键必须稳定");
        let request = sync_request(items);
        validate_history_request(&request).unwrap();
        let text = serde_json::to_string(&request).unwrap();
        assert!(text.contains("matchKey") && !text.contains("gameId") && !text.contains("private-"));
    }
    #[test]
    fn history_cap_and_validation() {
        let (items, skipped) =
            sanitize_history(&(0..1001).map(game).collect::<Vec<_>>(), &summoner()).unwrap();
        assert_eq!(items.len(), 1000);
        assert_eq!(skipped, 1);
        let mut request = sync_request(items);
        request.schema_version = 2;
        assert!(validate_history_request(&request).is_err());
        let mut invalid_key = sync_request(vec![HistoryMatchV1 {
            match_key: "Z".repeat(64),
            matched: sanitize_history(&[game(0)], &summoner()).unwrap().0[0]
                .matched
                .clone(),
        }]);
        assert!(validate_history_request(&invalid_key).is_err());
        invalid_key.matches[0].match_key = "a".repeat(63);
        assert!(validate_history_request(&invalid_key).is_err());
    }
    #[test]
    fn dto_matches_generated_shared_v1_schema() {
        let dto = serde_json::to_value(request(
            sanitize_matches(&(0..5).map(game).collect::<Vec<_>>(), &summoner())
                .unwrap()
                .matches,
            "0.1.0",
        ))
        .unwrap();
        let schema: Value =
            serde_json::from_str(include_str!("../fixtures/create-analysis-request-v1.json"))
                .unwrap();
        let validator = jsonschema::validator_for(&schema).unwrap();
        assert!(
            validator.is_valid(&dto),
            "{:?}",
            validator.iter_errors(&dto).collect::<Vec<_>>()
        );
    }
}
