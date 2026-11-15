# Windows 11 wrapper for the same canonical release. No independent stamp.
param(
    [switch]$NativeStoreOnly,
    [string]$ReleaseVersion,
    [string]$SourceCommit,
    [Parameter(ValueFromRemainingArguments=$true)][string[]]$BuildArguments
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$hostOs = Get-CimInstance Win32_OperatingSystem
if ([int]$hostOs.BuildNumber -lt 22000) { throw 'This wrapper requires native Windows 11' }
if (-not $NativeStoreOnly) {
    $linuxRoot = (& wsl.exe wslpath -u $PSScriptRoot).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'WSL is required for the Android/Linux portions of this complete release' }
    & wsl.exe --cd $linuxRoot env NATALLY_WINDOWS_NATIVE_BUILD=1 bash ./build_all.sh @BuildArguments
    exit $LASTEXITCODE
}
if (-not $ReleaseVersion -or -not $SourceCommit) { throw 'Native continuation requires the canonical version and source commit' }
if ((Get-Content version.txt -Raw).Trim() -ne $ReleaseVersion) { throw 'Native continuation version mismatch' }
if ((& git rev-parse HEAD).Trim() -ne $SourceCommit) { throw 'Native continuation source mismatch' }
& git diff --quiet
if ($LASTEXITCODE -ne 0) { throw 'Tracked source changed before native continuation' }
$numeric = (($ReleaseVersion.Split('.') | ForEach-Object { [int]$_ }) -join '.')
$env:CARGO_TARGET_DIR = Join-Path $PSScriptRoot 'build/windows-native-target'
# Store signing is optional. Existing configured signing is honored by Tauri.
& npx --yes '@tauri-apps/cli@2.11.4' build --target x86_64-pc-windows-msvc --bundles nsis,msi -- --locked
if ($LASTEXITCODE -ne 0) { throw 'Native Windows EXE/NSIS/MSI packaging failed' }
& git diff --quiet
if ($LASTEXITCODE -ne 0 -or (& git rev-parse HEAD).Trim() -ne $SourceCommit) { throw 'Source changed during native continuation' }
$release = Join-Path $PSScriptRoot "dist/natally-v$ReleaseVersion"
New-Item -ItemType Directory -Force -Path $release | Out-Null
$base = Join-Path $env:CARGO_TARGET_DIR 'x86_64-pc-windows-msvc/release'
$nsis = @(Get-ChildItem (Join-Path $base 'bundle/nsis') -Filter '*.exe' | Where-Object { $_.Name.Contains($numeric) })
$msi = @(Get-ChildItem (Join-Path $base 'bundle/msi') -Filter '*.msi' | Where-Object { $_.Name.Contains($numeric) })
if ($nsis.Count -ne 1 -or $msi.Count -ne 1) { throw 'Native current-version NSIS/MSI outputs are not unique' }
$inputs = @(
    @{ source=(Join-Path $base 'natally-ai-studio.exe'); suffix='windows-x64-native.exe'; kind='windows-native-executable' },
    @{ source=$nsis[0].FullName; suffix='windows-x64-native-installer.exe'; kind='windows-native-nsis' },
    @{ source=$msi[0].FullName; suffix='windows-x64.msi'; kind='windows-msi' }
)
$artifacts = @()
foreach ($inputArtifact in $inputs) {
    $name = "natally-v$ReleaseVersion-$($inputArtifact.suffix)"
    $output = Join-Path $release $name
    Copy-Item $inputArtifact.source $output
    $artifacts += @{
        kind=$inputArtifact.kind; path="dist/natally-v$ReleaseVersion/$name"
        bytes=(Get-Item $output).Length; sha256=(Get-FileHash $output -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}
$signature = Get-AuthenticodeSignature $msi[0].FullName
$inventory = @{ version=$ReleaseVersion; sourceCommit=$SourceCommit; artifacts=$artifacts
   storeSigning=$signature.Status.ToString(); storeAcceptance='unverified' } |
   ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText((Join-Path $release 'windows-native-inventory.json'), $inventory, [System.Text.UTF8Encoding]::new($false))
