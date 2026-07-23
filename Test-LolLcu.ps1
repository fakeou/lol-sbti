[CmdletBinding()]
param(
    [string]$ReportPath = (Join-Path (Get-Location) 'lcu-probe-report.json')
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string]$Level, [string]$Message)
    Write-Host ('[{0}] {1}' -f $Level, $Message)
}

function Add-ErrorCode {
    param([System.Collections.ArrayList]$List, [string]$Code)
    if (-not $List.Contains($Code)) { [void]$List.Add($Code) }
}

function Get-ArgumentValue {
    param([string]$CommandLine, [string]$Name)
    if ([string]::IsNullOrWhiteSpace($CommandLine)) { return $null }
    $match = [regex]::Match($CommandLine, '(?:^|[\s"])--' + [regex]::Escape($Name) + '=(?:"([^"]*)"|([^\s"]+))')
    if (-not $match.Success) { return $null }
    if ($match.Groups[1].Success) { return $match.Groups[1].Value }
    return $match.Groups[2].Value
}

function Initialize-NativeProcessCommandLineReader {
    if ('LcuProbe.NativeProcessCommandLine' -as [type]) { return }

    $source = @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

namespace LcuProbe {
    public static class NativeProcessCommandLine {
        private const uint ProcessQueryLimitedInformation = 0x1000;
        private const int ProcessCommandLineInformation = 60;

        [StructLayout(LayoutKind.Sequential)]
        private struct UnicodeString {
            public ushort Length;
            public ushort MaximumLength;
            public IntPtr Buffer;
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr OpenProcess(uint access, bool inheritHandle, uint processId);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool CloseHandle(IntPtr handle);

        [DllImport("ntdll.dll")]
        private static extern int NtQueryInformationProcess(
            IntPtr processHandle,
            int processInformationClass,
            IntPtr processInformation,
            uint processInformationLength,
            out uint returnLength);

        public static string Read(uint processId) {
            IntPtr process = OpenProcess(ProcessQueryLimitedInformation, false, processId);
            if (process == IntPtr.Zero) {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }

            try {
                uint requiredLength;
                NtQueryInformationProcess(
                    process, ProcessCommandLineInformation, IntPtr.Zero, 0, out requiredLength);
                if (requiredLength == 0) {
                    throw new InvalidOperationException("Command line length is unavailable.");
                }

                IntPtr buffer = Marshal.AllocHGlobal(checked((int)requiredLength));
                try {
                    int status = NtQueryInformationProcess(
                        process, ProcessCommandLineInformation, buffer, requiredLength, out requiredLength);
                    if (status != 0) {
                        throw new InvalidOperationException("Native command line query failed.");
                    }

                    UnicodeString value = (UnicodeString)Marshal.PtrToStructure(
                        buffer, typeof(UnicodeString));
                    if (value.Buffer == IntPtr.Zero || value.Length == 0) {
                        return String.Empty;
                    }
                    return Marshal.PtrToStringUni(value.Buffer, value.Length / 2);
                }
                finally {
                    Marshal.FreeHGlobal(buffer);
                }
            }
            finally {
                CloseHandle(process);
            }
        }
    }
}
'@
    Add-Type -TypeDefinition $source -ErrorAction Stop
}

function ConvertTo-LcuConnection {
    param([string]$CommandLine, [string]$Source)

    $port = Get-ArgumentValue $CommandLine 'app-port'
    $token = Get-ArgumentValue $CommandLine 'remoting-auth-token'
    $protocol = Get-ArgumentValue $CommandLine 'app-protocol'
    if (-not $port -or -not $token) { return $null }
    if (-not $protocol) { $protocol = 'https' }
    return [pscustomobject]@{ Port = $port; Token = $token; Protocol = $protocol; Source = $Source }
}

function Get-LcuConnection {
    param([System.Collections.ArrayList]$Errors)

    $processes = @(Get-Process LeagueClientUx -ErrorAction SilentlyContinue)
    if ($processes.Count -eq 0) { return $null }

    try {
        Initialize-NativeProcessCommandLineReader
        foreach ($process in $processes) {
            try {
                $commandLine = [LcuProbe.NativeProcessCommandLine]::Read([uint32]$process.Id)
                $connection = ConvertTo-LcuConnection $commandLine 'native-process-command-line'
                if ($connection) { return $connection }
            } catch {
                # Never print the exception: it could carry process details.
            }
        }
        Add-ErrorCode $Errors 'NATIVE_PROCESS_COMMAND_LINE_UNAVAILABLE'
    } catch {
        Add-ErrorCode $Errors 'NATIVE_PROCESS_READER_INITIALIZATION_FAILED'
    }

    foreach ($process in $processes) {
        $cimProcess = Get-CimInstance Win32_Process -Filter ("ProcessId={0}" -f $process.Id) -ErrorAction SilentlyContinue
        if (-not $cimProcess) { continue }
        $connection = ConvertTo-LcuConnection ([string]$cimProcess.CommandLine) 'cim-process-command-line'
        if ($connection) { return $connection }
    }
    Add-ErrorCode $Errors 'PROCESS_COMMAND_LINE_UNREADABLE_OR_INCOMPLETE'

    $candidates = New-Object System.Collections.ArrayList
    $leagueProcess = Get-CimInstance Win32_Process -Filter "Name='LeagueClient.exe'" -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($leagueProcess -and $leagueProcess.ExecutablePath) {
        [void]$candidates.Add((Join-Path (Split-Path $leagueProcess.ExecutablePath -Parent) 'lockfile'))
    }

    foreach ($drive in (Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue)) {
        foreach ($relative in @(
            'WeGameApps\英雄联盟\LeagueClient\lockfile',
            'Riot Games\League of Legends\lockfile',
            'Program Files\Riot Games\League of Legends\lockfile'
        )) {
            [void]$candidates.Add((Join-Path $drive.Root $relative))
        }
    }

    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
        try {
            $stream = [System.IO.File]::Open($candidate, 'Open', 'Read', 'ReadWrite')
            try {
                $reader = New-Object System.IO.StreamReader($stream)
                try { $raw = $reader.ReadToEnd().Trim() } finally { $reader.Dispose() }
            } finally {
                if ($stream) { $stream.Dispose() }
            }
            if ([string]::IsNullOrWhiteSpace($raw)) { continue }
            $parts = $raw.Split(':')
            if ($parts.Count -lt 5) { continue }
            if ($parts[2] -notmatch '^\d+$' -or [string]::IsNullOrWhiteSpace($parts[3])) { continue }
            $lockProtocol = $parts[4].Trim()
            if ($lockProtocol -notin @('http', 'https')) { continue }
            return [pscustomobject]@{
                Port = $parts[2]
                Token = $parts[3]
                Protocol = $lockProtocol
                Source = 'lockfile'
            }
        } catch {
            Add-ErrorCode $Errors 'LOCKFILE_UNREADABLE'
        }
    }

    return $null
}

