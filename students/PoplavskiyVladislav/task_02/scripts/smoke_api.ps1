$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ApiBase = $env:API_BASE
if ([string]::IsNullOrWhiteSpace($ApiBase)) { $ApiBase = "http://localhost:3001" }

function Invoke-Api {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$false)][hashtable]$Headers,
    [Parameter(Mandatory=$false)]$Body
  )

  $uri = "$ApiBase$Path"
  $params = @{
    Method = $Method
    Uri = $uri
    Headers = $Headers
    TimeoutSec = 20
  }

  if ($null -ne $Body) {
    $params.ContentType = "application/json"
    $params.Body = ($Body | ConvertTo-Json -Depth 10)
  }

  $res = Invoke-RestMethod @params

  if ($null -eq $res) { return $null }
  if ($res.status -eq "ok") { return $res.data }
  if ($res.status -eq "error") {
    $msg = $res.error.message
    if ([string]::IsNullOrWhiteSpace($msg)) { $msg = "API error" }
    throw $msg
  }

  return $res
}

Write-Host "[smoke] root: $Root"
Write-Host "[smoke] api:  $ApiBase"

Write-Host "[smoke] starting db (docker compose up -d db)"
& docker compose -f (Join-Path $Root "docker-compose.yml") up -d db | Out-Host

$serverStartedHere = $false
$serverProc = $null

try {
  try {
    Invoke-Api -Method "GET" -Path "/health" | Out-Null
    Write-Host "[smoke] api already running"
  } catch {
    Write-Host "[smoke] migrate"
    & npm --prefix $Root run db:migrate --workspace=server | Out-Host

    Write-Host "[smoke] seed"
    & npm --prefix $Root run db:seed --workspace=server | Out-Host

    Write-Host "[smoke] api not responding, building & starting"
    & npm --prefix $Root run build --workspace=server | Out-Host

    $serverStartedHere = $true
    $serverProc = Start-Process -FilePath "node" -ArgumentList "apps/server/dist/index.js" -WorkingDirectory $Root -PassThru -NoNewWindow

    Start-Sleep -Seconds 2
    Invoke-Api -Method "GET" -Path "/health" | Out-Null
    Write-Host "[smoke] api started"
  }

  Write-Host "[smoke] openapi"
  $openapi = Invoke-RestMethod -Method "GET" -Uri "$ApiBase/openapi.json" -TimeoutSec 20
  if ($null -eq $openapi.openapi) { throw "OpenAPI missing 'openapi' field" }

  Write-Host "[smoke] swagger ui"
  $docs = Invoke-WebRequest -Method "GET" -Uri "$ApiBase/docs" -TimeoutSec 20
  if ($docs.StatusCode -ne 200) { throw "Swagger UI returned $($docs.StatusCode)" }

  Write-Host "[smoke] login admin"
  $login = Invoke-Api -Method "POST" -Path "/auth/login" -Body @{ email = "admin@example.com"; password = "password123" }
  $token = $login.accessToken
  if ([string]::IsNullOrWhiteSpace($token)) { throw "Missing accessToken" }

  $headers = @{ Authorization = "Bearer $token" }

  Write-Host "[smoke] create group"
  $group = Invoke-Api -Method "POST" -Path "/groups" -Headers $headers -Body @{ title = "Smoke group $(Get-Date -Format s)"; isPublic = $true }
  $groupId = $group.id
  Write-Host "[smoke] groupId: $groupId"

  Write-Host "[smoke] patch group"
  Invoke-Api -Method "PATCH" -Path "/groups/$groupId" -Headers $headers -Body @{ title = "Smoke group updated" } | Out-Null

  Write-Host "[smoke] create topic"
  Invoke-Api -Method "POST" -Path "/groups/$groupId/topics" -Headers $headers -Body @{ title = "Topic 1" } | Out-Null

  Write-Host "[smoke] create meeting"
  $startsAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
  Invoke-Api -Method "POST" -Path "/groups/$groupId/meetings" -Headers $headers -Body @{ startsAt = $startsAt; durationMinutes = 60 } | Out-Null

  Write-Host "[smoke] calendar export (.ics)"
  $icsRes = Invoke-WebRequest -Method "GET" -Uri "$ApiBase/groups/$groupId/calendar.ics" -Headers $headers -TimeoutSec 20
  if ($icsRes.StatusCode -ne 200) { throw "ICS returned $($icsRes.StatusCode)" }
  $ct = $icsRes.Headers["Content-Type"]
  if ($ct -notmatch "text/calendar") { throw "ICS Content-Type is $ct" }
  if ($icsRes.Content -notmatch "BEGIN:VCALENDAR") { throw "ICS content missing BEGIN:VCALENDAR" }

  Write-Host "[smoke] create material"
  Invoke-Api -Method "POST" -Path "/groups/$groupId/materials" -Headers $headers -Body @{ title = "Material"; type = "link"; url = "https://example.com" } | Out-Null

  Write-Host "[smoke] create task"
  Invoke-Api -Method "POST" -Path "/groups/$groupId/tasks" -Headers $headers -Body @{ title = "Task 1" } | Out-Null

  Write-Host "[smoke] delete group"
  Invoke-Api -Method "DELETE" -Path "/groups/$groupId" -Headers $headers | Out-Null

  Write-Host "[smoke] OK"
} finally {
  if ($serverStartedHere -and $null -ne $serverProc) {
    try {
      Stop-Process -Id $serverProc.Id -Force
      Write-Host "[smoke] stopped api process $($serverProc.Id)"
    } catch {
      # ignore
    }
  }
}
