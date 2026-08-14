# Runs the Supabase CLI with THIS project's own access token.
#
# `supabase login` stores one token per machine, so logging into a second
# project signs you out of the first. Reading the token from this project's
# .env.local keeps every project independent — no logging in or out.
#
#   .\sb.ps1 projects list
#   .\sb.ps1 db query --linked "select 1"
#   .\sb.ps1 db query --linked -f supabase/migrations/whatever.sql

$ErrorActionPreference = 'Stop'

$envFile = Join-Path $PSScriptRoot '.env.local'
if (-not (Test-Path $envFile)) {
  Write-Error "sb: $envFile not found - create it and put SUPABASE_ACCESS_TOKEN in it."
  exit 1
}

$token = $null
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$') {
    $token = $Matches[1].Trim().Trim('"').Trim("'")
    break
  }
}

if ([string]::IsNullOrWhiteSpace($token)) {
  Write-Error "sb: SUPABASE_ACCESS_TOKEN is empty in $envFile. Create one at https://supabase.com/dashboard/account/tokens"
  exit 1
}

$previous = $env:SUPABASE_ACCESS_TOKEN
$env:SUPABASE_ACCESS_TOKEN = $token
try {
  & supabase @args
  exit $LASTEXITCODE
}
finally {
  $env:SUPABASE_ACCESS_TOKEN = $previous
}
