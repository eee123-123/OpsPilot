$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory)]
        [string]$Description,
        [Parameter(Mandatory)]
        [scriptblock]$Command
    )

    Write-Host "==> $Description"
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE"
    }
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repositoryRoot
try {
    Invoke-CheckedCommand 'Backend verification' { & .\mvnw.cmd verify }
    Invoke-CheckedCommand 'Compose configuration validation' { docker compose config --quiet }

    Push-Location (Join-Path $repositoryRoot 'web')
    try {
        Invoke-CheckedCommand 'Frontend lockfile install' { npm.cmd ci }
        Invoke-CheckedCommand 'Frontend lint' { npm.cmd run lint }
        Invoke-CheckedCommand 'Frontend format check' { npm.cmd run format:check }
        Invoke-CheckedCommand 'Frontend unit tests' { npm.cmd run test }
        Invoke-CheckedCommand 'Frontend production build' { npm.cmd run build }
        Invoke-CheckedCommand 'Frontend end-to-end smoke test' { npm.cmd run test:e2e }
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
}
