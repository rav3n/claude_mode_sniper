# Windows player for the sniper sounds: the engine plays clips with afplay on
# macOS only. register.tsx starts this once and drops commands into -Queue as
# files, one line each, ended by a newline:
#   play|<gain>|<path>
#   loop|<id>|<gain>|<path>
#   stop|<id>
# Exits after -IdleSec with no commands and no loop playing.
param(
  [Parameter(Mandatory = $true)][string]$Queue,
  [int]$IdleSec = 600,
  # a clip played silent at start: the first open of the media stack takes a second
  [string]$Warm
)

$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName PresentationCore

New-Item -ItemType Directory -Force -Path $Queue | Out-Null
Get-ChildItem -Path $Queue -Filter *.cmd | Remove-Item -Force

$clips = New-Object System.Collections.ArrayList
$loops = @{}
$idle = [Diagnostics.Stopwatch]::StartNew()

function Open-Clip([string]$path, [double]$gain) {
  $p = New-Object System.Windows.Media.MediaPlayer
  $p.Volume = [Math]::Min(1.0, [Math]::Max(0.0, $gain))
  $p.Open([uri]$path)
  $p.Play()
  return $p
}

function Stop-Clip($p) {
  $p.Stop()
  $p.Close()
}

function Is-Over($p, [double]$tailMs) {
  if (-not $p.NaturalDuration.HasTimeSpan) { return $false }
  return $p.Position.TotalMilliseconds -ge ($p.NaturalDuration.TimeSpan.TotalMilliseconds - $tailMs)
}

if ($Warm) { [void]$clips.Add((Open-Clip $Warm 0)) }

while ($true) {
  foreach ($f in (Get-ChildItem -Path $Queue -Filter *.cmd | Sort-Object Name)) {
    $text = [IO.File]::ReadAllText($f.FullName)
    # half written: take it on the next tick
    if (-not $text.EndsWith("`n")) { continue }
    Remove-Item -Force $f.FullName
    $idle.Restart()
    $a = $text.Trim().Split('|')
    switch ($a[0]) {
      'play' { [void]$clips.Add((Open-Clip $a[2] ([double]::Parse($a[1], [Globalization.CultureInfo]::InvariantCulture)))) }
      'loop' {
        if ($loops.ContainsKey($a[1])) { Stop-Clip $loops[$a[1]] }
        $loops[$a[1]] = Open-Clip $a[3] ([double]::Parse($a[2], [Globalization.CultureInfo]::InvariantCulture))
      }
      'stop' {
        if ($loops.ContainsKey($a[1])) { Stop-Clip $loops[$a[1]]; $loops.Remove($a[1]) }
      }
    }
  }

  for ($i = $clips.Count - 1; $i -ge 0; $i--) {
    if (Is-Over $clips[$i] 0) { Stop-Clip $clips[$i]; $clips.RemoveAt($i) }
  }
  foreach ($p in $loops.Values) {
    if (Is-Over $p 30) { $p.Position = [TimeSpan]::Zero; $p.Play() }
  }

  if ($loops.Count -eq 0 -and $clips.Count -eq 0 -and $idle.Elapsed.TotalSeconds -gt $IdleSec) { break }
  Start-Sleep -Milliseconds 10
}

Remove-Item -Recurse -Force $Queue
