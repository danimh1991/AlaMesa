param([string]$BaseUrl = 'https://danieta.com/alamesa')
$ErrorActionPreference = 'Stop'
if (-not $env:RECIPE_API_TOKEN) { throw 'Define RECIPE_API_TOKEN solo en el entorno de esta consola.' }
$headers = @{ Authorization = "Bearer $env:RECIPE_API_TOKEN" }
$list = Invoke-RestMethod -Uri "$BaseUrl/api/recipes?limit=200" -Headers $headers
$recipeId = 'api-pollo-horno-manzana-cebolla'
if ($list.recipes.recipeId -contains $recipeId) {
  Write-Host 'La receta ya existe; no se ha creado otra copia.'
  exit 0
}
$payload = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'pollo-horno-manzana-cebolla.json')
$created = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/recipes" -Headers $headers -ContentType 'application/json' -Body $payload
$created.recipe | ConvertTo-Json -Depth 10
