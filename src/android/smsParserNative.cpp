#include <jni.h>
#include <string>
#include <vector>

// Native SMS parsing implementation for Android
// This file handles SMS text extraction and initial processing

extern "C" {

JNIEXPORT void JNICALL
Java_com_expensi_u_sms_parser_parseSMS(JNIEnv *env, jobject /* this */, jstring smsTextStr) {
  // Extract SMS text from Java string
  const char* smsTextChars = env->GetStringUTFChars(smsTextStr, nullptr);
  std::string smsText(smsTextChars);
  env->ReleaseStringUTFChars(smsTextStr, smsTextChars);

  // Extract transaction data using regex patterns (fallback)
  parseTransactionFromSMS(smsText);
}

JNIEXPORT jdouble JNICALL
Java_com_expensi_u_sms_parser_getAmount(JNIEnv *env, jobject /* this */, jstring amountStr) {
  const char* amountChars = env->GetStringUTFChars(amountStr, nullptr);
  std::string amountStrNative(amountChars);
  env->ReleaseStringUTFChars(amountStr, amountChars);

  // Parse amount and return as double (in cents)
  size_t decimalPos;
  std::istringstream iss(amountStrNative);
  double value;
  char sign = 1;

  if (!iss.get(&value)) {
    return 0.0;
  }

  return value * 100.0; // Return in cents
}

JNIEXPORT void JNICALL
Java_com_expensi_u_sms_parser_setCurrency(JNIEnv *env, jobject /* this */, jstring currencyCode) {
  const char* currencyChars = env->GetStringUTFChars(currencyCode, nullptr);
  std::string currency(currencyChars);
  env->ReleaseStringUTFChars(currencyCode, currencyChars);

  // Store currency preference
  saveCurrencyPreference(currency);
}

JNIEXPORT void JNICALL
Java_com_expensi_u_sms_parser_detectLanguage(JNIEnv *env, jobject /* this */, jstring textStr) {
  const char* textChars = env->GetStringUTFChars(textStr, nullptr);
  std::string textText(textChars);
  env->ReleaseStringUTFChars(textStr, textChars);

  // Detect language from SMS content
  detectLanguageFromText(textText);
}

// Helper functions for native parsing logic (would be in implementation file)
static void parseTransactionFromSMS(const std::string& smsText) {
  // Regex-based parsing implementation
  // Match amount patterns like "$100.50" or "₹500.00"
}

static void saveCurrencyPreference(const std::string& currency) {
  // Save currency preference to shared preferences
}

static void detectLanguageFromText(const std::string& text) {
  // Language detection based on character patterns
}

} // extern "C"
