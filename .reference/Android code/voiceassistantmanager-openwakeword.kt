package com.dashieapp.Dashie

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat

import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log

// OpenWakeWord imports (replaces Porcupine)
import com.rementia.openwakeword.lib.WakeWordEngine
import com.rementia.openwakeword.lib.WakeWordModel
import com.rementia.openwakeword.lib.DetectionMode
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

import java.io.File
import java.util.Locale
import java.util.concurrent.Executors

/**
 * VoiceAssistantManager with OpenWakeWord Integration
 *
 * This version replaces Porcupine with OpenWakeWord for better Fire TV compatibility.
 *
 * Changes from original:
 * - Removed Porcupine dependency
 * - Added OpenWakeWord WakeWordEngine
 * - Uses coroutines for wake word detection
 * - ONNX models instead of .ppn files
 */
class VoiceAssistantManager(private val context: Context) {

    private var textToSpeech: TextToSpeech? = null
    private var speechRecognizer: SpeechRecognizer? = null

    // OpenWakeWord engine (replaces Porcupine)
    private var wakeWordEngine: WakeWordEngine? = null
    private var wakeWordScope: CoroutineScope? = null

    private var isInitialized = false
    private var isListening = false
    private var isWakeWordActive = false
    private var sendPartialResults = true
    private val TAG = "VoiceAssistantManager"
    private val executor = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())

    // Callbacks for TTS events
    var onTTSReady: (() -> Unit)? = null
    var onSpeakingStarted: (() -> Unit)? = null
    var onSpeakingCompleted: (() -> Unit)? = null
    var onTTSError: ((String) -> Unit)? = null

    // Callbacks for speech recognition events
    var onListeningStarted: (() -> Unit)? = null
    var onListeningEnded: (() -> Unit)? = null
    var onPartialResult: ((String) -> Unit)? = null
    var onSpeechResult: ((String) -> Unit)? = null
    var onSpeechError: ((String) -> Unit)? = null

    // Callbacks for wake word events
    var onWakeWordDetected: (() -> Unit)? = null
    var onWakeWordError: ((String) -> Unit)? = null

    /**
     * Initialize the VoiceAssistantManager
     */
    fun initialize() {
        if (isInitialized) {
            Log.w(TAG, "Already initialized")
            return
        }

        try {
            // Initialize TTS
            initializeTTS()

            // Initialize Speech Recognition
            initializeSpeechRecognition()

            // Initialize Wake Word Detection (OpenWakeWord)
            initializeWakeWord()

            isInitialized = true
            Log.d(TAG, "VoiceAssistantManager initialized successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize VoiceAssistantManager: ${e.message}", e)
        }
    }

    /**
     * Initialize Text-to-Speech
     */
    private fun initializeTTS() {
        textToSpeech = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                textToSpeech?.language = Locale.US
                textToSpeech?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {
                        handler.post { onSpeakingStarted?.invoke() }
                    }

                    override fun onDone(utteranceId: String?) {
                        handler.post { onSpeakingCompleted?.invoke() }
                    }

                    override fun onError(utteranceId: String?) {
                        handler.post { onTTSError?.invoke("TTS error") }
                    }
                })
                onTTSReady?.invoke()
                Log.d(TAG, "Text-to-Speech initialized")
            } else {
                Log.e(TAG, "Failed to initialize TTS")
                onTTSError?.invoke("TTS initialization failed")
            }
        }
    }

    /**
     * Initialize Speech Recognition
     */
    private fun initializeSpeechRecognition() {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            Log.e(TAG, "Speech recognition not available on this device")
            return
        }

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context)
        speechRecognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                isListening = true
                handler.post { onListeningStarted?.invoke() }
                Log.d(TAG, "Ready for speech")
            }

            override fun onBeginningOfSpeech() {
                Log.d(TAG, "Speech detected")
            }

            override fun onRmsChanged(rmsdB: Float) {
                // Audio level changed
            }

            override fun onBufferReceived(buffer: ByteArray?) {
                // Audio buffer received
            }

            override fun onEndOfSpeech() {
                isListening = false
                handler.post { onListeningEnded?.invoke() }
                Log.d(TAG, "End of speech")
            }

            override fun onError(error: Int) {
                isListening = false
                val errorMessage = when (error) {
                    SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
                    SpeechRecognizer.ERROR_CLIENT -> "Client side error"
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions"
                    SpeechRecognizer.ERROR_NETWORK -> "Network error"
                    SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
                    SpeechRecognizer.ERROR_NO_MATCH -> "No match found"
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognition service busy"
                    SpeechRecognizer.ERROR_SERVER -> "Server error"
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech input"
                    else -> "Unknown error: $error"
                }
                handler.post { onSpeechError?.invoke(errorMessage) }
                Log.e(TAG, "Speech recognition error: $errorMessage")
            }

            override fun onResults(results: Bundle?) {
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (matches != null && matches.isNotEmpty()) {
                    val result = matches[0]
                    handler.post { onSpeechResult?.invoke(result) }
                    Log.d(TAG, "Speech result: $result")
                }
            }

            override fun onPartialResults(partialResults: Bundle?) {
                if (sendPartialResults) {
                    val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    if (matches != null && matches.isNotEmpty()) {
                        val result = matches[0]
                        handler.post { onPartialResult?.invoke(result) }
                        Log.v(TAG, "Partial result: $result")
                    }
                }
            }

            override fun onEvent(eventType: Int, params: Bundle?) {
                // Custom events
            }
        })

        Log.d(TAG, "Speech recognition initialized")
    }

    /**
     * Initialize OpenWakeWord Wake Word Detection
     */
    fun initializeWakeWord() {
        try {
            // Create wake word scope for coroutines
            wakeWordScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

            // Define the wake word model
            // Model file should be in assets/models/hey_jarvis.onnx
            val models = listOf(
                WakeWordModel(
                    name = "Hey Jarvis",
                    modelPath = "models/hey_jarvis.onnx",
                    threshold = 0.5f  // Adjust sensitivity (0.0 - 1.0, higher = less sensitive)
                )
            )

            // Create the wake word engine
            wakeWordEngine = WakeWordEngine(
                context = context,
                models = models,
                detectionMode = DetectionMode.SINGLE_BEST
            )

            Log.d(TAG, "OpenWakeWord initialized successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize OpenWakeWord: ${e.message}", e)
            onWakeWordError?.invoke("Wake word initialization failed: ${e.message}")
        }
    }

    /**
     * Start wake word detection
     */
    fun startWakeWordDetection() {
        if (ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.RECORD_AUDIO
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            Log.e(TAG, "Microphone permission not granted")
            onWakeWordError?.invoke("Microphone permission not granted")
            return
        }

        if (wakeWordEngine == null) {
            Log.e(TAG, "OpenWakeWord not initialized")
            onWakeWordError?.invoke("Wake word detector not initialized")
            return
        }

        if (isWakeWordActive) {
            Log.w(TAG, "Wake word detection already active")
            return
        }

        try {
            isWakeWordActive = true
            Log.d(TAG, "Starting wake word detection...")

            // Start the engine
            wakeWordEngine?.start()

            // Collect detections
            wakeWordScope?.launch {
                wakeWordEngine?.detections?.collect { detection ->
                    Log.d(TAG, "Wake word detected: ${detection.model.name}")

                    // Stop wake word detection temporarily
                    stopWakeWordDetection()

                    // Notify and start speech recognition on main thread
                    handler.post {
                        onWakeWordDetected?.invoke()
                        startListening()
                    }
                }
            }

            Log.d(TAG, "Wake word detection started")
        } catch (e: Exception) {
            isWakeWordActive = false
            Log.e(TAG, "Error starting wake word detection: ${e.message}", e)
            handler.post {
                onWakeWordError?.invoke("Wake word detection error: ${e.message}")
            }
        }
    }

    /**
     * Stop wake word detection
     */
    fun stopWakeWordDetection() {
        if (!isWakeWordActive) {
            return
        }

        isWakeWordActive = false
        Log.d(TAG, "Stopping wake word detection")

        try {
            wakeWordEngine?.stop()
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping wake word detection: ${e.message}")
        }
    }

    /**
     * Check if wake word detection is active
     */
    fun isWakeWordActive(): Boolean {
        return isWakeWordActive
    }

    /**
     * Start listening for speech (with partial results)
     */
    fun startListening() {
        if (isListening) {
            Log.w(TAG, "Already listening")
            return
        }

        sendPartialResults = true
        startListeningInternal()
    }

    /**
     * Start listening for speech (final results only)
     */
    fun startListeningFinalOnly() {
        if (isListening) {
            Log.w(TAG, "Already listening")
            return
        }

        sendPartialResults = false
        startListeningInternal()
    }

    private fun startListeningInternal() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, sendPartialResults)
        }

        speechRecognizer?.startListening(intent)
        Log.d(TAG, "Started listening (partial results: $sendPartialResults)")
    }

    /**
     * Stop listening for speech
     */
    fun stopListening() {
        if (!isListening) {
            return
        }

        speechRecognizer?.stopListening()
        Log.d(TAG, "Stopped listening")
    }

    /**
     * Cancel listening for speech
     */
    fun cancelListening() {
        if (!isListening) {
            return
        }

        speechRecognizer?.cancel()
        isListening = false
        Log.d(TAG, "Cancelled listening")
    }

    /**
     * Check if currently listening
     */
    fun isCurrentlyListening(): Boolean {
        return isListening
    }

    /**
     * Speak text with default parameters
     */
    fun speak(text: String) {
        textToSpeech?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "utterance_id")
        Log.d(TAG, "Speaking: $text")
    }

    /**
     * Speak text with custom rate and pitch
     */
    fun speak(text: String, rate: Float, pitch: Float) {
        textToSpeech?.setSpeechRate(rate)
        textToSpeech?.setPitch(pitch)
        textToSpeech?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "utterance_id")
        Log.d(TAG, "Speaking with rate $rate and pitch $pitch: $text")
    }

    /**
     * Stop speaking
     */
    fun stopSpeaking() {
        textToSpeech?.stop()
        Log.d(TAG, "Stopped speaking")
    }

    /**
     * Check if TTS is speaking
     */
    fun isSpeaking(): Boolean {
        return textToSpeech?.isSpeaking ?: false
    }

    /**
     * Cleanup resources
     */
    fun destroy() {
        // Stop listening and speaking
        if (isListening) {
            cancelListening()
        }
        if (isSpeaking()) {
            stopSpeaking()
        }

        // Stop wake word detection
        if (isWakeWordActive) {
            stopWakeWordDetection()
        }

        // Cancel wake word coroutines
        wakeWordScope?.cancel()
        wakeWordScope = null

        // Release wake word engine
        wakeWordEngine?.release()
        wakeWordEngine = null

        // Restore original voice event handler
        speechRecognizer?.destroy()
        speechRecognizer = null

        // Shutdown TTS
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        textToSpeech = null

        executor.shutdown()

        isInitialized = false
        Log.d(TAG, "VoiceAssistantManager destroyed")
    }
}
