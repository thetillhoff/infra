resource "cloudflare_zone" "thetillhoff-de" {
  account_id = "4928ade6960885574a9a2b6ae430f515"
  zone       = "thetillhoff.de"
  type       = "partial"
}

resource "cloudflare_zone" "enforge-de" {
  account_id = "4928ade6960885574a9a2b6ae430f515"
  zone       = "enforge.de"
  type       = "partial"
}
