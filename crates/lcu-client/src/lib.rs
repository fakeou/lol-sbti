use reqwest::blocking::Client;
use serde_json::Value;
use std::{
    ffi::c_void,
    mem::{size_of, zeroed},
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
#[link(name = "ntdll")]
extern "system" {
    fn NtQueryInformationProcess(
        handle: *mut c_void,
        class: u32,
        info: *mut c_void,
        length: u32,
        returned: *mut u32,
    ) -> i32;
}
#[repr(C)]
struct UnicodeString {
    length: u16,
    maximum_length: u16,
    buffer: *const u16,
}

#[derive(Clone)]
pub struct Connection {
    port: u16,
    token: String,
    client: Client,
}
impl std::fmt::Debug for Connection {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Connection")
            .field("endpoint", &"LCU localhost")
            .finish()
    }
}
impl Connection {
    pub fn get(&self, path: &str) -> Result<Value, String> {
        if !path.starts_with('/') {
            return Err("LCU 路径无效".into());
        }
        self.client
            .get(format!("https://127.0.0.1:{}{}", self.port, path))
            .basic_auth("riot", Some(&self.token))
            .send()
            .map_err(|_| "LCU 请求失败".to_string())?
            .error_for_status()
            .map_err(|_| "LCU 返回错误状态".to_string())?
            .json()
            .map_err(|_| "LCU 返回的数据格式无效".to_string())
    }
}
pub fn current() -> Result<(Connection, Value), String> {
    for connection in discover()? {
        if let Ok(s) = connection.get("/lol-summoner/v1/current-summoner") {
            if s.get("puuid").and_then(Value::as_str).is_some() {
                return Ok((connection, s));
            }
        }
    }
    Err("客户端尚未完成登录".into())
}
fn discover() -> Result<Vec<Connection>, String> {
    let mut result = Vec::new();
    for pid in process_ids()? {
        let Ok(line) = command_line(pid) else {
            continue;
        };
        let Some(port) = argument(&line, "app-port").and_then(|v| v.parse().ok()) else {
            continue;
        };
        let Some(token) = argument(&line, "remoting-auth-token") else {
            continue;
        };
        let client = Client::builder()
            .danger_accept_invalid_certs(true)
            .no_proxy()
            .build()
            .map_err(|_| "无法创建本地 LCU 客户端".to_string())?;
        result.push(Connection {
            port,
            token,
            client,
        })
    }
    if result.is_empty() {
        Err("未检测到已登录的英雄联盟客户端".into())
    } else {
        Ok(result)
    }
}
fn process_ids() -> Result<Vec<u32>, String> {
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
            .position(|v| *v == 0)
            .unwrap_or(entry.szExeFile.len());
        if String::from_utf16_lossy(&entry.szExeFile[..end])
            .eq_ignore_ascii_case("LeagueClientUx.exe")
        {
            ids.push(entry.th32ProcessID)
        }
        ok = unsafe { Process32NextW(snapshot, &mut entry) } != 0
    }
    unsafe { CloseHandle(snapshot) };
    Ok(ids)
}
fn command_line(pid: u32) -> Result<String, String> {
    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
    if handle.is_null() {
        return Err("无法打开客户端进程".into());
    }
    let result = (|| {
        let mut required = 0;
        unsafe {
            NtQueryInformationProcess(
                handle,
                PROCESS_COMMAND_LINE_INFORMATION,
                null_mut(),
                0,
                &mut required,
            )
        };
        if required == 0 {
            return Err("无法读取客户端连接参数".into());
        }
        let mut storage = vec![0u8; required as usize];
        if unsafe {
            NtQueryInformationProcess(
                handle,
                PROCESS_COMMAND_LINE_INFORMATION,
                storage.as_mut_ptr().cast(),
                required,
                &mut required,
            )
        } != 0
        {
            return Err("无法读取客户端连接参数".into());
        }
        let value = unsafe { &*(storage.as_ptr().cast::<UnicodeString>()) };
        if value.buffer.is_null() || value.length == 0 {
            return Err("客户端连接参数为空".into());
        }
        Ok(String::from_utf16_lossy(unsafe {
            slice::from_raw_parts(value.buffer, (value.length / 2) as usize)
        }))
    })();
    unsafe { CloseHandle(handle) };
    result
}
fn argument(line: &str, name: &str) -> Option<String> {
    let marker = format!("--{name}=");
    let rest = &line[line.find(&marker)? + marker.len()..];
    if let Some(quoted) = rest.strip_prefix('"') {
        return quoted.split('"').next().map(str::to_owned);
    }
    Some(
        rest.split(|c: char| c.is_whitespace() || c == '"')
            .next()?
            .to_owned(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn credential_is_not_debuggable_or_serializable() {
        let connection = Connection {
            port: 1234,
            token: "never-print-this".into(),
            client: Client::new(),
        };
        let debug = format!("{connection:?}");
        assert!(!debug.contains("1234"));
        assert!(!debug.contains("never-print-this"));
    }
}
