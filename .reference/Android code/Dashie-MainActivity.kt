package com.dashieapp.Dashie

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebSettings
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceError
import android.webkit.WebResourceResponse
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.tasks.Task
import com.google.android.gms.common.api.Scope

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    // Optional: GoogleSignInClient included for testing / WebView integration.
    // Fire TV does NOT require Google Play Services; core app works via WebView login.
    private lateinit var googleSignInClient: GoogleSignInClient
    private lateinit var signInLauncher: ActivityResultLauncher<Intent>
    private lateinit var permissionLauncher: ActivityResultLauncher<String>
    private val TAG = "DashieAuth"

    // Voice Assistant - Phase 0 Tests #1 & #2
    private var voiceAssistant: VoiceAssistantManager? = null

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface", "GestureBackNavigation")
    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Keep screen on while dashboard is active
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Initialize permission launcher for microphone access
        permissionLauncher = registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { isGranted ->
            if (isGranted) {
                Log.d(TAG, "Microphone permission granted")
                initializeVoiceAssistant()
            } else {
                Log.e(TAG, "Microphone permission denied")
                notifyWebView("voicePermissionDenied", "")
            }
        }

        // Optional: Initialize Google Sign-In (Fire TV users will not require this)
        initializeGoogleSignIn()

        // Check and request microphone permission if needed
        checkMicrophonePermission()

        webView = findViewById(R.id.dashboardWebView)
        var webViewLoaded = false
        splashScreen.setKeepOnScreenCondition { !webViewLoaded }

        val webSettings = webView.settings
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.databaseEnabled = true

        // Limit file access for security on Fire TV
        webSettings.allowFileAccess = false
        webSettings.allowContentAccess = true
        webSettings.allowFileAccessFromFileURLs = false
        webSettings.allowUniversalAccessFromFileURLs = false
        webSettings.javaScriptCanOpenWindowsAutomatically = true
        webSettings.setSupportMultipleWindows(true)
        webSettings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        // User agent modification
        val originalUserAgent = webSettings.userAgentString
        val modifiedUserAgent = originalUserAgent.replace("; wv", "").replace(";wv", "")
        webSettings.userAgentString = "$modifiedUserAgent DashieApp/1.0"

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptThirdPartyCookies(webView, true)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true)
        }

        webSettings.cacheMode = WebSettings.LOAD_DEFAULT
        webSettings.setGeolocationEnabled(false)
        webSettings.setSaveFormData(false)
        webSettings.setSavePassword(false)
        webSettings.setNeedInitialFocus(false)
        webSettings.setRenderPriority(WebSettings.RenderPriority.HIGH)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            webSettings.setSafeBrowsingEnabled(false)
        }

        try {
            webSettings.setMediaPlaybackRequiresUserGesture(false)
        } catch (e: Exception) {
            Log.w(TAG, "Media playback setting not available: ${e.message}")
        }

        // Debugging disabled for release builds
        // WebView.setWebContentsDebuggingEnabled(false)

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                webViewLoaded = true
                checkAndNotifyExistingAuth()
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {}
            override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?) {}
        }

        webView.addJavascriptInterface(DashieJSInterface(), "DashieNative")

        // Load dashboard
        webView.loadUrl("https://dashieapp.com/")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("handleRemoteInput(${KeyEvent.KEYCODE_BACK});", null)
            }
        })
    }

    private fun checkMicrophonePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            when {
                ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.RECORD_AUDIO
                ) == PackageManager.PERMISSION_GRANTED -> {
                    // Permission already granted
                    initializeVoiceAssistant()
                }
                shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO) -> {
                    // Show explanation and request permission
                    Log.d(TAG, "Should show permission rationale")
                    permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                }
                else -> {
                    // Request permission
                    permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                }
            }
        } else {
            // Permission granted by default on older Android versions
            initializeVoiceAssistant()
        }
    }

    private fun initializeVoiceAssistant() {
        voiceAssistant = VoiceAssistantManager(this)

        // Initialize TTS
        voiceAssistant?.initializeTTS()
        voiceAssistant?.onTTSReady = {
            Log.d(TAG, "Voice assistant TTS ready")
        }
        voiceAssistant?.onTTSError = { error ->
            Log.e(TAG, "Voice assistant TTS error: $error")
        }

        // Initialize Speech Recognition
        voiceAssistant?.initializeSpeechRecognition()
        voiceAssistant?.onListeningStarted = {
            Log.d(TAG, "Started listening")
            notifyWebView("listeningStarted", "")
        }
        voiceAssistant?.onListeningEnded = {
            Log.d(TAG, "Stopped listening")
            notifyWebView("listeningEnded", "")
        }
        voiceAssistant?.onSpeechResult = { text ->
            Log.d(TAG, "Speech result: $text")
            notifyWebView("speechResult", text)
        }
        voiceAssistant?.onSpeechError = { error ->
            Log.e(TAG, "Speech error: $error")
            notifyWebView("speechError", error)
        }
        voiceAssistant?.onPartialResult = { text ->
            Log.d(TAG, "Partial result: $text")
            notifyWebView("partialResult", text)
        }

        // Initialize Wake Word Detection
        voiceAssistant?.initializeWakeWord()
        voiceAssistant?.onWakeWordDetected = {
            Log.d(TAG, "Wake word detected!")
            notifyWebView("wakeWordDetected", "")
        }
        voiceAssistant?.onWakeWordError = { error ->
            Log.e(TAG, "Wake word error: $error")
            notifyWebView("wakeWordError", error)
        }
    }

    private fun notifyWebView(event: String, data: String) {
        val escapedData = data.replace("'", "\\'")
        val jsCode = """
            if (typeof window.onDashieVoiceEvent === 'function') {
                window.onDashieVoiceEvent('$event', '$escapedData');
            }
        """.trimIndent()

        webView.post {
            webView.evaluateJavascript(jsCode, null)
        }
    }

    private fun initializeGoogleSignIn() {
        // Optional: only used for WebView integration/testing; core app does not rely on GoogleSignInClient
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestProfile()
            .requestIdToken("YOUR_CLIENT_ID.apps.googleusercontent.com")
            .requestScopes(Scope("https://www.googleapis.com/auth/calendar.readonly"))
            .build()

        googleSignInClient = GoogleSignIn.getClient(this, gso)
        signInLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            if (result.resultCode == RESULT_OK) handleSignInResult(result.data)
            else notifyWebViewAuthResult(false, "Sign-in cancelled")
        }
    }

    private fun handleSignInResult(data: Intent?) {
        try {
            val task: Task<GoogleSignInAccount> = GoogleSignIn.getSignedInAccountFromIntent(data)
            val account = task.getResult(ApiException::class.java)
            notifyWebViewAuthSuccess(account)
        } catch (e: ApiException) {
            notifyWebViewAuthResult(false, e.message)
        }
    }

    private fun notifyWebViewAuthSuccess(account: GoogleSignInAccount) { /* ... */ }
    private fun notifyWebViewAuthResult(success: Boolean, error: String?) { /* ... */ }
    private fun checkAndNotifyExistingAuth() { /* ... */ }

    inner class DashieJSInterface {
        @JavascriptInterface fun exitApp() { finishAffinity() }
        @JavascriptInterface fun signIn() { /* optional sign-in */ }
        @JavascriptInterface fun signOut() { /* optional sign-out */ }
        @JavascriptInterface fun getCurrentUser(): String? { /* ... */ return null }
        @JavascriptInterface fun isSignedIn(): Boolean { return false }

        // TTS Methods - Phase 0 Test #2
        @JavascriptInterface
        fun speak(text: String) {
            runOnUiThread {
                voiceAssistant?.speak(text)
            }
        }

        @JavascriptInterface
        fun speakWithParams(text: String, rate: Float, pitch: Float) {
            runOnUiThread {
                voiceAssistant?.speak(text, rate, pitch)
            }
        }

        @JavascriptInterface
        fun stopSpeaking() {
            runOnUiThread {
                voiceAssistant?.stopSpeaking()
            }
        }

        @JavascriptInterface
        fun isSpeaking(): Boolean {
            return voiceAssistant?.isSpeaking() ?: false
        }

        // Speech Recognition Methods - Phase 0 Test #1
        @JavascriptInterface
        fun startListening() {
            runOnUiThread {
                voiceAssistant?.startListening(true)
            }
        }

        @JavascriptInterface
        fun startListeningFinalOnly() {
            runOnUiThread {
                voiceAssistant?.startListening(false)
            }
        }

        @JavascriptInterface
        fun stopListening() {
            runOnUiThread {
                voiceAssistant?.stopListening()
            }
        }

        @JavascriptInterface
        fun cancelListening() {
            runOnUiThread {
                voiceAssistant?.cancelListening()
            }
        }

        @JavascriptInterface
        fun isListening(): Boolean {
            return voiceAssistant?.isCurrentlyListening() ?: false
        }

        // Wake Word Detection Methods - Phase 0 Test #1
        @JavascriptInterface
        fun startWakeWordDetection() {
            runOnUiThread {
                voiceAssistant?.startWakeWordDetection()
            }
        }

        @JavascriptInterface
        fun stopWakeWordDetection() {
            runOnUiThread {
                voiceAssistant?.stopWakeWordDetection()
            }
        }

        @JavascriptInterface
        fun isWakeWordActive(): Boolean {
            return voiceAssistant?.isWakeWordActive() ?: false
        }
    }

    private fun forwardKeyToJs(keyCode: Int) { webView.evaluateJavascript("handleRemoteInput($keyCode);", null) }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_DPAD_UP,
            KeyEvent.KEYCODE_DPAD_DOWN,
            KeyEvent.KEYCODE_DPAD_LEFT,
            KeyEvent.KEYCODE_DPAD_RIGHT,
            KeyEvent.KEYCODE_DPAD_CENTER,
            KeyEvent.KEYCODE_MENU,
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
            KeyEvent.KEYCODE_MEDIA_STOP,
            KeyEvent.KEYCODE_MEDIA_NEXT,
            KeyEvent.KEYCODE_MEDIA_PREVIOUS -> {
                forwardKeyToJs(keyCode); true
            }
            else -> super.onKeyDown(keyCode, event)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        voiceAssistant?.shutdown()
    }
}