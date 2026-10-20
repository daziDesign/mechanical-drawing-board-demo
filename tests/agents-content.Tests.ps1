$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$path = Join-Path $root 'AGENTS.md'
$actual = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8).TrimEnd("`r", "`n")
$expected = @'
注意事项
1.每次改动完成后，都必须对应的Git commit，以便后续追踪和回滾。
2.每次改动后，都必须编写或更新相关测试，并在交付给用户前，确保本次变更相关的测试和约定检查通过，并记录暂未验证的部分及原因 。
'@.TrimEnd("`r", "`n")

if ($actual -cne $expected) {
    throw 'AGENTS.md 内容与约定不一致。'
}

Write-Output 'AGENTS.md 内容检查通过。'
