package com.nulljosh.epiphany

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

// Epiphany's own cookie-session scheme (server/api/auth.js), not Supabase
// Auth -- POST {action:'login'} sets epiphany_session via Set-Cookie, and
// every authenticated call (portfolio.js etc.) reads that same cookie via
// getSessionUser(). No signup form here; sign in against an existing
// account only.
data class AuthSession(val cookie: String)

@Serializable
private data class LoginResponse(val ok: Boolean = false)

@Serializable
private data class LoginError(val error: String? = null)

class AuthException(message: String) : Exception(message)

class EpiphanyAuth(private val baseUrl: String = "https://epiphany.heyitsmejosh.com") {
    private val http = HttpClient {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
    }

    suspend fun signIn(email: String, password: String): AuthSession {
        val response: HttpResponse = http.post("$baseUrl/api/auth?action=login") {
            contentType(ContentType.Application.Json)
            setBody("""{"email":"${email.jsonEscape()}","password":"${password.jsonEscape()}"}""")
        }
        if (!response.status.isSuccess()) {
            val err = runCatching { response.body<LoginError>() }.getOrNull()
            throw AuthException(err?.error ?: "Sign in failed (${response.status.value})")
        }
        val setCookie = response.headers.getAll("Set-Cookie")?.firstOrNull { it.startsWith("epiphany_session=") }
            ?: throw AuthException("No session returned")
        val cookiePair = setCookie.substringBefore(';')
        return AuthSession(cookiePair)
    }
}

private fun String.jsonEscape() = replace("\\", "\\\\").replace("\"", "\\\"")
