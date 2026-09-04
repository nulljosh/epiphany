package com.nulljosh.epiphany

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class Holding(
    val symbol: String,
    val shares: Double = 0.0,
    val marketValue: Double? = null,
    val account: String? = null,
    val source: String? = null,
)

@Serializable
data class Account(val name: String, val type: String = "", val balance: Double = 0.0, val source: String? = null)

@Serializable
data class Portfolio(
    val holdings: List<Holding> = emptyList(),
    val accounts: List<Account> = emptyList(),
)

// Read-only: GET /api/portfolio?action=get, the same endpoint the web/iOS/
// macOS apps read. No write path (POST/save) wired here -- this pass is
// scoped to viewing, not editing, real financial data from a new,
// less-battle-tested client.
class PortfolioClient(private val baseUrl: String = "https://epiphany.heyitsmejosh.com") {
    private val http = HttpClient {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
    }

    suspend fun portfolio(session: AuthSession): Portfolio =
        http.get("$baseUrl/api/portfolio") {
            header("Cookie", session.cookie)
            parameter("action", "get")
        }.body()
}