function Invoke-LcuGet {
    param(
        [string]$BaseUri,
        [string]$Path,
        [string]$Token
    )

    if ($BaseUri -notmatch '^https://127\.0\.0\.1:\d+$') {
        throw 'INVALID_LOCAL_LCU_BASE_URI'
    }
    if ([string]::IsNullOrWhiteSpace($Path) -or -not $Path.StartsWith('/')) {
        throw 'INVALID_LOCAL_LCU_PATH'
    }
    if ([string]::IsNullOrWhiteSpace($Token)) {
        throw 'INVALID_LOCAL_LCU_TOKEN'
    }

    # PowerShell 5.1 may fail TLS negotiation with newer LCU builds. Passing
    # URL and credentials through stdin keeps secrets out of the curl command line.
    $escapedUrl = ($BaseUri + $Path).Replace('"', '\"')
    $escapedCredential = ('riot:' + $Token).Replace('"', '\"')
    $config = @(
        'request = "GET"'
        ('url = "{0}"' -f $escapedUrl)
        ('user = "{0}"' -f $escapedCredential)
        'insecure'
        'silent'
        'show-error'
        'max-time = 20'
    )
    $response = @($config | & curl.exe --config - 2>$null)
    if ($LASTEXITCODE -ne 0) { throw 'LOCAL_LCU_CURL_REQUEST_FAILED' }

    $json = $response -join [Environment]::NewLine
    if ([string]::IsNullOrWhiteSpace($json)) { throw 'LOCAL_LCU_EMPTY_RESPONSE' }
    try { return $json | ConvertFrom-Json }
    catch { throw 'LOCAL_LCU_INVALID_JSON_RESPONSE' }
}

