$ErrorActionPreference = 'Stop'
$py = 'C:\Users\0616y\AppData\Local\Programs\Python\Python313\python.exe'
$wd = 'C:\Users\0616y\OneDrive\바탕 화면\minwo0___\26-2 스포츠데이기획\sportsday-hub\scripts'

$action = New-ScheduledTaskAction -Execute $py -Argument '-X utf8 "C:\Users\0616y\OneDrive\바탕 화면\minwo0___\26-2 스포츠데이기획\sportsday-hub\scripts\kakao_recover.py"' -WorkingDirectory $wd

$daily = New-ScheduledTaskTrigger -Daily -At '18:00'
$rep = New-ScheduledTaskTrigger -Once -At '18:00' -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration (New-TimeSpan -Hours 6)
$daily.Repetition = $rep.Repetition
$daily.EndBoundary = '2026-09-21T00:00:00+09:00'

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName 'KakaoPendingRecovery' -Action $action -Trigger $daily `
  -Settings $settings -Force | Out-Null

$t = Get-ScheduledTask -TaskName 'KakaoPendingRecovery'
"State: $($t.State)"
Get-ScheduledTaskInfo -TaskName 'KakaoPendingRecovery' | Format-List NextRunTime
