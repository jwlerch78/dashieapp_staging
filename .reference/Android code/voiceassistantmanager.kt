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
import ai.picovoice.porcupine.Porcupine
import ai.picovoice.porcupine.PorcupineException
import java.io.File
import java.util.Locale
import java.util.concurrent.Executors

class VoiceAssistantManager(private val context: Context) {

    private var textToSpeech: TextToSpeech? = null
    private var speechRecognizer: SpeechRecognizer? = null
    private var porcupine: Porcupine? = null
    private var audioRecord: AudioRecord? = null
    private var isInitialized = false
    private var isListening = false
    private var isWakeWordActive = false
    private var sendPartialResults = true
    private val TAG = "VoiceAssistant"
    private val executor = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())

    // IMPORTANT: Replace with your actual Porcupine Access Key
    private val PORCUPINE_ACCESS_KEY = "ve3+Zu77+LPecXctetSxIOYDyT3BofH8splx/YOKdJVTI3ZKkiLPcA=="

    // Callbacks for TTS events
    var onTTSReady: (() -> Unit)? = null
    var onSpeakingStarted: (() -> Unit)? = null
    var onSpeakingCompleted: (() -> Unit)? = null
    var onTTSError: ((String) -> Unit)? = null

    // Callbacks for speech recognition events
    var onListeningStarted: (() -> Unit)? = null
    var onListeningEnded: (() -> Unit)? = null
    var onSpeechResult: ((String) -> Unit)? = null
    var onSpeechError: ((String) -> Unit)? = null
    var onPartialResult: ((String) -> Unit)? = null

    // Callbacks for wake word detection
    var onWakeWordDetected: (() -> Unit)? = null
    var onWakeWordError: ((String) -> Unit)? = null

    /**
     * Initialize Text-to-Speech engine
     */
    fun initializeTTS() {
        Log.d(TAG, "Initializing TTS...")

        textToSpeech = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                textToSpeech?.let { tts ->
                    // Set default language
                    val result = tts.setLanguage(Locale.US)

                    if (result == TextToSpeech.LANG_MISSING_DATA ||
                        result == TextToSpeech.LANG_NOT_SUPPORTED) {
                        Log.e(TAG, "Language not supported")
                        onTTSError?.invoke("Language not supported")
                    } else {
                        isInitialized = true
                        Log.d(TAG, "TTS initialized successfully")

                        // Set up progress listener
                        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                            override fun onStart(utteranceId: String?) {
                                Log.d(TAG, "TTS started speaking: $utteranceId")
                                onSpeakingStarted?.invoke()
                            }

                            override fun onDone(utteranceId: String?) {
                                Log.d(TAG, "TTS finished speaking: $utteranceId")
                                onSpeakingCompleted?.invoke()
                            }

                            override fun onError(utteranceId: String?) {
                                Log.e(TAG, "TTS error: $utteranceId")
                                onTTSError?.invoke("TTS playback error")
                            }
                        })

                        onTTSReady?.invoke()
                    }
                }
            } else {
                Log.e(TAG, "TTS initialization failed")
                onTTSError?.invoke("TTS initialization failed")
            }
        }
    }

    /**
     * Initialize Speech Recognition
     */
    fun initializeSpeechRecognition() {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            Log.e(TAG, "Speech recognition not available on this device")
            onSpeechError?.invoke("Speech recognition not available")
            return
        }

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context)

        speechRecognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                Log.d(TAG, "Ready for speech")
                isListening = true
                handler.post { onListeningStarted?.invoke() }
            }

            override fun onBeginningOfSpeech() {
                Log.d(TAG, "Beginning of speech detected")
            }

            override fun onRmsChanged(rmsdB: Float) {
                // Audio level changed
                Log.v(TAG, "Audio level: $rmsdB dB")
            }

            override fun onBufferReceived(buffer: ByteArray?) {
                // Audio buffer received
            }

            override fun onEndOfSpeech() {
                Log.d(TAG, "End of speech")
                isListening = false
            }

            override fun onError(error: Int) {
                isListening = false
                val errorMessage = when (error) {
                    SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
                    SpeechRecognizer.ERROR_CLIENT -> "Client side error"
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions"
                    SpeechRecognizer.ERROR_NETWORK -> "Network error"
                    SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
                    SpeechRecognizer.ERROR_NO_MATCH -> "No speech match"
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognition service busy"
                    SpeechRecognizer.ERROR_SERVER -> "Server error"
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech input"
                    else -> "Unknown error: $error"
                }
                Log.e(TAG, "Speech recognition error: $errorMessage")
                handler.post {
                    onSpeechError?.invoke(errorMessage)
                    onListeningEnded?.invoke()

                    // Restart wake word detection after error
                    if (isWakeWordActive) {
                        handler.postDelayed({ startWakeWordDetection() }, 1000)
                    }
                }
            }

            override fun onResults(results: Bundle?) {
                isListening = false
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (!matches.isNullOrEmpty()) {
                    val bestMatch = matches[0]
                    Log.d(TAG, "Speech result: $bestMatch")
                    handler.post {
                        onSpeechResult?.invoke(bestMatch)
                        onListeningEnded?.invoke()

                        // Restart wake word detection after getting result
                        if (isWakeWordActive) {
                            handler.postDelayed({ startWakeWordDetection() }, 500)
                        }
                    }
                } else {
                    handler.post { onListeningEnded?.invoke() }
                }
            }

            override fun onPartialResults(partialResults: Bundle?) {
                if (sendPartialResults) {
                    val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    if (!matches.isNullOrEmpty()) {
                        val partial = matches[0]
                        Log.d(TAG, "Partial result: $partial")
                        handler.post { onPartialResult?.invoke(partial) }
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
     * Initialize Porcupine Wake Word Detection
     */
    /**
     * Initialize Porcupine Wake Word Detection
     */
    fun initializeWakeWord() {
        try {
            val builder = Porcupine.Builder()
                .setAccessKey(PORCUPINE_ACCESS_KEY)
                .setKeywordPath(getKeywordPath())  // Load from res/raw

            porcupine = builder.build(context)

            Log.d(TAG, "Porcupine wake word initialized (sample rate: ${porcupine?.sampleRate}, frame length: ${porcupine?.frameLength})")
        } catch (e: PorcupineException) {
            Log.e(TAG, "Failed to initialize Porcupine: ${e.message}")
            onWakeWordError?.invoke("Wake word initialization failed: ${e.message}")
        }
    }

    /**
     * Extract .ppn file from resources to cache directory
     */
    private fun getKeywordPath(): String {
        val resourceId = context.resources.getIdentifier(
            "hey_dashy",  // Filename without extension
            "raw",
            context.packageName
        )

        val keywordFile = File(context.cacheDir, "hey_dashy.ppn")

        context.resources.openRawResource(resourceId).use { input ->
            keywordFile.outputStream().use { output ->
                input.copyTo(output)
            }
        }

        return keywordFile.absolutePath
    }

    /**
     * Start wake word detection (continuously listens for "Hey Dashy")
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

        if (porcupine == null) {
            Log.e(TAG, "Porcupine not initialized")
            onWakeWordError?.invoke("Wake word detector not initialized")
            return
        }

        if (isWakeWordActive) {
            Log.w(TAG, "Wake word detection already active")
            return
        }

        isWakeWordActive = true
        Log.d(TAG, "Starting wake word detection...")

        executor.execute {
            try {
                val frameLength = porcupine?.frameLength ?: 512
                val sampleRate = porcupine?.sampleRate ?: 16000

                val minBufferSize = AudioRecord.getMinBufferSize(
                    sampleRate,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
                )

                val bufferSize = maxOf(minBufferSize, frameLength * 2)

                audioRecord = AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    sampleRate,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    bufferSize
                )

                audioRecord?.startRecording()
                Log.d(TAG, "AudioRecord started for wake word detection")

                val buffer = ShortArray(frameLength)

                while (isWakeWordActive && !Thread.currentThread().isInterrupted) {
                    val numRead = audioRecord?.read(buffer, 0, buffer.size) ?: 0

                    if (numRead == frameLength) {
                        val result = porcupine?.process(buffer)

                        if (result != null && result >= 0) {
                            Log.d(TAG, "Wake word detected!")

                            // Stop wake word detection temporarily
                            stopWakeWordDetection()

                            // Notify and start speech recognition on main thread
                            handler.post {
                                onWakeWordDetected?.invoke()
                                startListening()
                            }

                            break
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error in wake word detection: ${e.message}", e)
                handler.post {
                    onWakeWordError?.invoke("Wake word detection error: ${e.message}")
                }
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
            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping AudioRecord: ${e.message}")
        }
    }

    /**
     * Check if wake word detection is active
     */
    fun isWakeWordActive(): Boolean {
        return isWakeWordActive
    }

    /**
     * Start listening for speech input
     */
    fun startListening(includePartialResults: Boolean = true) {
        sendPartialResults = includePartialResults
        
        if (speechRecognizer == null) {
            Log.w(TAG, "Speech recognizer not initialized")
            onSpeechError?.invoke("Speech recognizer not initialized")
            return
        }

        if (isListening) {
            Log.w(TAG, "Already listening")
            return
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.US)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }

        Log.d(TAG, "Starting speech recognition... (partial results: $includePartialResults)")
        speechRecognizer?.startListening(intent)
    }

    /**
     * Stop listening for speech input
     */
    fun stopListening() {
        if (isListening) {
            Log.d(TAG, "Stopping speech recognition")
            speechRecognizer?.stopListening()
            isListening = false
        }
    }

    /**
     * Cancel speech recognition
     */
    fun cancelListening() {
        if (isListening) {
            Log.d(TAG, "Canceling speech recognition")
            speechRecognizer?.cancel()
            isListening = false
        }
    }

    /**
     * Check if currently listening
     */
    fun isCurrentlyListening(): Boolean {
        return isListening
    }

    /**
     * Speak text with customizable parameters
     */
    fun speak(
        text: String,
        rate: Float = 1.0f,
        pitch: Float = 1.0f,
        utteranceId: String = "dashie_tts_${System.currentTimeMillis()}"
    ) {
        if (!isInitialized) {
            Log.w(TAG, "TTS not initialized, cannot speak")
            onTTSError?.invoke("TTS not ready")
            return
        }

        textToSpeech?.apply {
            setSpeechRate(rate)
            setPitch(pitch)

            Log.d(TAG, "Speaking: '$text' (rate=$rate, pitch=$pitch)")
            speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
        }
    }

    /**
     * Stop speaking immediately
     */
    fun stopSpeaking() {
        if (textToSpeech?.isSpeaking == true) {
            Log.d(TAG, "Stopping TTS")
            textToSpeech?.stop()
        }
    }

    /**
     * Check if TTS is currently speaking
     */
    fun isSpeaking(): Boolean {
        return textToSpeech?.isSpeaking == true
    }

    /**
     * Get available voices
     */
    fun getAvailableVoices(): Set<android.speech.tts.Voice>? {
        return textToSpeech?.voices
    }

    /**
     * Set a specific voice
     */
    fun setVoice(voice: android.speech.tts.Voice): Boolean {
        return textToSpeech?.setVoice(voice) == TextToSpeech.SUCCESS
    }

    /**
     * Clean up resources
     */
    fun shutdown() {
        Log.d(TAG, "Shutting down voice assistant")

        stopWakeWordDetection()

        textToSpeech?.stop()
        textToSpeech?.shutdown()
        textToSpeech = null

        speechRecognizer?.destroy()
        speechRecognizer = null

        porcupine?.delete()
        porcupine = null

        executor.shutdown()

        isInitialized = false
        isListening = false
        isWakeWordActive = false
    }
}