function Has-Property {
    param($Object, [string]$Name)
    return ($null -ne $Object -and $null -ne $Object.PSObject.Properties[$Name])
}

function Has-Value {
    param($Object, [string]$Name)
    if (-not (Has-Property $Object $Name)) { return $false }
    $value = $Object.$Name
    if ($null -eq $value) { return $false }
    if ($value -is [string]) { return -not [string]::IsNullOrWhiteSpace($value) }
    return $true
}

function Get-CoveragePercent {
    param([int]$Valid, [int]$Total)
    if ($Total -le 0) { return 0.0 }
    return [math]::Round(($Valid * 100.0) / $Total, 1)
}

$errors = New-Object System.Collections.ArrayList
$sensitiveValues = New-Object System.Collections.ArrayList
$oldCertificateCallback = [Net.ServicePointManager]::ServerCertificateValidationCallback
$connection = $null
$matchCount = 0
$locatedCount = 0
$detailAvailable = $false
$coverageCounts = [ordered]@{
    win = 0; champion = 0; kills = 0; deaths = 0; assists = 0; minions = 0; gold = 0; duration = 0
    damage = 0; damageTaken = 0; healing = 0; vision = 0; position = 0; items = 0
}
$report = $null

try {
    $ux = Get-Process LeagueClientUx -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $ux) {
        Write-Step 'FAIL' '未找到 LeagueClientUx.exe'
        Add-ErrorCode $errors 'CLIENT_NOT_FOUND'
        throw 'STOP'
    }
    Write-Step 'PASS' '找到 LeagueClientUx.exe'

    $connection = Get-LcuConnection $errors
    if (-not $connection) {
        Write-Step 'FAIL' '无法读取 LCU 本地连接信息'
        Add-ErrorCode $errors 'LCU_CONNECTION_INFO_UNAVAILABLE'
        throw 'STOP'
    }
    if ($connection.Protocol -ne 'https') {
        Write-Step 'FAIL' 'LCU 未提供预期的 HTTPS 连接'
        Add-ErrorCode $errors 'UNEXPECTED_LCU_PROTOCOL'
        throw 'STOP'
    }
    [void]$sensitiveValues.Add([string]$connection.Token)
    Write-Step 'PASS' '已取得 LCU 本地连接信息（令牌不会输出）'

    $baseUri = 'https://127.0.0.1:{0}' -f $connection.Port

    try {
        $summoner = Invoke-LcuGet $baseUri '/lol-summoner/v1/current-summoner' $connection.Token
    } catch {
        Add-ErrorCode $errors 'CURRENT_SUMMONER_REQUEST_FAILED'
        Write-Step 'FAIL' 'LCU 当前用户接口请求失败'
        throw 'STOP'
    }
    Write-Step 'PASS' 'LCU 连接成功'

    $identity = [ordered]@{}
    foreach ($name in @('puuid', 'accountId', 'summonerId')) {
        if (Has-Value $summoner $name) {
            $identity[$name] = [string]$summoner.$name
            [void]$sensitiveValues.Add([string]$summoner.$name)
        }
    }
    if (-not $identity.Contains('puuid')) {
        Add-ErrorCode $errors 'CURRENT_SUMMONER_PUUID_MISSING'
        Write-Step 'FAIL' '当前用户缺少 PUUID'
        throw 'STOP'
    }
    Write-Step 'PASS' '已读取当前登录用户'

    $escapedPuuid = [Uri]::EscapeDataString($identity['puuid'])
    try {
        $history = Invoke-LcuGet $baseUri ('/lol-match-history/v1/products/lol/' + $escapedPuuid + '/matches?begIndex=0&endIndex=49') $connection.Token
    } catch {
        Add-ErrorCode $errors 'MATCH_HISTORY_REQUEST_FAILED'
        Write-Step 'FAIL' '战绩接口请求失败'
        throw 'STOP'
    }

    $games = @()
    if ($history -and (Has-Property $history 'games') -and $history.games -and (Has-Property $history.games 'games')) {
        $games = @($history.games.games)
    }
    $matchCount = $games.Count
    if ($matchCount -eq 0) {
        Add-ErrorCode $errors 'MATCH_HISTORY_EMPTY'
        Write-Step 'FAIL' '战绩接口未返回对局'
        throw 'STOP'
    }
    Write-Step 'PASS' ('战绩接口返回 {0} 场' -f $matchCount)

    $firstGameId = $null
    foreach ($game in $games) {
        if (Has-Value $game 'gameId') {
            [void]$sensitiveValues.Add([string]$game.gameId)
            if (-not $firstGameId) { $firstGameId = [string]$game.gameId }
        }

        $participantId = $null
        foreach ($participantIdentity in @($game.participantIdentities)) {
            if (-not $participantIdentity -or -not (Has-Property $participantIdentity 'player')) { continue }
            foreach ($name in @('puuid', 'accountId', 'summonerId')) {
                if ($identity.Contains($name) -and (Has-Value $participantIdentity.player $name) -and
                    ([string]$participantIdentity.player.$name -eq $identity[$name])) {
                    $participantId = $participantIdentity.participantId
                    break
                }
            }
            if ($null -ne $participantId) { break }
        }

        $participant = $null
        if ($null -ne $participantId) {
            $participant = @($game.participants | Where-Object { $_.participantId -eq $participantId } | Select-Object -First 1)[0]
        } else {
            foreach ($candidate in @($game.participants)) {
                foreach ($name in @('puuid', 'accountId', 'summonerId')) {
                    if ($identity.Contains($name) -and (Has-Value $candidate $name) -and
                        ([string]$candidate.$name -eq $identity[$name])) {
                        $participant = $candidate
                        break
                    }
                }
                if ($participant) { break }
            }
        }
        if (-not $participant) { continue }
        $locatedCount++
        $stats = $participant.stats
        $timeline = $participant.timeline

        if (Has-Value $stats 'win') { $coverageCounts.win++ }
        if ((Has-Value $participant 'championId') -or (Has-Value $stats 'championId')) { $coverageCounts.champion++ }
        foreach ($name in @('kills', 'deaths', 'assists', 'goldEarned', 'totalDamageDealtToChampions', 'totalDamageTaken', 'totalHeal')) {
            if (Has-Value $stats $name) {
                switch ($name) {
                    'kills' { $coverageCounts.kills++ }
                    'deaths' { $coverageCounts.deaths++ }
                    'assists' { $coverageCounts.assists++ }
                    'goldEarned' { $coverageCounts.gold++ }
                    'totalDamageDealtToChampions' { $coverageCounts.damage++ }
                    'totalDamageTaken' { $coverageCounts.damageTaken++ }
                    'totalHeal' { $coverageCounts.healing++ }
                }
            }
        }
        if ((Has-Value $stats 'totalMinionsKilled') -or (Has-Value $stats 'neutralMinionsKilled')) { $coverageCounts.minions++ }
        if (Has-Value $game 'gameDuration') { $coverageCounts.duration++ }
        if ((Has-Value $stats 'visionScore') -or (Has-Value $stats 'wardsPlaced') -or (Has-Value $stats 'wardsKilled')) { $coverageCounts.vision++ }
        if ((Has-Value $timeline 'lane') -or (Has-Value $timeline 'role') -or (Has-Value $stats 'playerPosition')) { $coverageCounts.position++ }
        $hasItemField = $false
        foreach ($itemName in @('item0', 'item1', 'item2', 'item3', 'item4', 'item5', 'item6')) {
            if (Has-Property $stats $itemName) { $hasItemField = $true; break }
        }
        if ($hasItemField) { $coverageCounts.items++ }
    }

    if ($firstGameId) {
        try {
            $null = Invoke-LcuGet $baseUri ('/lol-match-history/v1/games/' + [Uri]::EscapeDataString($firstGameId)) $connection.Token
            $detailAvailable = $true
            Write-Step 'PASS' '第一场详情接口可用'
        } catch {
            Add-ErrorCode $errors 'FIRST_GAME_DETAIL_UNAVAILABLE'
            Write-Step 'WARN' '第一场详情接口不可用（不阻塞列表验证）'
        }
    }
} catch {
    if ($_.Exception.Message -ne 'STOP') {
        Add-ErrorCode $errors 'UNEXPECTED_PROBE_FAILURE'
        Write-Step 'FAIL' '探针发生未预期错误'
    }
} finally {
    [Net.ServicePointManager]::ServerCertificateValidationCallback = $oldCertificateCallback

    $coverage = [ordered]@{}
    foreach ($entry in $coverageCounts.GetEnumerator()) {
        $coverage[$entry.Key] = Get-CoveragePercent ([int]$entry.Value) $locatedCount
    }
    $locationRate = Get-CoveragePercent $locatedCount $matchCount
    $coreNames = @('win', 'champion', 'kills', 'deaths', 'assists', 'minions', 'gold', 'duration')
    $behaviorNames = @('damage', 'damageTaken', 'healing', 'vision', 'position', 'items')
    $corePass = (@($coreNames | Where-Object { $coverage[$_] -ge 80 }).Count -eq $coreNames.Count)
    $behaviorPassCount = @($behaviorNames | Where-Object { $coverage[$_] -ge 50 }).Count

    $verdict = 'FAIL'
    if ($matchCount -ge 30 -and $locationRate -ge 80 -and $corePass -and $behaviorPassCount -ge 3) {
        $verdict = 'MVP_PASS'
    } elseif ($matchCount -ge 10 -and $locationRate -ge 80 -and $corePass -and $behaviorPassCount -ge 3) {
        $verdict = 'DEGRADED_PASS'
    }

    $report = [ordered]@{
        schemaVersion = 1
        generatedAtUtc = [DateTime]::UtcNow.ToString('o')
        verdict = $verdict
        checks = [ordered]@{
            clientFound = [bool](Get-Process LeagueClientUx -ErrorAction SilentlyContinue)
            connectionInfoFound = [bool]$connection
            currentSummonerAvailable = ($sensitiveValues.Count -gt 1)
            firstGameDetailAvailable = $detailAvailable
        }
        matches = [ordered]@{
            returned = $matchCount
            currentPlayerLocated = $locatedCount
            currentPlayerLocationRatePercent = $locationRate
        }
        fieldCoveragePercent = $coverage
        thresholds = [ordered]@{
            coreFieldsAtLeast80Percent = $corePass
            behaviorCategoriesAtLeast50Percent = $behaviorPassCount
        }
        errorCodes = @($errors)
    }

    $json = $report | ConvertTo-Json -Depth 8
    foreach ($secret in @($sensitiveValues | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })) {
        if ($json.Contains([string]$secret)) {
            Write-Step 'FAIL' '报告脱敏检查失败，未写入文件'
            throw 'REPORT_REDACTION_CHECK_FAILED'
        }
    }
    if ($json -match '(?i)authorization|remoting-auth-token|gameId|puuid|accountId|summonerId') {
        Write-Step 'FAIL' '报告字段安全检查失败，未写入文件'
        throw 'REPORT_FIELD_SAFETY_CHECK_FAILED'
    }

    $directory = Split-Path -Parent ([IO.Path]::GetFullPath($ReportPath))
    if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
        $null = New-Item -ItemType Directory -Path $directory
    }
    [IO.File]::WriteAllText([IO.Path]::GetFullPath($ReportPath), $json, (New-Object Text.UTF8Encoding($false)))
    Write-Step 'DONE' ('最终判定：{0}' -f $report.verdict)
    Write-Step 'DONE' ('脱敏报告已写入: {0}' -f ([IO.Path]::GetFullPath($ReportPath)))
}
