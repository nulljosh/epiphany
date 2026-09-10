package com.nulljosh.epiphany

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

@Composable
fun EpiphanyTheme(content: @Composable () -> Unit) =
    MaterialTheme(colorScheme = lightColorScheme(), content = content)

// Public market snapshot always shows, no account needed. Signing in
// additionally shows the account's own portfolio -- read-only (no save/
// edit path wired here), same GET /api/portfolio?action=get the web/iOS/
// macOS apps read. Brokerage connect/disconnect (server/api/broker/*.js)
// mirrors the same flow the web/iOS/macOS Settings screens drive. No
// statement upload here still -- separate scope.
@Composable
fun AppScreen(
    client: EpiphanyClient = EpiphanyClient(),
    auth: EpiphanyAuth = EpiphanyAuth(),
    portfolioClient: PortfolioClient = PortfolioClient(),
    brokerClient: BrokerClient = BrokerClient(),
) {
    var fearGreed by remember { mutableStateOf<FearGreed?>(null) }
    var sp500 by remember { mutableStateOf<List<Sp500Constituent>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var session by remember { mutableStateOf<AuthSession?>(null) }
    var portfolio by remember { mutableStateOf<Portfolio?>(null) }
    var authError by remember { mutableStateOf<String?>(null) }
    var signingIn by remember { mutableStateOf(false) }
    var broker by remember { mutableStateOf<BrokerSyncResponse?>(null) }
    var brokerBusy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    suspend fun syncBroker(current: AuthSession, force: Boolean = false, action: String? = null) {
        brokerBusy = true
        broker = runCatching { brokerClient.sync(current, force = force, action = action) }.getOrNull()
        broker?.linkUrl?.let { openUrl(it) }
        brokerBusy = false
    }

    fun signIn() {
        scope.launch {
            signingIn = true
            authError = null
            runCatching {
                val s = auth.signIn(email, password)
                session = s
                portfolio = portfolioClient.portfolio(s)
                syncBroker(s)
            }.onFailure { authError = it.message ?: "Sign in failed" }
            signingIn = false
        }
    }

    LaunchedEffect(Unit) {
        runCatching {
            fearGreed = client.fearGreed()
            sp500 = client.sp500()
        }.onFailure { error = it.message ?: "failed to load" }
        loading = false
    }

    Surface {
        Column(Modifier.fillMaxSize().padding(24.dp)) {
            Text("Epiphany", style = MaterialTheme.typography.headlineMedium)

            val currentSession = session
            if (currentSession == null) {
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
                Button(onClick = { signIn() }, modifier = Modifier.padding(top = 8.dp)) { Text("Sign in") }
                if (signingIn) CircularProgressIndicator(Modifier.padding(top = 16.dp))
                authError?.let { Text(it, modifier = Modifier.padding(top = 8.dp)) }
            } else {
                Text("Signed in", modifier = Modifier.padding(top = 8.dp))
                portfolio?.let { p ->
                    Text("Holdings (${p.holdings.size})", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp))
                    p.holdings.forEach { h -> Text("${h.symbol} - ${h.shares} sh${h.marketValue?.let { " - $it" } ?: ""}") }
                    Text("Accounts (${p.accounts.size})", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp))
                    p.accounts.forEach { a -> Text("${a.name} - ${a.balance}") }
                }

                Text("Brokerage", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 24.dp))
                if (broker?.upgradeRequired == true) {
                    Text("Connecting another brokerage is a Premium feature.", modifier = Modifier.padding(top = 4.dp))
                }
                if (broker?.linked == true) {
                    broker?.connections.orEmpty().distinctBy { it.brokerName }.forEach {
                        Text("Connected: ${it.brokerName ?: "Brokerage"}", modifier = Modifier.padding(top = 4.dp))
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                        Button(
                            onClick = { scope.launch { syncBroker(currentSession, action = "connect-additional") } },
                            enabled = !brokerBusy,
                        ) { Text("Connect another") }
                        Button(
                            onClick = {
                                scope.launch {
                                    brokerBusy = true
                                    brokerClient.disconnect(currentSession)
                                    broker = null
                                    brokerBusy = false
                                }
                            },
                            enabled = !brokerBusy,
                        ) { Text("Disconnect") }
                    }
                } else {
                    Button(
                        onClick = { scope.launch { syncBroker(currentSession) } },
                        enabled = !brokerBusy,
                        modifier = Modifier.padding(top = 8.dp),
                    ) { Text(if (brokerBusy) "Connecting..." else "Connect brokerage") }
                }
            }

            Text("Public market snapshot", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 24.dp))
            when {
                loading -> CircularProgressIndicator(Modifier.padding(top = 24.dp))
                error != null -> Text(error!!, modifier = Modifier.padding(top = 16.dp))
                else -> {
                    fearGreed?.let { fg ->
                        Text(
                            if (fg.unavailable) "Fear & Greed: unavailable" else "Fear & Greed: ${fg.score} (${fg.rating})",
                            modifier = Modifier.padding(top = 16.dp),
                        )
                    }
                    Text("S&P 500 (${sp500.size})", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp))
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        items(sp500) { c -> Text("${c.symbol} - ${c.name} (${c.sector})") }
                    }
                }
            }
        }
    }
}
