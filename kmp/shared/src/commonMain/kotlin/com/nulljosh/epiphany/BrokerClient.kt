package com.nulljosh.epiphany

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class BrokerConnection(val id: String, val brokerName: String? = null)

@Serializable
data class BrokerSyncResponse(
    val ok: Boolean = false,
    val linked: Boolean? = null,
    val skipped: Boolean? = null,
    val linkUrl: String? = null,
    val upgradeRequired: Boolean? = null,
    val connections: List<BrokerConnection>? = null,
)

/**
 * server/api/broker/sync.js + disconnect.js, the same read-only SnapTrade sync
 * the web/iOS/macOS Settings screens drive. Session-auth-gated like PortfolioClient.
 * `action = "connect-additional"` links a second brokerage (Pro-gated server-side).
 */
class BrokerClient(private val baseUrl: String = "https://epiphany.heyitsmejosh.com") {
    private val http = HttpClient {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
    }

    suspend fun sync(session: AuthSession, force: Boolean = false, action: String? = null): BrokerSyncResponse =
        http.post("$baseUrl/api/broker/sync") {
            header("Cookie", session.cookie)
            contentType(ContentType.Application.Json)
            val actionField = action?.let { ""","action":"$it"""" } ?: ""
            setBody("""{"force":$force$actionField}""")
        }.body()

    suspend fun disconnect(session: AuthSession) {
        http.post("$baseUrl/api/broker/disconnect") { header("Cookie", session.cookie) }
    }
}
