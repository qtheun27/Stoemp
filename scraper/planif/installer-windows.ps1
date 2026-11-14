# Planifie le robot de prix chaque dimanche à 10 h 23 sur ce PC (rattrapé au démarrage si le PC était éteint).
$dir = Resolve-Path (Join-Path $PSScriptRoot "..")
$npm = (Get-Command npm.cmd).Source
$action = New-ScheduledTaskAction -Execute $npm -Argument "run robot:local" -WorkingDirectory $dir
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 10:23
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 3)
Register-ScheduledTask -TaskName "Stoemp robot de prix" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host "✅ Robot planifié chaque dimanche à 10 h 23. Lancer tout de suite : Start-ScheduledTask -TaskName 'Stoemp robot de prix'"
