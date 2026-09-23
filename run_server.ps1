$ErrorActionPreference = 'Stop'
$iotPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
$iotManage = Join-Path $PSScriptRoot 'backend\manage.py'

# Accept readings from devices on the same local network.
& $iotPython $iotManage runserver 0.0.0.0:8000
