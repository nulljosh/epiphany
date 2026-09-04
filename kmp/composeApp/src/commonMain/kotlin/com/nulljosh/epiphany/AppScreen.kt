package com.nulljosh.epiphany

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun EpiphanyTheme(content: @Composable () -> Unit) =
    MaterialTheme(colorScheme = lightColorScheme(), content = content)

// ponytail: public market data only (fear-greed, S&P 500 constituents). No
// login, no portfolio/statements/broker access -- that is real bank and
// brokerage data and stays a separate, deliberate decision. See
// EpiphanyClient.kt.
@Composable
fun AppScreen(client: EpiphanyClient = EpiphanyClient()) {
    var fearGreed by remember { mutableStateOf<FearGreed?>(null) }
    var sp500 by remember { mutableStateOf<List<Sp500Constituent>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

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
            Text("Public market snapshot", modifier = Modifier.padding(top = 4.dp))
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
