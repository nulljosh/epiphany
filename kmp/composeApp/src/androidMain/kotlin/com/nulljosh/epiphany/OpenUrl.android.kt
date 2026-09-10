package com.nulljosh.epiphany

import android.content.Context
import android.content.Intent
import android.net.Uri
import java.lang.ref.WeakReference

/** Set once from MainActivity.onCreate so shared UI code can launch a browser tab. */
object AndroidAppContext {
    var ref: WeakReference<Context>? = null
}

actual fun openUrl(url: String) {
    val context = AndroidAppContext.ref?.get() ?: return
    runCatching {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
