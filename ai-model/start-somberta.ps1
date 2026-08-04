$ErrorActionPreference = "Stop"

$projectPath = "/mnt/c/Users/yasin/OneDrive/Desktop/Bareai/crimedetection-sytem/ai-model"
$linuxCommand = "cd '$projectPath' && AI_MODEL_HOST=0.0.0.0 ~/.venvs/bareai/bin/python app.py"

Write-Host "Starting SomBERTa-B on http://127.0.0.1:5001 ..." -ForegroundColor Cyan
wsl.exe -d Ubuntu -- bash -lc $linuxCommand

if ($LASTEXITCODE -ne 0) {
    throw "SomBERTa-B service stopped with exit code $LASTEXITCODE."
}
