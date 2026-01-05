$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $root 'apps\server'
$compose = Join-Path $root 'docker-compose.yml'

Write-Output "[smoke] root=$root"

# Ensure DB is up
if (Test-Path $compose) {
  docker compose -f $compose up -d | Out-Host
}

# Ensure env files exist
$serverEnv = Join-Path $serverDir '.env'
$serverEnvExample = Join-Path $serverDir '.env.example'
if (!(Test-Path $serverEnv) -and (Test-Path $serverEnvExample)) {
  Copy-Item $serverEnvExample $serverEnv
}

# Ensure prisma client + schema are ready
npm --prefix $serverDir run db:generate | Out-Host
npm --prefix $serverDir run db:migrate | Out-Host
npm --prefix $serverDir run db:seed | Out-Host

# Stop existing listener (if any)
$pid3001 = (Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)
if ($pid3001) {
  Stop-Process -Id $pid3001 -Force
  Start-Sleep -Milliseconds 200
}

# Build + start server (detached)
npm --prefix $serverDir run build | Out-Host
$proc = Start-Process -WorkingDirectory $serverDir -FilePath 'node' -ArgumentList 'dist/index.js' -PassThru
Write-Output "[smoke] server_pid=$($proc.Id)"

try {
  $base = 'http://localhost:3001'

  $ok = $false
  for ($i = 0; $i -lt 30; $i++) {
    try {
      $h = Invoke-RestMethod -Method GET -Uri "$base/health" -TimeoutSec 2
      if ($h.status -eq 'ok') { $ok = $true; break }
    } catch {
      Start-Sleep -Milliseconds 300
    }
  }
  if (-not $ok) { throw 'Server did not become healthy on :3001' }

  $health = Invoke-RestMethod -Method GET -Uri "$base/health"
  Write-Output "[smoke] health=$($health.status)"

  # Login (seeded)
  $loginBody = @{ email = 'user@example.com'; password = 'password123' } | ConvertTo-Json
  $login = Invoke-RestMethod -Method POST -Uri "$base/auth/login" -ContentType 'application/json' -Body $loginBody
  Write-Output "[smoke] login=$($login.status)"

  $token = $login.data.accessToken
  if (-not $token) { throw 'No accessToken returned from /auth/login' }

  $headers = @{ Authorization = "Bearer $token" }

  # List groups
  $groups = Invoke-RestMethod -Method GET -Uri "$base/groups" -Headers $headers
  Write-Output "[smoke] groups_count=$($groups.data.Count)"

  # Create + patch + delete group
  $createBody = @{ title = "Smoke Group $(Get-Date -Format 'HHmmss')"; isPublic = $true } | ConvertTo-Json
  $created = Invoke-RestMethod -Method POST -Uri "$base/groups" -Headers $headers -ContentType 'application/json' -Body $createBody
  $gid = $created.data.id
  if (-not $gid) { throw 'Create group did not return id' }
  Write-Output "[smoke] created_group=$gid"

  $patchBody = @{ description = 'smoke updated' } | ConvertTo-Json
  $patched = Invoke-RestMethod -Method PATCH -Uri "$base/groups/$gid" -Headers $headers -ContentType 'application/json' -Body $patchBody
  Write-Output "[smoke] patched_desc=$($patched.data.description)"

  try {
    Invoke-WebRequest -Method DELETE -Uri "$base/groups/$gid" -Headers $headers | Out-Null
  } catch {
    if (!($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 204)) { throw }
  }
  Write-Output "[smoke] deleted_group=ok"

  Write-Output "[smoke] OK"
  exit 0
}
finally {
  if ($proc -and !$proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
    Write-Output "[smoke] server_stopped=ok"
  }
}
