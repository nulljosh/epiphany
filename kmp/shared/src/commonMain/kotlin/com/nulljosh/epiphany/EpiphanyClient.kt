package com.nulljosh.epiphany

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class FearGreed(val score: Int? = null, val rating: String? = null, val unavailable: Boolean = false)

@Serializable
data class Sp500Constituent(val symbol: String, val name: String, val sector: String)

@Serializable
private data class Sp500Response(val constituents: List<Sp500Constituent>)

// Scope: the ~20 unauth public market/civic endpoints only (fear-greed,
// sp500, weather, crime, earthquakes, etc.) -- portfolio.js, statements*.js,
// broker/, stripe*.js are session-auth-gated and hold real bank/brokerage
// data, deliberately not touched here. See roadmap.md's own prior ranking
// of this split (2026-08-30).
class EpiphanyClient(private val baseUrl: String = "https://epiphany.heyitsmejosh.com") {
    private val http = HttpClient {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
    }

    suspend fun fearGreed(): FearGreed = http.get("$baseUrl/api/fear-greed").body()
    suspend fun sp500(): List<Sp500Constituent> = http.get("$baseUrl/api/sp500").body<Sp500Response>().constituents
}
