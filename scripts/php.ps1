param([Parameter(ValueFromRemainingArguments=$true)][string[]]$PhpArguments)
$ErrorActionPreference = 'Stop'
$candidates = @()
$pathPhp = Get-Command php -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue
if ($pathPhp) { $candidates += $pathPhp }
$candidates += Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\PHP.PHP.*\php.exe" -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending |
  Select-Object -ExpandProperty FullName
$php = $candidates | Where-Object {
  $version = & $_ -r "echo PHP_VERSION_ID;"
  [int]$version -ge 80300
} | Select-Object -First 1
if (-not $php) { throw 'Se requiere PHP 8.3 o superior.' }
$runtimeOptions = @(
  '-d', 'upload_max_filesize=50M',
  '-d', 'post_max_size=64M'
)
$firstArgument = $PhpArguments | Select-Object -First 1
if ($firstArgument -and (Split-Path $firstArgument -Leaf) -eq 'artisan' -and (Test-Path $firstArgument)) {
  $artisanPath = (Resolve-Path $firstArgument).Path
  $artisanDirectory = Split-Path $artisanPath -Parent
  $remaining = @($PhpArguments | Select-Object -Skip 1)
  Push-Location $artisanDirectory
  try {
    if (($remaining | Select-Object -First 1) -eq 'serve') {
      # `artisan serve` inicia un segundo proceso PHP y no le reenvía las opciones `-d`.
      # Iniciamos directamente el servidor integrado para que el proceso HTTP use
      # los mismos límites de carga que el resto de comandos locales.
      $serverHost = '127.0.0.1'
      $serverPort = '8000'
      foreach ($argument in ($remaining | Select-Object -Skip 1)) {
        if ($argument -match '^--host=(.+)$') { $serverHost = $Matches[1] }
        if ($argument -match '^--port=([0-9]+)$') { $serverPort = $Matches[1] }
      }
      $serverRouter = Join-Path $artisanDirectory 'vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php'
      $publicDirectory = Join-Path $artisanDirectory 'public'
      if (-not (Test-Path -LiteralPath $serverRouter)) {
        throw "No se encontró el router HTTP de Laravel: $serverRouter"
      }
      Push-Location $publicDirectory
      try {
        & $php @runtimeOptions '-S' "${serverHost}:${serverPort}" '-t' $publicDirectory $serverRouter
      } finally { Pop-Location }
    } else {
      & $php @runtimeOptions 'artisan' @remaining
    }
  } finally { Pop-Location }
} else {
  & $php @runtimeOptions @PhpArguments
}
exit $LASTEXITCODE
